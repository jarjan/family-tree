import { useState, useRef, useMemo, useEffect } from "preact/hooks";
import { MemberNode } from "./MemberNode.jsx";
import { useT } from "../utils/i18n.js";
import { computeLayout } from "../utils/layout.js";
import "./TreeCanvas.css";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const BUTTON_ZOOM_FACTOR = 1.2;
const WHEEL_ZOOM_INTENSITY = 0.002;
const DRAG_THRESHOLD = 5; // px of movement before a press counts as a drag, not a click
const WHEEL_SETTLE_MS = 150; // quiet time after the last wheel event before committing the zoom

const clampScale = (s) => Math.min(Math.max(MIN_SCALE, s), MAX_SCALE);
const pointDistance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const pointMidpoint = (a, b) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

export function TreeCanvas({ data, relatives, onSelect, selectedId, isPanelOpen }) {
  const t = useT();
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const containerRef = useRef(null);
  const canvasLayerRef = useRef(null);
  const gesture = useRef(null); // active drag or pinch
  const pointers = useRef(new Map()); // active pointerId -> latest { clientX, clientY }
  const suppressClick = useRef(false);
  const wheelTimer = useRef(null);

  useEffect(() => () => clearTimeout(wheelTimer.current), []);

  const focalNode = relatives.focal;

  const { nodes, links } = useMemo(() => computeLayout(data, relatives), [data, relatives]);

  const renderedLinks = useMemo(() => {
    return links.map((link, i) => {
      const midY = (link.source.y + link.target.y) / 2;
      const path = `M ${link.source.x},${link.source.y} C ${link.source.x},${midY} ${link.target.x},${midY} ${link.target.x},${link.target.y}`;
      return (
        <path
          key={`link-${i}`}
          d={path}
          className={`tree-link ${link.isSpouse ? "spouse-link" : ""} ${link.isFocalSpouse ? "focal-spouse-link" : ""} ${link.isPaternal ? "paternal-link" : ""}`}
        />
      );
    });
  }, [links]);

  const renderedNodes = useMemo(() => {
    return nodes.map((node) => (
      <div
        key={`node-${node.data.id}`}
        className="node-wrapper"
        style={{
          left: `${node.x}px`,
          top: `${node.y}px`,
          "--z-index": node.data.id === selectedId ? 10 : 1,
          // Lets a selection change morph each card from its old position to its new one
          viewTransitionName: `node-${node.data.id}`,
        }}
      >
        <MemberNode data={node.data} isSelected={node.data.id === selectedId} />
      </div>
    ));
  }, [nodes, selectedId]);

  // One delegated handler for every card instead of a closure per node.
  const onNodeClick = (e) => {
    const card = e.target.closest("[data-id]");
    if (card) onSelect(card.dataset.id);
  };

  if (!focalNode) return <div className="loading">No Data found.</div>;

  // --- Transform helpers

  // Writes the transform straight to the DOM during gestures (no re-render per frame).
  const applyTransform = (next) => {
    transformRef.current = next;
    const layer = canvasLayerRef.current;
    if (!layer) return;
    layer.style.setProperty("--tx", `${next.x}px`);
    layer.style.setProperty("--ty", `${next.y}px`);
    layer.style.setProperty("--scale", next.scale);
  };

  const commitTransform = (next) => {
    transformRef.current = next;
    setTransform(next);
  };

  const setInstant = (instant) => {
    const layer = canvasLayerRef.current;
    if (!layer) return;
    if (instant) layer.style.setProperty("--transition-style", "none");
    else layer.style.removeProperty("--transition-style");
  };

  // Client coordinates of the canvas origin (where tx = ty = 0 places the focal node).
  const getOrigin = () => {
    const rect = containerRef.current.getBoundingClientRect();
    const layer = canvasLayerRef.current;
    return { x: rect.left + layer.offsetLeft, y: rect.top + layer.offsetTop };
  };

  // Transform that scales to `scale` while keeping the given client point fixed.
  const zoomAround = (clientX, clientY, scale, base = transformRef.current) => {
    const origin = getOrigin();
    const next = clampScale(scale);
    const worldX = (clientX - origin.x - base.x) / base.scale;
    const worldY = (clientY - origin.y - base.y) / base.scale;
    return {
      x: clientX - origin.x - worldX * next,
      y: clientY - origin.y - worldY * next,
      scale: next,
    };
  };

  // --- Pointer handling (mouse, touch and pen through one set of Pointer Events)

  const startDrag = (clientX, clientY, moved = false) => {
    gesture.current = {
      type: "drag",
      startX: clientX,
      startY: clientY,
      base: transformRef.current,
      moved,
    };
    if (moved) setInstant(true);
  };

  const moveDrag = (clientX, clientY) => {
    const g = gesture.current;
    const dx = clientX - g.startX;
    const dy = clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!g.moved) {
      g.moved = true;
      setInstant(true);
    }
    applyTransform({ ...g.base, x: g.base.x + dx, y: g.base.y + dy });
  };

  const startPinch = (a, b) => {
    gesture.current = {
      type: "pinch",
      startDist: pointDistance(a, b) || 1,
      startMid: pointMidpoint(a, b),
      base: transformRef.current,
      moved: true,
    };
    setInstant(true);
  };

  const movePinch = (a, b) => {
    const g = gesture.current;
    const mid = pointMidpoint(a, b);
    const scale = g.base.scale * (pointDistance(a, b) / g.startDist);
    // Zoom around the starting midpoint, then follow the fingers as they pan.
    const zoomed = zoomAround(g.startMid.x, g.startMid.y, scale, g.base);
    applyTransform({
      ...zoomed,
      x: zoomed.x + (mid.x - g.startMid.x),
      y: zoomed.y + (mid.y - g.startMid.y),
    });
  };

  const endGesture = () => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.moved) {
      suppressClick.current = true;
      setInstant(false);
      commitTransform({ ...transformRef.current });
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest(".canvas-controls")) return;
    // A new primary pointer starts a fresh gesture; drop anything left over.
    if (e.isPrimary) pointers.current.clear();
    pointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (pointers.current.size === 1) {
      suppressClick.current = false;
      startDrag(e.clientX, e.clientY);
    } else if (pointers.current.size === 2) {
      const [a, b] = pointers.current.values();
      startPinch(a, b);
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === "drag") {
      moveDrag(e.clientX, e.clientY);
      // Capture only once it is a real drag, so a plain tap still clicks the node under it.
      const el = e.currentTarget;
      if (g.moved && el.isConnected && !el.hasPointerCapture(e.pointerId)) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone (e.g. released outside the window); keep dragging uncaptured.
        }
      }
    } else if (g.type === "pinch" && pointers.current.size === 2) {
      const [a, b] = pointers.current.values();
      movePinch(a, b);
    }
  };

  const onPointerUp = (e) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const wasPinch = gesture.current?.type === "pinch";
    endGesture();
    // Lifting one finger of a pinch continues as a drag with the other.
    if (wasPinch && pointers.current.size === 1) {
      const [rest] = pointers.current.values();
      startDrag(rest.clientX, rest.clientY, true);
    }
  };

  // A drag that ends over a node must not also select it.
  const onClickCapture = (e) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // Trackpad pinch arrives as ctrl+wheel with small deltas; boost it.
    const intensity = e.ctrlKey ? WHEEL_ZOOM_INTENSITY * 5 : WHEEL_ZOOM_INTENSITY;
    const scale = transformRef.current.scale * Math.exp(-deltaY * intensity);
    // Zoom on the DOM per event and commit to state once the wheel settles.
    setInstant(true);
    applyTransform(zoomAround(e.clientX, e.clientY, scale));
    clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      if (!gesture.current) setInstant(false);
      commitTransform({ ...transformRef.current });
    }, WHEEL_SETTLE_MS);
  };

  // --- Controls

  const zoomBy = (factor) => {
    const origin = getOrigin();
    commitTransform(zoomAround(origin.x, origin.y, transformRef.current.scale * factor));
  };

  const resetViewport = () => commitTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${selectedId && isPanelOpen ? "has-selected" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
    >
      <div
        ref={canvasLayerRef}
        className="canvas-layer"
        style={{
          "--tx": `${transform.x}px`,
          "--ty": `${transform.y}px`,
          "--scale": transform.scale,
        }}
      >
        <svg className="edges-layer" aria-hidden="true">
          {renderedLinks}
        </svg>

        <div className="nodes-layer" onClick={onNodeClick}>
          {renderedNodes}
        </div>
      </div>

      <div className="canvas-controls glass">
        <button className="control-btn" onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)} title={t("zoomIn")} aria-label={t("zoomIn")}>
          +
        </button>
        <button className="control-btn" onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)} title={t("zoomOut")} aria-label={t("zoomOut")}>
          −
        </button>
        <button className="control-btn reset-btn" onClick={resetViewport} title={t("resetZoom")} aria-label={t("resetZoom")}>
          ⌖
        </button>
      </div>
    </div>
  );
}
