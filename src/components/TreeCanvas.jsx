import { useState, useRef, useMemo } from "preact/hooks";
import { MemberNode } from "./MemberNode.jsx";
import { t } from "../utils/i18n.js";
import { getRelatives } from "../utils/relations.js";
import "./TreeCanvas.css";

export function TreeCanvas({ data, onSelect, selectedId, isPanelOpen }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const canvasLayerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const touchZoomStartDist = useRef(null);
  const touchZoomStartScale = useRef(1);

  // Default focus node
  const focalNode = useMemo(() => {
    return data.find((d) => d.id === selectedId) ||
      data.find((d) => !d.fatherId) ||
      data[0];
  }, [data, selectedId]);

  if (!focalNode) return <div className="loading">No Data found.</div>;

  const relatives = useMemo(() => {
    return getRelatives(data, focalNode);
  }, [data, focalNode]);

  const { allNodes, allLinks } = useMemo(() => {
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

    Object.keys(gchildrenByParent).forEach((parentId) => {
      const gcList = gchildrenByParent[parentId];
      const parentChild = relatives.children.find((c) => c.id === parentId);
      if (!parentChild) return;

      const parentIdx = relatives.children.indexOf(parentChild);
      const parentX = parentIdx * X_SPACING - childOffset;
      
      gcList.forEach((gc, idx) => {
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

    Object.keys(cousinsByParent).forEach((parentId) => {
      const cousinsList = cousinsByParent[parentId];
      const parentX = uncleAuntMap[parentId];

      if (parentX !== undefined) {
        cousinsList.forEach((c, idx) => {
          const spacing = X_SPACING / 1.5;
          const cx = parentX + (idx - (cousinsList.length - 1) / 2) * spacing;
          addNode(c, cx, 0);

          allLinks.push({
            source: { x: parentX, y: parentsY },
            target: { x: cx, y: 0 },
          });
        });
      } else {
        cousinsList.forEach((c, idx) => {
          const side = idx % 2 === 0 ? 1 : -1;
          const cx = side * (X_SPACING * 3 + idx * X_SPACING);
          addNode(c, cx, 0);
        });
      }
    });

    return { allNodes, allLinks };
  }, [data, focalNode, relatives]);

  const renderedLinks = useMemo(() => {
    return allLinks.map((link, i) => {
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
    });
  }, [allLinks]);

  const renderedNodes = useMemo(() => {
    return allNodes.map((node, idx) => (
      <div
        key={`node-${node.data.id}-${idx}`}
        className="node-wrapper"
        style={{
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
  }, [allNodes, selectedId, onSelect]);

  // Event handlers
  const onMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - transformRef.current.x,
      y: e.clientY - transformRef.current.y,
    };
    if (canvasLayerRef.current) {
      canvasLayerRef.current.style.setProperty('--transition-style', 'none');
    }
  };

  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    transformRef.current = { ...transformRef.current, x: newX, y: newY };
    if (canvasLayerRef.current) {
      canvasLayerRef.current.style.setProperty('--tx', `${newX}px`);
      canvasLayerRef.current.style.setProperty('--ty', `${newY}px`);
    }
  };

  const onMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.removeProperty('--transition-style');
      }
      setTransform({ ...transformRef.current });
    }
  };

  const onWheel = (e) => {
    const zoomIntensity = 0.002;
    const newScale = Math.min(
      Math.max(0.1, transformRef.current.scale - e.deltaY * zoomIntensity),
      3
    );
    const newTransform = { ...transformRef.current, scale: newScale };
    transformRef.current = newTransform;
    setTransform(newTransform);
  };

  // Touch handlers for mobile
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = {
        x: e.touches[0].clientX - transformRef.current.x,
        y: e.touches[0].clientY - transformRef.current.y,
      };
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.setProperty('--transition-style', 'none');
      }
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchZoomStartDist.current = dist;
      touchZoomStartScale.current = transformRef.current.scale;
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.setProperty('--transition-style', 'none');
      }
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging.current) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      transformRef.current = { ...transformRef.current, x: newX, y: newY };
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.setProperty('--tx', `${newX}px`);
        canvasLayerRef.current.style.setProperty('--ty', `${newY}px`);
      }
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
      transformRef.current = { ...transformRef.current, scale: newScale };
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.setProperty('--scale', newScale);
      }
    }
  };

  const onTouchEnd = () => {
    if (isDragging.current || touchZoomStartDist.current) {
      isDragging.current = false;
      touchZoomStartDist.current = null;
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.removeProperty('--transition-style');
      }
      setTransform({ ...transformRef.current });
    }
  };

  const zoomIn = () => {
    const newTransform = { ...transformRef.current, scale: Math.min(3, transformRef.current.scale + 0.1) };
    transformRef.current = newTransform;
    setTransform(newTransform);
  };

  const zoomOut = () => {
    const newTransform = { ...transformRef.current, scale: Math.max(0.1, transformRef.current.scale - 0.1) };
    transformRef.current = newTransform;
    setTransform(newTransform);
  };

  const resetViewport = () => {
    const newTransform = { x: 0, y: 0, scale: 1 };
    transformRef.current = newTransform;
    setTransform(newTransform);
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
        ref={canvasLayerRef}
        className="canvas-layer"
        style={{
          "--tx": `${transform.x}px`,
          "--ty": `${transform.y}px`,
          "--scale": transform.scale,
        }}
      >
        <svg className="edges-layer">
          {renderedLinks}
        </svg>

        <div className="nodes-layer">
          {renderedNodes}
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
