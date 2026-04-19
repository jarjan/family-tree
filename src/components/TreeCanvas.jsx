import { useState, useRef } from 'preact/hooks';
import * as d3 from 'd3-hierarchy';
import { MemberNode } from './MemberNode.jsx';
import './TreeCanvas.css';

export function TreeCanvas({ data, onSelect, selectedId }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Default focus node
  const focalNode = data.find(d => d.id === selectedId) || data.find(d => !d.parentId) || data[0];

  if (!focalNode) return <div className="loading">No Data found.</div>;

  // 1. Spouses of focal node
  const spouses = data.filter(d => 
    d.spouseOf === focalNode.id || 
    (focalNode.spouseOf && d.id === focalNode.spouseOf) || 
    (focalNode.spouseOf && d.spouseOf === focalNode.spouseOf && d.id !== focalNode.id)
  );

  const focusMembers = [focalNode, ...spouses];
  const H_SPACING = 380;
  
  let allNodes = [];
  let allLinks = [];
  let focusSpouseLines = [];

  const centerOffset = (focusMembers.length - 1) * H_SPACING / 2;

  // 2. Focus nodes mapping
  focusMembers.forEach((member, i) => {
    const fnX = i * H_SPACING - centerOffset;
    allNodes.push({
      data: member,
      x: fnX,
      y: 0,
      isDescendant: false
    });

    if (i > 0) {
      focusSpouseLines.push({
        x1: (i - 1) * H_SPACING - centerOffset,
        y1: 0,
        x2: fnX,
        y2: 0
      });
    }

    // 3. Ancestors going up
    let currentId = member.parentId;
    let currY = -220; // Ancestor spacing Y
    let prevY = 0;
    while (currentId) {
      const parent = data.find(d => d.id === currentId);
      if (!parent) break;

      allNodes.push({
        data: parent,
        x: fnX,
        y: currY,
        isDescendant: false
      });
      
      allLinks.push({
        source: { x: fnX, y: currY }, // parent is source (higher up)
        target: { x: fnX, y: prevY }   // child is target (lower)
      });
      
      prevY = currY;
      currY -= 220;
      currentId = parent.parentId;
    }
  });

  // 4. Descendants
  const buildDescendants = (parentId) => {
    const children = data.filter(d => d.parentId === parentId);
    return children.map(child => {
      // Find spouses of child so they can be grouped locally
      const childSpouses = data.filter(d => d.spouseOf === child.id || (child.spouseOf && d.id === child.spouseOf && d.id !== child.id));
      return {
        ...child,
        spouses: childSpouses,
        children: buildDescendants(child.id)
      };
    });
  };

  const targetParentId = focalNode.spouseOf || focalNode.id;
  const d3Data = { id: 'DUMMY_ROOT', children: buildDescendants(targetParentId) };
  
  if (d3Data.children && d3Data.children.length > 0) {
    const root = d3.hierarchy(d3Data);
    const treeLayout = d3.tree().nodeSize([500, 220]); 
    treeLayout(root);

    root.descendants().slice(1).forEach(node => {
      allNodes.push({
        data: node.data,
        x: node.x,
        y: node.y, // D3 positive y downwards
        isDescendant: true
      });
    });

    root.links().forEach(link => {
      const isDummySource = link.source.data.id === 'DUMMY_ROOT';
      const sourceX = isDummySource ? 0 : link.source.x;
      const sourceY = link.source.y;
      const targetX = link.target.x;
      const targetY = link.target.y;
      
      allLinks.push({
        source: { x: sourceX, y: sourceY },
        target: { x: targetX, y: targetY }
      });
    });
  }

  // Event handlers
  const onMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    }));
  };
  const onMouseUp = () => isDragging.current = false;
  
  const onWheel = (e) => {
    const zoomIntensity = 0.002;
    const newScale = Math.min(Math.max(0.1, transform.scale - e.deltaY * zoomIntensity), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
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
          transition: isDragging.current ? 'none' : 'transform 0.1s ease'
        }}
      >
        <svg className="edges-layer" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
          {focusSpouseLines.map((line, i) => (
            <line 
              key={`spouse-${i}`}
              x1={line.x1} y1={line.y1} 
              x2={line.x2} y2={line.y2} 
              stroke="rgba(255,255,255,0.2)" 
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          ))}
          {allLinks.map((link, i) => {
            const path = `M ${link.source.x},${link.source.y} 
                          C ${link.source.x},${(link.source.y + link.target.y) / 2} 
                            ${link.target.x},${(link.source.y + link.target.y) / 2} 
                            ${link.target.x},${link.target.y}`;
            return <path key={`link-${i}`} d={path} className="tree-link" />;
          })}
        </svg>

        <div className="nodes-layer">
          {allNodes.map((node, idx) => (
            <div 
              key={`node-${node.data.id}-${idx}`} 
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '30px',
                zIndex: node.data.id === selectedId ? 10 : 1
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
              {/* Only descendants render their own spouses via grouping. Focus nodes spouses are top level mapped already. */}
              {node.isDescendant && node.data.spouses?.map(spouse => (
                <div key={spouse.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '-30px', width: '30px', height: '2px', background: 'rgba(255,255,255,0.2)', zIndex: 0 }} />
                  <MemberNode 
                    data={spouse} 
                    isSelected={spouse.id === selectedId}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(spouse.id);
                    }} 
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
