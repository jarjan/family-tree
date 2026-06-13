import { useState, useRef } from "preact/hooks";
import * as d3 from "d3-hierarchy";
import { MemberNode } from "./MemberNode.jsx";
import { t } from "../utils/i18n.js";
import { getRelatives } from "../utils/relations.js";
import "./TreeCanvas.css";

export function TreeCanvas({ data, onSelect, selectedId, isPanelOpen }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const touchZoomStartDist = useRef(null);
  const touchZoomStartScale = useRef(1);

  // Default focus node
  const focalNode =
    data.find((d) => d.id === selectedId) ||
    data.find((d) => !d.fatherId) ||
    data[0];

  if (!focalNode) return <div className="loading">No Data found.</div>;

  const relatives = getRelatives(data, focalNode);
  const Y_SPACING = 180;
  const X_SPACING = 280;

  let allNodes = [];
  let allLinks = [];
  const uncleAuntMap = {};

  const renderedIds = new Set();
  const nodePositions = {};

  const addNode = (nodeData, x, y) => {
    nodePositions[nodeData.id] = { x, y };
    if (renderedIds.has(nodeData.id)) return false;
    renderedIds.add(nodeData.id);
    allNodes.push({ data: nodeData, x, y });
    return true;
  };

  const parentsY = -Y_SPACING;

  // 1. Center: Focal Node & Spouse
  addNode(focalNode, 0, 0);

  let currentSpouseX = X_SPACING;
  let lastSpouseX = 0;

  relatives.spouseInfo.forEach((spInfo) => {
    const sx = currentSpouseX + X_SPACING;
    addNode(spInfo.spouse, sx, 0);

    // Link to previous spouse/focal in the spouse chain
    allLinks.push({
      source: { x: lastSpouseX, y: 0 },
      target: { x: sx, y: 0 },
      isSpouse: true,
      isFocalSpouse: true,
    });
    lastSpouseX = sx;

    // Layout spouse's parents (above the spouse)
    const spParents = spInfo.parents;
    spParents.forEach((p, pi) => {
      let px;
      if (spParents.length === 1) {
        px = sx;
      } else {
        px = pi === 0 ? sx - X_SPACING / 2 : sx + X_SPACING / 2;
      }
      addNode(p, px, parentsY);

      allLinks.push({
        source: { x: px, y: parentsY },
        target: { x: sx, y: 0 },
        isPaternal: spInfo.father && p.id === spInfo.father.id,
      });
    });

    // Draw spouse line between spouse's parents if both exist
    if (spParents.length === 2) {
      allLinks.push({
        source: { x: sx - X_SPACING / 2, y: parentsY },
        target: { x: sx + X_SPACING / 2, y: parentsY },
        isSpouse: true,
      });
    }

    // Layout spouse's siblings (to the right of the spouse)
    spInfo.siblings.forEach((sib, sj) => {
      const sibx = sx + (sj + 1) * X_SPACING;
      addNode(sib, sibx, 0);

      // Connect sibling to spouse's parents
      spParents.forEach((p, pi) => {
        let px;
        if (spParents.length === 1) {
          px = sx;
        } else {
          px = pi === 0 ? sx - X_SPACING / 2 : sx + X_SPACING / 2;
        }
        allLinks.push({
          source: { x: px, y: parentsY },
          target: { x: sibx, y: 0 },
        });
      });
    });

    // Advance currentSpouseX for the next spouse (if any)
    currentSpouseX = sx + (spInfo.siblings.length + 1) * X_SPACING;
  });

  // 2. Parents (Above)
  const fatherNode = focalNode.fatherId ? data.find((d) => d.id === focalNode.fatherId) : null;
  relatives.parents.forEach((p, i) => {
    if (!p) return;
    const px = i === 0 ? -X_SPACING / 2 : X_SPACING / 2;
    const isFather = fatherNode && p.id === fatherNode.id;
    addNode(p, px, parentsY);
    allLinks.push({
      source: { x: px, y: parentsY },
      target: { x: 0, y: 0 },
      isPaternal: isFather,
    });
  });

  // Draw spouse line between parents if both exist
  if (relatives.parents.length === 2 && relatives.parents[0] && relatives.parents[1]) {
    allLinks.push({
      source: { x: -X_SPACING / 2, y: parentsY },
      target: { x: X_SPACING / 2, y: parentsY },
      isSpouse: true,
    });
  }

  // 3. Grandparents (Above Parents)
  const gpY = -Y_SPACING * 2;
  const gpGroups = {};
  relatives.grandparents.forEach((gp, i) => {
    if (!gp) return;
    // Position relative to their children (the parents) using precomputed parentIdx
    const parentIdx = gp.parentIdx !== undefined ? gp.parentIdx : -1;
    const grandparentBaseX = parentIdx === 0 ? -X_SPACING : X_SPACING;
    const parentActualX = parentIdx === 0 ? -X_SPACING / 2 : X_SPACING / 2;
    const gpx =
      grandparentBaseX + (gp.gender === "female" ? X_SPACING / 3 : -X_SPACING / 3);

    const isPaternalGF = fatherNode && gp.id === fatherNode.fatherId;

    addNode(gp, gpx, gpY);
    allLinks.push({
      source: { x: gpx, y: gpY },
      target: { x: parentActualX, y: parentsY },
      isPaternal: isPaternalGF,
    });

    if (parentIdx !== -1) {
      if (!gpGroups[parentIdx]) gpGroups[parentIdx] = [];
      gpGroups[parentIdx].push(gp);
    }
  });

  // Draw spouse lines between grandparents if both exist
  Object.keys(gpGroups).forEach((parentIdxStr) => {
    const parentIdx = parseInt(parentIdxStr);
    const gpList = gpGroups[parentIdx];
    if (gpList.length === 2) {
      const grandparentBaseX = parentIdx === 0 ? -X_SPACING : X_SPACING;
      allLinks.push({
        source: { x: grandparentBaseX - X_SPACING / 3, y: gpY },
        target: { x: grandparentBaseX + X_SPACING / 3, y: gpY },
        isSpouse: true,
      });
    }
  });

  // 4. Paternal Line extension (Above Grandparents)
  const paternalFatherNode = fatherNode;
  if (paternalFatherNode) {
    const pGFId = paternalFatherNode.fatherId;
    const pGFNode = allNodes.find((n) => n.data.id === pGFId);
    if (pGFNode) {
      const baseX = pGFNode.x;
      let currentAncY = gpY - Y_SPACING;

      relatives.paternalAncestors.forEach((anc, i) => {
        addNode(anc, baseX, currentAncY);
        const targetY = i === 0 ? gpY : currentAncY + Y_SPACING;
        allLinks.push({
          source: { x: baseX, y: currentAncY },
          target: { x: baseX, y: targetY },
          isPaternal: true,
        });
        currentAncY -= Y_SPACING;
      });
    }
  }

  // 4.5. Uncles & Aunts (Parent Level: Y = -Y_SPACING, further left/right)
  // Paternal Uncles & Aunts (positioned to the left of father)
  relatives.paternalUnclesAunts.forEach((ua, i) => {
    const uax = -X_SPACING / 2 - X_SPACING * (i + 1);
    addNode(ua, uax, parentsY);
    uncleAuntMap[ua.id] = uax;

    // Connect to paternal grandparents (FF/FM)
    relatives.grandparents.forEach((gp) => {
      const isParentOfUA = gp && (ua.fatherId === gp.id || ua.motherId === gp.id);
      if (isParentOfUA) {
        const gpNode = allNodes.find((n) => n.data.id === gp.id);
        if (gpNode) {
          allLinks.push({
            source: { x: gpNode.x, y: gpY },
            target: { x: uax, y: parentsY },
          });
        }
      }
    });
  });

  // Maternal Uncles & Aunts (positioned to the right of mother)
  relatives.maternalUnclesAunts.forEach((ua, i) => {
    const uax = X_SPACING / 2 + X_SPACING * (i + 1);
    addNode(ua, uax, parentsY);
    uncleAuntMap[ua.id] = uax;

    // Connect to maternal grandparents (MF/MM)
    relatives.grandparents.forEach((gp) => {
      const isParentOfUA = gp && (ua.fatherId === gp.id || ua.motherId === gp.id);
      if (isParentOfUA) {
        const gpNode = allNodes.find((n) => n.data.id === gp.id);
        if (gpNode) {
          allLinks.push({
            source: { x: gpNode.x, y: gpY },
            target: { x: uax, y: parentsY },
          });
        }
      }
    });
  });

  // 5. Siblings (Beside Focal)
  relatives.siblings.forEach((sib, i) => {
    const sibx = -X_SPACING - i * X_SPACING;
    addNode(sib, sibx, 0);
    // Connect siblings to parents if parents exist
    relatives.parents.forEach((p, pi) => {
      if (!p) return;
      const px = pi === 0 ? -X_SPACING / 2 : X_SPACING / 2;
      allLinks.push({
        source: { x: px, y: parentsY },
        target: { x: sibx, y: 0 },
      });
    });
  });

  // 5. Children (Below)
  const childrenY = Y_SPACING;
  const childOffset = ((relatives.children.length - 1) * X_SPACING) / 2;
  relatives.children.forEach((c, i) => {
    const cx = i * X_SPACING - childOffset;
    addNode(c, cx, childrenY);

    // Connect to both parents if they are the focal or focal's spouse
    allLinks.push({
      source: { x: 0, y: 0 },
      target: { x: cx, y: childrenY },
    });
    relatives.spouse.forEach((s) => {
      // Since motherId isn't stored in JSON, we assume that if the child is a child of the focalNode,
      // and s is the spouse of the focalNode, s is the other parent of the child.
      const isParentOfChild = c.fatherId === focalNode.id || c.motherId === focalNode.id || c.fatherId === s.id || c.motherId === s.id;
      if (isParentOfChild) {
        const spousePos = nodePositions[s.id] || { x: X_SPACING, y: 0 };
        allLinks.push({
          source: { x: spousePos.x, y: 0 },
          target: { x: cx, y: childrenY },
        });
      }
    });
  });

  // 6. Grandchildren (Below Children)
  const gchildrenY = Y_SPACING * 2;
  // Group grandchildren by their parent's ID to prevent overlapping
  const gchildrenByParent = {};
  relatives.grandchildren.forEach((gc) => {
    const parentId = gc.fatherId || gc.motherId;
    if (parentId) {
      if (!gchildrenByParent[parentId]) {
        gchildrenByParent[parentId] = [];
      }
      gchildrenByParent[parentId].push(gc);
    }
  });

  // Position and render grandchildren
  Object.keys(gchildrenByParent).forEach((parentId) => {
    const gcList = gchildrenByParent[parentId];
    const parentChild = relatives.children.find((c) => c.id === parentId);
    if (!parentChild) return;

    const parentIdx = relatives.children.indexOf(parentChild);
    const parentX = parentIdx * X_SPACING - childOffset;
    
    gcList.forEach((gc, idx) => {
      // Centered coordinate formula (preventing 160px wide node overlaps)
      const spacing = X_SPACING / 1.5;
      const gcx = parentX + (idx - (gcList.length - 1) / 2) * spacing;

      addNode(gc, gcx, gchildrenY);
      allLinks.push({
        source: { x: parentX, y: childrenY },
        target: { x: gcx, y: gchildrenY },
      });
    });
  });

  // 7. Cousins (Below Uncles/Aunts, Y = 0)
  // Group cousins by their parent (Uncle/Aunt) to handle offsets for siblings
  const cousinsByParent = {};
  relatives.cousins.forEach((c) => {
    const parentId = c.fatherId || c.motherId;
    if (parentId) {
      if (!cousinsByParent[parentId]) {
        cousinsByParent[parentId] = [];
      }
      cousinsByParent[parentId].push(c);
    }
  });

  // Now render them
  Object.keys(cousinsByParent).forEach((parentId) => {
    const cousinsList = cousinsByParent[parentId];
    const parentX = uncleAuntMap[parentId];

    // If the parent is rendered, center their children around their X position
    if (parentX !== undefined) {
      cousinsList.forEach((c, idx) => {
        const spacing = X_SPACING / 1.5;
        const cx = parentX + (idx - (cousinsList.length - 1) / 2) * spacing;
        addNode(c, cx, 0);

        // Connect Cousin to Uncle/Aunt parent
        allLinks.push({
          source: { x: parentX, y: parentsY },
          target: { x: cx, y: 0 },
        });
      });
    } else {
      // Fallback if parent is not in the view (should not happen normally since uncles/aunts are computed and rendered)
      cousinsList.forEach((c, idx) => {
        const side = idx % 2 === 0 ? 1 : -1;
        const cx = side * (X_SPACING * 3 + idx * X_SPACING);
        addNode(c, cx, 0);
      });
    }
  });

  // Event handlers
  const onMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    };
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  };
  const onMouseUp = () => (isDragging.current = false);

  const onWheel = (e) => {
    const zoomIntensity = 0.002;
    const newScale = Math.min(
      Math.max(0.1, transform.scale - e.deltaY * zoomIntensity),
      3,
    );
    setTransform((prev) => ({ ...prev, scale: newScale }));
  };

  // Touch event handlers for mobile support (drag and pinch-to-zoom)
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = {
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchZoomStartDist.current = dist;
      touchZoomStartScale.current = transform.scale;
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      }));
    } else if (e.touches.length === 2 && touchZoomStartDist.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchZoomStartDist.current;
      const newScale = Math.min(
        Math.max(0.1, touchZoomStartScale.current * factor),
        3
      );
      setTransform((prev) => ({ ...prev, scale: newScale }));
    }
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    touchZoomStartDist.current = null;
  };

  const zoomIn = () => {
    setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }));
  };

  const zoomOut = () => {
    setTransform((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }));
  };

  const resetViewport = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  return (
    <div
      className={`canvas-container ${selectedId && isPanelOpen ? "has-selected" : ""}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="canvas-layer"
        style={{
          transform: `translate(calc(50vw + ${transform.x}px), calc(var(--canvas-center-y, 50vh) + ${transform.y}px)) scale(${transform.scale})`,
          transition: (isDragging.current || touchZoomStartDist.current) ? "none" : "transform 0.1s ease",
        }}
      >
        <svg
          className="edges-layer"
          style={{ overflow: "visible", position: "absolute", top: 0, left: 0 }}
        >
          {allLinks.map((link, i) => {
            const path = `M ${link.source.x},${link.source.y}
                          C ${link.source.x},${(link.source.y + link.target.y) / 2}
                            ${link.target.x},${(link.source.y + link.target.y) / 2}
                            ${link.target.x},${link.target.y}`;
            return (
              <path
                key={`link-${i}`}
                d={path}
                className={`tree-link ${link.isSpouse ? "spouse-link" : ""} ${link.isFocalSpouse ? "focal-spouse-link" : ""} ${link.isPaternal ? "paternal-link" : ""}`}
              />
            );
          })}
        </svg>

        <div className="nodes-layer">
          {allNodes.map((node, idx) => (
            <div
              key={`node-${node.data.id}-${idx}`}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                gap: "30px",
                zIndex: node.data.id === selectedId ? 10 : 1,
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
          ))}
        </div>
      </div>

      <div className="canvas-controls glass">
        <button className="control-btn" onClick={zoomIn} title={t("zoomIn")}>
          +
        </button>
        <button className="control-btn" onClick={zoomOut} title={t("zoomOut")}>
          −
        </button>
        <button className="control-btn reset-btn" onClick={resetViewport} title={t("resetZoom")}>
          ⌖
        </button>
      </div>
    </div>
  );
}
