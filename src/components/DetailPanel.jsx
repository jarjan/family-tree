import { t } from "../utils/i18n.js";
import "./DetailPanel.css";

export function DetailPanel({ node, allData, onSelect, onClose }) {
  const spouses = allData.filter(
    (d) => d.spouseOf === node.id || (node.spouseOf && d.id === node.spouseOf),
  );

  const father = allData.find((d) => d.id === node.fatherId);
  const mother = allData.find((d) => d.id === node.motherId);

  const grandparents = [];
  if (father) {
    const ff = allData.find((d) => d.id === father.fatherId);
    const fm = allData.find((d) => d.id === father.motherId);
    if (ff) grandparents.push(ff);
    if (fm) grandparents.push(fm);
  }
  if (mother) {
    const mf = allData.find((d) => d.id === mother.fatherId);
    const mm = allData.find((d) => d.id === mother.motherId);
    if (mf) grandparents.push(mf);
    if (mm) grandparents.push(mm);
  }

  let children = allData.filter(
    (d) => d.fatherId === node.id || d.motherId === node.id,
  );

  // If node is female (mother) and no children are found directly, resolve children through her spouse
  if (node.gender === "female" && children.length === 0) {
    const spouse = allData.find((d) => d.spouseOf === node.id || (node.spouseOf && d.id === node.spouseOf));
    if (spouse) {
      children = allData.filter((d) => d.fatherId === spouse.id || d.motherId === spouse.id);
    }
  }

  const grandchildren = [];
  children.forEach((c) => {
    grandchildren.push(...allData.filter((d) => d.fatherId === c.id || d.motherId === c.id));
  });

  const siblings = allData.filter(
    (d) =>
      d.id !== node.id &&
      ((node.fatherId && d.fatherId === node.fatherId) ||
        (node.motherId && d.motherId === node.motherId)),
  );

  // Uncles & Aunts (for Cousins)
  const paternalUnclesAunts = allData.filter(
    (d) =>
      node.fatherId &&
      d.id !== node.fatherId &&
      ((allData.find((f) => f.id === node.fatherId)?.fatherId &&
        d.fatherId === allData.find((f) => f.id === node.fatherId).fatherId) ||
        (allData.find((f) => f.id === node.fatherId)?.motherId &&
          d.motherId === allData.find((f) => f.id === node.fatherId).motherId))
  );
  const maternalUnclesAunts = allData.filter(
    (d) =>
      node.motherId &&
      d.id !== node.motherId &&
      ((allData.find((m) => m.id === node.motherId)?.fatherId &&
        d.fatherId === allData.find((m) => m.id === node.motherId).fatherId) ||
        (allData.find((m) => m.id === node.motherId)?.motherId &&
          d.motherId === allData.find((m) => m.id === node.motherId).motherId))
  );

  const cousins = [];
  [...paternalUnclesAunts, ...maternalUnclesAunts].forEach((ua) => {
    cousins.push(...allData.filter((d) => d.fatherId === ua.id || d.motherId === ua.id));
  });

  const uniqueCousins = cousins.filter((c, index, self) =>
    self.findIndex((t) => t.id === c.id) === index
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
