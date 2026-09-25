import { useState, useRef, useMemo } from "preact/hooks";
import { MemberNode } from "./MemberNode.jsx";
import { useT } from "../utils/i18n.js";
import { getRelatives } from "../utils/relations.js";
import { computeLayout } from "../utils/layout.js";
import "./TreeCanvas.css";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const BUTTON_ZOOM_FACTOR = 1.2;
const WHEEL_ZOOM_INTENSITY = 0.002;
const DRAG_THRESHOLD = 5; // px of movement before a press counts as a drag, not a click

const clampScale = (s) => Math.min(Math.max(MIN_SCALE, s), MAX_SCALE);
const touchDistance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const touchMidpoint = (a, b) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

export function TreeCanvas({ data, onSelect, selectedId, isPanelOpen }) {
  const t = useT();
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const containerRef = useRef(null);
  const canvasLayerRef = useRef(null);
  const gesture = useRef(null); // active drag or pinch
  const suppressClick = useRef(false);

  const focalNode = useMemo(
    () => data.find((d) => d.id === selectedId) || data[0],
    [data, selectedId]
  );

  const { nodes, links } = useMemo(
    () => computeLayout(data, getRelatives(data, focalNode)),
    [data, focalNode]
  );

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
          position: "absolute",
          transform: "translate(-50%, -50%)",
          left: `${node.x}px`,
          top: `${node.y}px`,
          "--z-index": node.data.id === selectedId ? 10 : 1,
        }}
      >
        <MemberNode
          data={node.data}
          isSelected={node.data.id === selectedId}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.data.id);
          }}
        />
      </div>
    ));
  }, [nodes, selectedId, onSelect]);

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

  // --- Pointer handling

  const startDrag = (clientX, clientY) => {
    gesture.current = {
      type: "drag",
      startX: clientX,
      startY: clientY,
      base: transformRef.current,
      moved: false,
    };
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

  const onMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest(".canvas-controls")) return;
    suppressClick.current = false;
    startDrag(e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    if (gesture.current?.type === "drag") moveDrag(e.clientX, e.clientY);
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
    commitTransform(zoomAround(e.clientX, e.clientY, scale));
  };

  const startPinch = (a, b) => {
    const mid = touchMidpoint(a, b);
    gesture.current = {
      type: "pinch",
      startDist: touchDistance(a, b) || 1,
      startMid: mid,
      base: transformRef.current,
      moved: true,
    };
    setInstant(true);
  };

  const onTouchStart = (e) => {
    if (e.target.closest(".canvas-controls")) return;
    if (e.touches.length === 1) {
      suppressClick.current = false;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      startPinch(e.touches[0], e.touches[1]);
    }
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (g.type === "drag" && e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (g.type === "pinch" && e.touches.length === 2) {
      const [a, b] = e.touches;
      const mid = touchMidpoint(a, b);
      const scale = g.base.scale * (touchDistance(a, b) / g.startDist);
      // Zoom around the starting midpoint, then follow the fingers as they pan.
      const zoomed = zoomAround(g.startMid.x, g.startMid.y, scale, g.base);
      applyTransform({
        ...zoomed,
        x: zoomed.x + (mid.x - g.startMid.x),
        y: zoomed.y + (mid.y - g.startMid.y),
      });
    }
  };

  const onTouchEnd = (e) => {
    const wasPinch = gesture.current?.type === "pinch";
    endGesture();
    // Lifting one finger of a pinch continues as a drag with the other.
    if (wasPinch && e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
      gesture.current.moved = true;
      setInstant(true);
    }
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
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endGesture}
      onMouseLeave={endGesture}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        ref={canvasLayerRef}
        className="canvas-layer"
        style={{
          position: "absolute",
          top: "var(--canvas-center-y, 50%)",
          left: "50%",
          transformOrigin: "0 0",
          transform: "translate(var(--tx, 0px), var(--ty, 0px)) scale(var(--scale, 1))",
          transition: "var(--transition-style, transform 0.05s linear)",
          "--tx": `${transform.x}px`,
          "--ty": `${transform.y}px`,
          "--scale": transform.scale,
        }}
      >
        <svg
          className="edges-layer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            overflow: "visible",
          }}
        >
          {renderedLinks}
        </svg>

        <div
          className="nodes-layer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
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
