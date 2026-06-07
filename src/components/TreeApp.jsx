import { useState, useEffect } from "preact/hooks";
import { TreeCanvas } from "./TreeCanvas.jsx";
import { DetailPanel } from "./DetailPanel.jsx";
import { setLanguage, t } from "../utils/i18n.js";
import familyData from "../data/family.json";

import "./TreeApp.css";

export function TreeApp() {
  const [lang, setLang] = useState("kk");
  const defaultFocus =
    familyData.find((d) => d.name === "Жаржан")?.id || familyData[0].id;
  const [selectedNodeId, setSelectedNodeId] = useState(defaultFocus);

  // Apply language change
  useEffect(() => {
    setLanguage(lang);
  }, [lang]);

  const selectedNode = familyData.find((n) => n.id === selectedNodeId);

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
          onSelect={setSelectedNodeId}
          selectedId={selectedNodeId}
        />

        {selectedNodeId && (
          <DetailPanel
            node={selectedNode}
            allData={familyData}
            onSelect={setSelectedNodeId}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </main>
    </div>
  );
}
