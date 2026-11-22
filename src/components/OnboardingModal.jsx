import { useEffect, useRef } from "preact/hooks";
import { useT } from "../utils/i18n.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "./OnboardingModal.css";

const ONBOARDED_KEY = "family_tree_onboarded";

// Native modal <dialog>: the browser provides the top layer, ::backdrop, an inert
// page behind it, focus containment, Esc/back-gesture dismissal and focus return.
export function OnboardingModal() {
  const t = useT();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!readStorage(ONBOARDED_KEY)) dialogRef.current?.showModal();
  }, []);

  // Fires for the dismiss button and for Esc alike.
  const handleClose = () => writeStorage(ONBOARDED_KEY, "true");

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-dialog glass"
      aria-labelledby="onboarding-title"
      onClose={handleClose}
    >
      <header className="modal-header">
        <h2 id="onboarding-title">{t("welcomeTitle")}</h2>
        <h3>{t("welcomeSubtitle")}</h3>
      </header>

      <p className="modal-desc">{t("welcomeDesc")}</p>

      <ul className="feature-list">
        <li className="feature-item">
          <div className="feature-icon">
            {/* Tap target SVG */}
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

      <form method="dialog">
        <button className="dismiss-btn btn active" autofocus>
          {t("dismissOnboarding")}
        </button>
      </form>
    </dialog>
  );
}
