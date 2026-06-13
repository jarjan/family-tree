import { useState, useEffect } from "preact/hooks";
import { t } from "../utils/i18n.js";
import "./OnboardingModal.css";

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("family_tree_onboarded");
    if (!isDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("family_tree_onboarded", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass">
        <header className="modal-header">
          <h2>{t("welcomeTitle")}</h2>
          <h3>{t("welcomeSubtitle")}</h3>
        </header>

        <p className="modal-desc">{t("welcomeDesc")}</p>

        <ul className="feature-list">
          <li className="feature-item">
            <div className="feature-icon">
              {/* Tap target SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
            <div className="feature-text">
              <h4>{t("featureNavTitle")}</h4>
              <p>{t("featureNavDesc")}</p>
            </div>
          </li>
          
          <li className="feature-item">
            <div className="feature-icon">
              {/* Drag/move/zoom SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 9 2 12 5 15"></polyline>
                <polyline points="9 5 12 2 15 5"></polyline>
                <polyline points="15 19 12 22 9 19"></polyline>
                <polyline points="19 9 22 12 19 15"></polyline>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="12" y1="2" x2="12" y2="22"></line>
              </svg>
            </div>
            <div className="feature-text">
              <h4>{t("featureZoomTitle")}</h4>
              <p>{t("featureZoomDesc")}</p>
            </div>
          </li>

          <li className="feature-item">
            <div className="feature-icon">
              {/* Globe/lang SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <div className="feature-text">
              <h4>{t("featureLangTitle")}</h4>
              <p>{t("featureLangDesc")}</p>
            </div>
          </li>
        </ul>

        <button className="dismiss-btn btn active" onClick={handleDismiss}>
          {t("dismissOnboarding")}
        </button>
      </div>
    </div>
  );
}
