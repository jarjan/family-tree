import { useMemo, useRef } from "preact/hooks";
import { MemberNode } from "./MemberNode.jsx";
import { useT } from "../utils/i18n.js";
import { computeLayout } from "../utils/layout.js";
import { cx } from "../utils/person.js";
import "./TreeCanvas.css";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const BUTTON_ZOOM_FACTOR = 1.2;
const WHEEL_ZOOM_INTENSITY = 0.002;
const DRAG_THRESHOLD = 5; // px of movement before a press counts as a drag, not a click

const clampScale = (s) => Math.min(Math.max(MIN_SCALE, s), MAX_SCALE);
const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const midpoint = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

// Vertical S-curve from a parent (or spouse) to a relative.
const linkPath = ({ source: s, target: t }) => {
  const midY = (s.y + t.y) / 2;
  return `M ${s.x},${s.y} C ${s.x},${midY} ${t.x},${midY} ${t.x},${t.y}`;
};

export function TreeCanvas({ data, relatives, onSelect, selectedId, isPanelOpen }) {
  const t = useT();
  const containerRef = useRef(null);
  const layerRef = useRef(null);

  // Pan/zoom is kept out of Preact state and written straight to the layer's CSS
  // variables, so gestures never re-render the tree.
  const view = useRef({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map()); // active pointerId -> latest { clientX, clientY }
  const gesture = useRef(null); // { type: "drag" | "pinch", base, moved, ... }
  const suppressClick = useRef(false);

  const { nodes, links } = useMemo(() => computeLayout(data, relatives), [data, relatives]);

  // --- View transform

  const setView = (next) => {
    view.current = next;
    const { style } = layerRef.current;
    style.setProperty("--tx", `${next.x}px`);
    style.setProperty("--ty", `${next.y}px`);
    style.setProperty("--scale", next.scale);
  };

  // Client coordinates of the canvas origin (where x = y = 0 places the focal node).
  const getOrigin = () => {
    const rect = containerRef.current.getBoundingClientRect();
    const layer = layerRef.current;
    return { x: rect.left + layer.offsetLeft, y: rect.top + layer.offsetTop };
  };

  // View that scales to `scale` while keeping the given client point fixed.
  const zoomAround = (clientX, clientY, scale, base = view.current) => {
    const origin = getOrigin();
    const next = clampScale(scale);
    const worldX = (clientX - origin.x - base.x) / base.scale;
    const worldY = (clientY - origin.y - base.y) / base.scale;
    return { x: clientX - origin.x - worldX * next, y: clientY - origin.y - worldY * next, scale: next };
  };

  const zoomBy = (factor) => {
    const origin = getOrigin();
    setView(zoomAround(origin.x, origin.y, view.current.scale * factor));
  };

  // --- Gestures (mouse, touch and pen through one set of Pointer Events)

  const startDrag = (point, moved = false) => {
    gesture.current = { type: "drag", start: point, base: view.current, moved };
  };

  const startPinch = (a, b) => {
    gesture.current = { type: "pinch", startDist: distance(a, b) || 1, startMid: midpoint(a, b), base: view.current, moved: true };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest(".canvas-controls")) return;
    if (e.isPrimary) pointers.current.clear(); // a fresh gesture; drop anything left over
    pointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (pointers.current.size === 1) {
      suppressClick.current = false;
      startDrag({ clientX: e.clientX, clientY: e.clientY });
    } else if (pointers.current.size === 2) {
      startPinch(...pointers.current.values());
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const g = gesture.current;

    if (g?.type === "drag") {
      const dx = e.clientX - g.start.clientX;
      const dy = e.clientY - g.start.clientY;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        // Capture only once it is a real drag, so a plain tap still clicks the card under it.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone; keep dragging uncaptured.
        }
      }
      setView({ ...g.base, x: g.base.x + dx, y: g.base.y + dy });
    } else if (g?.type === "pinch" && pointers.current.size === 2) {
      const [a, b] = pointers.current.values();
      const mid = midpoint(a, b);
      // Zoom around the starting midpoint, then follow the fingers as they pan.
      const zoomed = zoomAround(g.startMid.x, g.startMid.y, g.base.scale * (distance(a, b) / g.startDist), g.base);
      setView({ ...zoomed, x: zoomed.x + mid.x - g.startMid.x, y: zoomed.y + mid.y - g.startMid.y });
    }
  };

  const onPointerUp = (e) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    gesture.current = null;
    if (g?.moved) suppressClick.current = true;
    // Lifting one finger of a pinch continues as a drag with the other.
    if (g?.type === "pinch" && pointers.current.size === 1) {
      startDrag(pointers.current.values().next().value, true);
    }
  };

  // A drag that ends over a card must not also select it.
  const onClickCapture = (e) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const deltaY = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    // Trackpad pinch arrives as ctrl+wheel with small deltas; boost it.
    const intensity = e.ctrlKey ? WHEEL_ZOOM_INTENSITY * 5 : WHEEL_ZOOM_INTENSITY;
    setView(zoomAround(e.clientX, e.clientY, view.current.scale * Math.exp(-deltaY * intensity)));
  };

  // One delegated handler for every card instead of a closure per card.
  const onNodeClick = (e) => {
    const card = e.target.closest("[data-id]");
    if (card) onSelect(card.dataset.id);
  };

  return (
    <div
      ref={containerRef}
      className={cx("canvas-container", isPanelOpen && "has-selected")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
    >
      <div ref={layerRef} className="canvas-layer">
        <svg className="edges-layer" aria-hidden="true">
          {links.map((link, i) => (
            <path
              key={i}
              d={linkPath(link)}
              className={cx(
                "tree-link",
                link.isSpouse && "spouse-link",
                link.isFocalSpouse && "focal-spouse-link",
                link.isPaternal && "paternal-link",
              )}
            />
          ))}
        </svg>

        <div className="nodes-layer" onClick={onNodeClick}>
          {nodes.map(({ data: person, x, y }) => (
            <div
              key={person.id}
              className="node-wrapper"
              // The name lets a selection change morph each card to its new position
              style={{ left: `${x}px`, top: `${y}px`, viewTransitionName: `node-${person.id}` }}
            >
              <MemberNode data={person} isSelected={person.id === selectedId} />
            </div>
          ))}
        </div>
      </div>

      <div className="canvas-controls glass">
        <button className="control-btn" onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)} title={t("zoomIn")} aria-label={t("zoomIn")}>
          +
        </button>
        <button className="control-btn" onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)} title={t("zoomOut")} aria-label={t("zoomOut")}>
          −
        </button>
        <button className="control-btn reset-btn" onClick={() => setView({ x: 0, y: 0, scale: 1 })} title={t("resetZoom")} aria-label={t("resetZoom")}>
          ⌖
        </button>
      </div>
    </div>
  );
}
