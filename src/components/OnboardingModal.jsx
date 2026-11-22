import { useEffect, useRef } from "preact/hooks";
import { useT } from "../utils/i18n.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import "./OnboardingModal.css";

const ONBOARDED_KEY = "family_tree_onboarded";

const iconProps = {
  "aria-hidden": "true",
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

// Each feature's title/description come from the `feature${key}Title` / `…Desc` strings.
const FEATURES = [
  {
    key: "Nav", // tap target
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: "Zoom", // four-way move arrows
    icon: (
      <svg {...iconProps}>
        <polyline points="5 9 2 12 5 15" />
        <polyline points="9 5 12 2 15 5" />
        <polyline points="15 19 12 22 9 19" />
        <polyline points="19 9 22 12 19 15" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    key: "Lang", // globe
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

// Shown once per browser. A native modal <dialog> gives the top layer, ::backdrop,
// an inert page behind it, focus containment, Esc dismissal and focus return.
export function OnboardingModal() {
  const t = useT();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!readStorage(ONBOARDED_KEY)) dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-dialog glass"
      aria-labelledby="onboarding-title"
      // Fires for the dismiss button and for Esc alike
      onClose={() => writeStorage(ONBOARDED_KEY, "true")}
    >
      <header className="modal-header">
        <h2 id="onboarding-title">{t("welcomeTitle")}</h2>
        <h3>{t("welcomeSubtitle")}</h3>
      </header>

      <p className="modal-desc">{t("welcomeDesc")}</p>

      <ul className="feature-list">
        {FEATURES.map(({ key, icon }) => (
          <li key={key} className="feature-item">
            <div className="feature-icon">{icon}</div>
            <div className="feature-text">
              <h4>{t(`feature${key}Title`)}</h4>
              <p>{t(`feature${key}Desc`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <form method="dialog">
        <button className="btn active dismiss-btn" autofocus>
          {t("dismissOnboarding")}
        </button>
      </form>
    </dialog>
  );
}
