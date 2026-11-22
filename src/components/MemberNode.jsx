import { cx, getInitials } from "../utils/person.js";
import "./MemberNode.css";

// A person's card on the canvas. Clicks are handled by TreeCanvas via `data-id`.
export function MemberNode({ data, isSelected }) {
  return (
    <button
      type="button"
      className={cx("member-node", isSelected && "selected", data.gender === "female" && "female")}
      data-id={data.id}
      aria-pressed={isSelected}
    >
      <span className="avatar-placeholder" aria-hidden="true">
        {getInitials(data)}
      </span>
      <span className="name-container">
        <span className="first-name">{data.name}</span>
        {data.lastName && <span className="last-name">{data.lastName}</span>}
      </span>
    </button>
  );
}
