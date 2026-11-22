import { useT } from "../utils/i18n.js";
import { cx, fullName, getInitials } from "../utils/person.js";
import "./DetailPanel.css";

function RelativeLink({ person, onSelect }) {
  if (!person) return "-";
  return (
    <button type="button" className="clickable-relative" onClick={() => onSelect(person.id)}>
      {fullName(person)}
    </button>
  );
}

function InfoGroup({ title, children }) {
  return (
    <div className="info-group">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

/** "Title (n)" with a list of links; hidden when empty unless `showEmpty`. */
function RelativeList({ title, people, onSelect, showEmpty = false }) {
  if (!people.length && !showEmpty) return null;
  return (
    <InfoGroup title={`${title} (${people.length})`}>
      {people.length ? (
        <ul className="relative-list">
          {people.map((p) => (
            <li key={p.id}>
              <RelativeLink person={p} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">-</p>
      )}
    </InfoGroup>
  );
}

/** "Label: A, B" line under a spouse. */
function InlineRelatives({ label, people, onSelect }) {
  if (!people.length) return null;
  return (
    <div className="spouse-relatives">
      <span className="spouse-relatives-label">{label}: </span>
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ", "}
          <RelativeLink person={p} onSelect={onSelect} />
        </span>
      ))}
    </div>
  );
}

export function DetailPanel({ node, relatives, onSelect, onClose, isOpen }) {
  const t = useT();
  const { spouseInfo, father, mother, grandparents, children, grandchildren, siblings, cousins } = relatives;

  return (
    <aside className={cx("detail-panel glass", isOpen && "open")} aria-label={t("detailsTitle")}>
      <div className="panel-handle"></div>
      <button className="close-btn btn" onClick={onClose} aria-label={t("close")}>
        ×
      </button>

      <div className="panel-header">
        <div className={cx("panel-avatar", node.gender === "female" && "female")}>{getInitials(node)}</div>
        <h2>{fullName(node)}</h2>
      </div>

      <div className="panel-content">
        {node.birthday && (
          <InfoGroup title={t("born")}>
            <p>{node.birthday}</p>
          </InfoGroup>
        )}

        <InfoGroup title={t("gender")}>
          <p>{node.gender === "female" ? t("female") : t("male")}</p>
        </InfoGroup>

        <RelativeList title={t("grandparents")} people={grandparents} onSelect={onSelect} />

        <InfoGroup title={t("father")}>
          <p>
            <RelativeLink person={father} onSelect={onSelect} />
          </p>
        </InfoGroup>

        <InfoGroup title={t("mother")}>
          <p>
            <RelativeLink person={mother} onSelect={onSelect} />
          </p>
        </InfoGroup>

        <RelativeList title={t("siblings")} people={siblings} onSelect={onSelect} />
        <RelativeList title={t("cousins")} people={cousins} onSelect={onSelect} />

        {spouseInfo.length > 0 && (
          <InfoGroup title={t("spouse")}>
            <ul className="relative-list">
              {spouseInfo.map(({ spouse, parents, siblings }) => (
                <li key={spouse.id} className="spouse-item">
                  <RelativeLink person={spouse} onSelect={onSelect} />
                  <InlineRelatives label={t("spouseParents")} people={parents} onSelect={onSelect} />
                  <InlineRelatives label={t("spouseSiblings")} people={siblings} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </InfoGroup>
        )}

        <RelativeList title={t("children")} people={children} onSelect={onSelect} showEmpty />
        <RelativeList title={t("grandchildren")} people={grandchildren} onSelect={onSelect} />

        <InfoGroup title={node.notes ? t("notes") : t("detailsTitle")}>
          <p className="muted-text">{node.notes || t("noBio")}</p>
        </InfoGroup>
      </div>
    </aside>
  );
}
