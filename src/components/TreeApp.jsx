import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { TreeCanvas } from "./TreeCanvas.jsx";
import { DetailPanel } from "./DetailPanel.jsx";
import { SearchBox } from "./SearchBox.jsx";
import { OnboardingModal } from "./OnboardingModal.jsx";
import { DEFAULT_LANGUAGE, LanguageContext, isSupportedLanguage, translate } from "../utils/i18n.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { getRelatives } from "../utils/relations.js";
import familyData from "../data/family.json";

import "./TreeApp.css";

const LANG_STORAGE_KEY = "family_tree_lang";
const byId = new Map(familyData.map((d) => [d.id, d]));
const DEFAULT_FOCUS = familyData.find((d) => d.name === "Жаржан")?.id || familyData[0].id;

// The selected person lives in the URL hash so views can be linked and the
// back button walks through previously selected people.
function idFromHash() {
  let id = "";
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return null;
  }
  return byId.has(id) ? id : null;
}

export function TreeApp() {
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);
  const [selectedNodeId, setSelectedNodeId] = useState(DEFAULT_FOCUS);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;
  const pendingCommits = useRef([]);

  // Resolves view transitions waiting for a new selection to reach the DOM.
  useLayoutEffect(() => {
    for (const resolve of pendingCommits.current.splice(0)) resolve();
  }, [selectedNodeId]);

  // Morphs the tree into its new arrangement (cards are named per person in TreeCanvas).
  // Without View Transitions support the selection simply updates.
  const selectWithTransition = useCallback((id) => {
    if (!document.startViewTransition || document.hidden) {
      setSelectedNodeId(id);
      return;
    }
    const transition = document.startViewTransition(
      () =>
        new Promise((resolve) => {
          pendingCommits.current.push(resolve);
          setSelectedNodeId(id);
          setTimeout(resolve, 1000); // never hold the page frozen if nothing re-renders
        }),
    );
    // A skipped transition (tab hidden, newer selection) still applies the update; ignore it.
    transition.ready.catch(() => {});
  }, []);

  // Client-only state is restored after hydration (the server render uses defaults);
  // a layout effect applies it before the first paint.
  useLayoutEffect(() => {
    const savedLang = readStorage(LANG_STORAGE_KEY);
    if (isSupportedLanguage(savedLang)) setLang(savedLang);

    const hashId = idFromHash();
    if (hashId) setSelectedNodeId(hashId);

    const onHashChange = () => {
      // An empty/unknown hash (e.g. going back to the first entry) means the default person
      const id = idFromHash() || DEFAULT_FOCUS;
      if (id !== selectedRef.current) selectWithTransition(id);
      setIsPanelOpen(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [selectWithTransition]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, "appTitle");
  }, [lang]);

  const changeLanguage = (next) => {
    setLang(next);
    writeStorage(LANG_STORAGE_KEY, next);
  };

  // Selecting the current person toggles the panel; `open` forces it open.
  const handleSelect = useCallback((id, { open = false } = {}) => {
    if (id === selectedRef.current) {
      setIsPanelOpen((prev) => open || !prev);
      return;
    }
    selectWithTransition(id);
    setIsPanelOpen(true);
    history.pushState(null, "", `#${encodeURIComponent(id)}`);
  }, [selectWithTransition]);

  const handleClose = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const selectedNode = byId.get(selectedNodeId);
  // Shared by the canvas layout and the detail panel
  const relatives = useMemo(() => getRelatives(familyData, selectedNode), [selectedNode]);

  return (
    <LanguageContext.Provider value={lang}>
      <div className="app-container">
        <header className="app-header">
          <h1>{translate(lang, "appTitle")}</h1>
          <div className="header-actions">
            <SearchBox data={familyData} onSelect={handleSelect} />
            <div className="lang-switcher">
              <button
                className={`btn ${lang === "en" ? "active" : ""}`}
                aria-pressed={lang === "en"}
                onClick={() => changeLanguage("en")}
              >
                EN
              </button>
              <button
                className={`btn ${lang === "kk" ? "active" : ""}`}
                aria-pressed={lang === "kk"}
                onClick={() => changeLanguage("kk")}
              >
                KK
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          <TreeCanvas
            data={familyData}
            relatives={relatives}
            onSelect={handleSelect}
            selectedId={selectedNodeId}
            isPanelOpen={isPanelOpen}
          />

          {selectedNode && (
            <DetailPanel
              node={selectedNode}
              relatives={relatives}
              onSelect={handleSelect}
              isOpen={isPanelOpen}
              onClose={handleClose}
            />
          )}
        </main>
        <OnboardingModal />
      </div>
    </LanguageContext.Provider>
  );
}
