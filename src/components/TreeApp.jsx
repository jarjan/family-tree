import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "preact/hooks";
import { TreeCanvas } from "./TreeCanvas.jsx";
import { DetailPanel } from "./DetailPanel.jsx";
import { SearchBox } from "./SearchBox.jsx";
import { OnboardingModal } from "./OnboardingModal.jsx";
import { DEFAULT_LANGUAGE, LanguageContext, isSupportedLanguage, translate } from "../utils/i18n.js";
import { readStorage, writeStorage } from "../utils/storage.js";
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

  // Client-only state is restored after hydration (the server render uses defaults);
  // a layout effect applies it before the first paint.
  useLayoutEffect(() => {
    const savedLang = readStorage(LANG_STORAGE_KEY);
    if (isSupportedLanguage(savedLang)) setLang(savedLang);

    const hashId = idFromHash();
    if (hashId) setSelectedNodeId(hashId);

    const onHashChange = () => {
      // An empty/unknown hash (e.g. going back to the first entry) means the default person
      setSelectedNodeId(idFromHash() || DEFAULT_FOCUS);
      setIsPanelOpen(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
    setSelectedNodeId(id);
    setIsPanelOpen(true);
    history.pushState(null, "", `#${encodeURIComponent(id)}`);
  }, []);

  const handleClose = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const selectedNode = byId.get(selectedNodeId);

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
            onSelect={handleSelect}
            selectedId={selectedNodeId}
            isPanelOpen={isPanelOpen}
          />

          {selectedNode && (
            <DetailPanel
              node={selectedNode}
              allData={familyData}
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
