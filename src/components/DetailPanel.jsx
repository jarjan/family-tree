import { useMemo } from "preact/hooks";
import { t } from "../utils/i18n.js";
import { getRelatives } from "../utils/relations.js";
import "./DetailPanel.css";

export function DetailPanel({ node, allData, onSelect, onClose, isOpen }) {
  const {
    spouseInfo,
    father,
    mother,
    grandparents,
    children,
    grandchildren,
    siblings,
    cousins: uniqueCousins
  } = useMemo(() => getRelatives(allData, node), [allData, node]);


  const RelativeLink = ({ rel }) => {
    if (!rel) return <span>-</span>;
    return (
      <span className="clickable-relative" onClick={() => onSelect(rel.id)}>
        {rel.name} {rel.lastName || ""}
      </span>
    );
  };

  return (
    <div className={`detail-panel glass ${isOpen ? "open" : ""}`}>
      <div className="panel-handle"></div>
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

        {grandparents.length > 0 && (
          <div className="info-group">
            <h4>
              {t("grandparents")} ({grandparents.length})
            </h4>
            <ul className="children-list">
              {grandparents.map((gp) => (
                <li key={gp.id}>
                  <RelativeLink rel={gp} />
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {uniqueCousins.length > 0 && (
          <div className="info-group">
            <h4>
              {t("cousins")} ({uniqueCousins.length})
            </h4>
            <ul className="children-list">
              {uniqueCousins.map((s) => (
                <li key={s.id}>
                  <RelativeLink rel={s} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {spouseInfo.length > 0 && (
          <div className="info-group">
            <h4>{t("spouse")}</h4>
            <ul className="children-list">
              {spouseInfo.map(({ spouse, parents, siblings }) => {
                return (
                  <li key={spouse.id} className="spouse-item">
                    <div className="spouse-main">
                      <RelativeLink rel={spouse} />
                    </div>
                    {parents.length > 0 && (
                      <div className="spouse-relatives">
                        <span className="spouse-relatives-label">{t("spouseParents")}: </span>
                        {parents.map((p, idx) => (
                          <span key={p.id}>
                            <RelativeLink rel={p} />
                            {idx < parents.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {siblings.length > 0 && (
                      <div className="spouse-relatives">
                        <span className="spouse-relatives-label">{t("spouseSiblings")}: </span>
                        {siblings.map((sib, idx) => (
                          <span key={sib.id}>
                            <RelativeLink rel={sib} />
                            {idx < siblings.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
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

        {grandchildren.length > 0 && (
          <div className="info-group">
            <h4>
              {t("grandchildren")} ({grandchildren.length})
            </h4>
            <ul className="children-list">
              {grandchildren.map((gc) => (
                <li key={gc.id}>
                  <RelativeLink rel={gc} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="info-group">
          <h4>{node.notes ? t("notes") : t("detailsTitle")}</h4>
          <p className="bio-text">{node.notes || t("noBio")}</p>
        </div>
      </div>
    </div>
  );
}
