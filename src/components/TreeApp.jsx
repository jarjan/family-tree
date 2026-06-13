import { useState, useEffect, useCallback } from "preact/hooks";
import { TreeCanvas } from "./TreeCanvas.jsx";
import { DetailPanel } from "./DetailPanel.jsx";
import { setLanguage, t } from "../utils/i18n.js";
import familyData from "../data/family.json";
import { OnboardingModal } from "./OnboardingModal.jsx";

import "./TreeApp.css";

export function TreeApp() {
  const [lang, setLang] = useState("kk");
  setLanguage(lang); // Apply language synchronously during render

  const defaultFocus =
    familyData.find((d) => d.name === "Жаржан")?.id || familyData[0].id;
  const [selectedNodeId, setSelectedNodeId] = useState(defaultFocus);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const selectedNode = familyData.find((n) => n.id === selectedNodeId);

  const handleSelect = useCallback((id) => {
    setSelectedNodeId((prevSelectedId) => {
      if (prevSelectedId === id) {
        setIsPanelOpen((prevOpen) => !prevOpen);
      } else {
        setIsPanelOpen(true);
      }
      return id;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>{t("appTitle")}</h1>
        <div className="lang-switcher">
          <button
            className={`btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
          >
            EN
          </button>
          <button
            className={`btn ${lang === "kk" ? "active" : ""}`}
            onClick={() => setLang("kk")}
          >
            KK
          </button>
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
  );
}
