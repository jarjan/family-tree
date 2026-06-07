import { useState, useRef } from "preact/hooks";
import * as d3 from "d3-hierarchy";
import { MemberNode } from "./MemberNode.jsx";
import "./TreeCanvas.css";

export function TreeCanvas({ data, onSelect, selectedId }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const getRelatives = (data, focalNode) => {
    const relatives = {
      focal: focalNode,
      spouse: data.filter(
        (d) =>
          d.spouseOf === focalNode.id ||
          (focalNode.spouseOf && d.id === focalNode.spouseOf) ||
          (focalNode.spouseOf &&
            d.spouseOf === focalNode.spouseOf &&
            d.id !== focalNode.id),
      ),
      parents: [],
      grandparents: [],
      siblings: [],
      cousins: [],
      children: [],
      grandchildren: [],
      paternalAncestors: [],
    };

    // Parents
    let father = focalNode.fatherId ? data.find((d) => d.id === focalNode.fatherId) : null;
    let mother = focalNode.motherId ? data.find((d) => d.id === focalNode.motherId) : null;
    if (father && !mother) {
      mother = data.find((d) => d.spouseOf === father.id || (father.spouseOf && d.id === father.spouseOf));
    } else if (mother && !father) {
      father = data.find((d) => d.spouseOf === mother.id || (mother.spouseOf && d.id === mother.spouseOf));
    }
    if (father) relatives.parents.push(father);
    if (mother) relatives.parents.push(mother);

    // Grandparents
    relatives.parents.forEach((p) => {
      if (p) {
        if (p.fatherId)
          relatives.grandparents.push(data.find((d) => d.id === p.fatherId));
        if (p.motherId)
          relatives.grandparents.push(data.find((d) => d.id === p.motherId));
      }
    });

    // Paternal Line (Ancestors beyond Grandfather)
    const paternalFather = data.find((d) => d.id === focalNode.fatherId);
    if (paternalFather) {
      const paternalGFId = paternalFather.fatherId;
      const paternalGF = data.find((d) => d.id === paternalGFId);
      if (paternalGF) {
        let currentId = paternalGF.fatherId;
        while (currentId) {
          const ancestor = data.find((d) => d.id === currentId);
          if (ancestor) {
            relatives.paternalAncestors.push(ancestor);
            currentId = ancestor.fatherId;
          } else {
            break;
          }
        }
      }
    }

    // Siblings
    relatives.siblings = data.filter(
      (d) =>
        d.id !== focalNode.id &&
        ((focalNode.fatherId && d.fatherId === focalNode.fatherId) ||
          (focalNode.motherId && d.motherId === focalNode.motherId)),
    );

    // Children
    relatives.children = data.filter(
      (d) => d.fatherId === focalNode.id || d.motherId === focalNode.id,
    );

    // Grandchildren
    relatives.children.forEach((c) => {
      relatives.grandchildren.push(
        ...data.filter((d) => d.fatherId === c.id || d.motherId === c.id),
      );
    });

    // Uncles & Aunts (for Cousins)
    const paternalUnclesAunts = data.filter(
      (d) =>
        focalNode.fatherId &&
        d.id !== focalNode.fatherId &&
        ((data.find((f) => f.id === focalNode.fatherId)?.fatherId &&
          d.fatherId ===
            data.find((f) => f.id === focalNode.fatherId).fatherId) ||
          (data.find((f) => f.id === focalNode.fatherId)?.motherId &&
            d.motherId ===
              data.find((f) => f.id === focalNode.fatherId).motherId)),
    );
    const maternalUnclesAunts = data.filter(
      (d) =>
        focalNode.motherId &&
        d.id !== focalNode.motherId &&
        ((data.find((m) => m.id === focalNode.motherId)?.fatherId &&
          d.fatherId ===
            data.find((m) => m.id === focalNode.motherId).fatherId) ||
          (data.find((m) => m.id === focalNode.motherId)?.motherId &&
            d.motherId ===
              data.find((m) => m.id === focalNode.motherId).motherId)),
    );

    [...paternalUnclesAunts, ...maternalUnclesAunts].forEach((ua) => {
      relatives.cousins.push(
        ...data.filter((d) => d.fatherId === ua.id || d.motherId === ua.id),
      );
    });

    // Deduplicate cousins
    relatives.cousins = relatives.cousins.filter((c, index, self) =>
      self.findIndex((t) => t.id === c.id) === index
    );

    relatives.paternalUnclesAunts = paternalUnclesAunts;
    relatives.maternalUnclesAunts = maternalUnclesAunts;

    return relatives;
  };

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

  // 1. Center: Focal Node & Spouse
  allNodes.push({ data: focalNode, x: 0, y: 0 });
  relatives.spouse.forEach((s, i) => {
    const sx = (i + 1) * X_SPACING;
    allNodes.push({ data: s, x: sx, y: 0 });
    // Link to focal (spouse line)
    allLinks.push({
      source: { x: i === 0 ? 0 : i * X_SPACING, y: 0 },
      target: { x: sx, y: 0 },
      isSpouse: true,
    });
  });

  // 2. Parents (Above)
  const parentsY = -Y_SPACING;
  const fatherNode = focalNode.fatherId ? data.find((d) => d.id === focalNode.fatherId) : null;
  relatives.parents.forEach((p, i) => {
    if (!p) return;
    const px = i === 0 ? -X_SPACING / 2 : X_SPACING / 2;
    const isFather = fatherNode && p.id === fatherNode.id;
    allNodes.push({ data: p, x: px, y: parentsY });
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
  relatives.grandparents.forEach((gp, i) => {
    if (!gp) return;
    // Position relative to their children (the parents)
    const parentIdx = relatives.parents.findIndex(
      (p) => p && (gp.id === p.fatherId || gp.id === p.motherId),
    );
    const baseX = parentIdx === 0 ? -X_SPACING / 2 : X_SPACING / 2;
    const gpx =
      baseX + (gp.gender === "female" ? X_SPACING / 3 : -X_SPACING / 3);

    const isPaternalGF = fatherNode && gp.id === fatherNode.fatherId;

    allNodes.push({ data: gp, x: gpx, y: gpY });
    allLinks.push({
      source: { x: gpx, y: gpY },
      target: { x: baseX, y: parentsY },
      isPaternal: isPaternalGF,
    });
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
        allNodes.push({ data: anc, x: baseX, y: currentAncY });
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
    allNodes.push({ data: ua, x: uax, y: parentsY });
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
    allNodes.push({ data: ua, x: uax, y: parentsY });
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
    allNodes.push({ data: sib, x: sibx, y: 0 });
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
    allNodes.push({ data: c, x: cx, y: childrenY });

    // Connect to both parents if they are the focal or focal's spouse
    allLinks.push({
      source: { x: 0, y: 0 },
      target: { x: cx, y: childrenY },
    });
    relatives.spouse.forEach((s, si) => {
      // Since motherId isn't stored in JSON, we assume that if the child is a child of the focalNode,
      // and s is the spouse of the focalNode, s is the other parent of the child.
      const isParentOfChild = c.fatherId === focalNode.id || c.motherId === focalNode.id || c.fatherId === s.id || c.motherId === s.id;
      if (isParentOfChild) {
        allLinks.push({
          source: { x: (si + 1) * X_SPACING, y: 0 },
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

      allNodes.push({ data: gc, x: gcx, y: gchildrenY });
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
        allNodes.push({ data: c, x: cx, y: 0 });

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
        allNodes.push({ data: c, x: cx, y: 0 });
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

  return (
    <div
      className="canvas-container"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <div
        className="canvas-layer"
        style={{
          transform: `translate(calc(50vw + ${transform.x}px), calc(50vh + ${transform.y}px)) scale(${transform.scale})`,
          transition: isDragging.current ? "none" : "transform 0.1s ease",
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
                className={`tree-link ${link.isSpouse ? "spouse-link" : ""} ${link.isPaternal ? "paternal-link" : ""}`}
                style={
                  link.isSpouse ? { strokeDasharray: "4 4", opacity: 0.5 } : {}
                }
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
    </div>
  );
}
