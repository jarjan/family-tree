import { t } from "../utils/i18n.js";
import "./DetailPanel.css";

export function DetailPanel({ node, allData, onSelect, onClose }) {
  const spouses = allData.filter(
    (d) => d.spouseOf === node.id || (node.spouseOf && d.id === node.spouseOf),
  );

  const father = allData.find((d) => d.id === node.fatherId);
  const mother = allData.find((d) => d.id === node.motherId);

  const children = allData.filter(
    (d) => d.fatherId === node.id || d.motherId === node.id,
  );

  const siblings = allData.filter(
    (d) =>
      d.id !== node.id &&
      ((node.fatherId && d.fatherId === node.fatherId) ||
        (node.motherId && d.motherId === node.motherId)),
  );

  const RelativeLink = ({ rel }) => {
    if (!rel) return <span>-</span>;
    return (
      <span className="clickable-relative" onClick={() => onSelect(rel.id)}>
        {rel.name} {rel.lastName || ""}
      </span>
    );
  };

  return (
    <div className="detail-panel glass">
      <button className="close-btn btn" onClick={onClose}>
        ×
      </button>

      <div className="panel-header">
        <div
          className={`panel-avatar ${node.gender === "female" ? "female" : ""}`}
        >
          {node.lastName
            ? `${node.name.charAt(0)}${node.lastName.charAt(0)}`.toUpperCase()
            : node.name.substring(0, 2).toUpperCase()}
        </div>
        <h2>
          {node.name} {node.lastName || ""}
        </h2>
      </div>

      <div className="panel-content">
        {node.birthday && (
          <div className="info-group">
            <h4>{t("born")}</h4>
            <p>{node.birthday}</p>
          </div>
        )}

        <div className="info-group">
          <h4>{t("gender")}</h4>
          <p>{node.gender === "female" ? t("female") : t("male")}</p>
        </div>

        <div className="info-group">
          <h4>{t("father")}</h4>
          <p>
            <RelativeLink rel={father} />
          </p>
        </div>

        <div className="info-group">
          <h4>{t("mother")}</h4>
          <p>
            <RelativeLink rel={mother} />
          </p>
        </div>

        {siblings.length > 0 && (
          <div className="info-group">
            <h4>
              {t("siblings")} ({siblings.length})
            </h4>
            <ul className="children-list">
              {siblings.map((s) => (
                <li key={s.id}>
                  <RelativeLink rel={s} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {spouses.length > 0 && (
          <div className="info-group">
            <h4>{t("spouse")}</h4>
            <ul className="children-list">
              {spouses.map((s) => (
                <li key={s.id}>
                  <RelativeLink rel={s} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="info-group">
          <h4>
            {t("children")} ({children.length})
          </h4>
          {children.length > 0 ? (
            <ul className="children-list">
              {children.map((c) => (
                <li key={c.id}>
                  <RelativeLink rel={c} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">-</p>
          )}
        </div>

        <div className="info-group">
          <h4>{node.notes ? t("notes") : t("detailsTitle")}</h4>
          <p className="bio-text">{node.notes || t("noBio")}</p>
        </div>
      </div>
    </div>
  );
}
