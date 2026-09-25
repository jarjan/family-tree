import { isParentOf } from "./relations.js";

export const Y_SPACING = 180; // vertical distance between generations
export const SLOT = 280; // spacing between main relatives on a row
export const NODE_GAP = 200; // minimum centre-to-centre distance (cards are 160px wide)

/**
 * Pushes nodes on one row apart so no two are closer than NODE_GAP,
 * keeping their left-to-right order and leaving the anchor node in place.
 */
function resolveRow(items, anchorId) {
  if (items.length < 2) return;
  items.sort((a, b) => a.x - b.x);
  let anchor = items.findIndex((it) => it.id === anchorId);
  if (anchor === -1) {
    anchor = 0;
    items.forEach((it, i) => {
      if (Math.abs(it.x) < Math.abs(items[anchor].x)) anchor = i;
    });
  }
  for (let i = anchor + 1; i < items.length; i++) {
    items[i].x = Math.max(items[i].x, items[i - 1].x + NODE_GAP);
  }
  for (let i = anchor - 1; i >= 0; i--) {
    items[i].x = Math.min(items[i].x, items[i + 1].x - NODE_GAP);
  }
}

/**
 * Computes positions for the "family circle" around the focal node.
 *
 * @param {Array} data - Complete dataset (used to test parent/child links).
 * @param {Object} relatives - Output of getRelatives() for the focal node.
 * @returns {{ nodes: Array<{data, x, y}>, links: Array<{source, target, isSpouse, isFocalSpouse, isPaternal}> }}
 */
export function computeLayout(data, relatives) {
  const focal = relatives.focal;
  if (!focal) return { nodes: [], links: [] };

  const rows = new Map(); // y -> [{ id, data, x }]
  const placed = new Map(); // id -> row item
  const linkSpecs = [];

  const place = (nodeData, x, y) => {
    if (!nodeData || placed.has(nodeData.id)) return false;
    const item = { id: nodeData.id, data: nodeData, x, y };
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(item);
    placed.set(nodeData.id, item);
    return true;
  };
  const link = (fromId, toId, flags = {}) => linkSpecs.push({ fromId, toId, ...flags });
  const linkIfParent = (parent, child, flags) => {
    if (isParentOf(data, parent, child)) link(parent.id, child.id, flags);
  };
  const xOf = (id) => placed.get(id)?.x ?? 0;
  const centerOf = (xs) => (xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0);

  const { father, mother, parents } = relatives;
  const parentsY = -Y_SPACING;
  const gpY = -2 * Y_SPACING;

  // --- Row 0: cousins (paternal) · siblings · FOCAL · spouses (+their siblings) · cousins (maternal)
  place(focal, 0, 0);

  let leftX = 0;
  for (const sib of relatives.siblings) {
    leftX -= SLOT;
    place(sib, leftX, 0);
  }

  let rightX = 0;
  let prevSpouseId = focal.id;
  const spouseRow = [];
  for (const info of relatives.spouseInfo) {
    rightX += SLOT;
    if (!place(info.spouse, rightX, 0)) {
      rightX -= SLOT;
      continue;
    }
    spouseRow.push(info);
    link(prevSpouseId, info.spouse.id, { isSpouse: true, isFocalSpouse: true });
    prevSpouseId = info.spouse.id;
    for (const sib of info.siblings) {
      if (place(sib, rightX + SLOT, 0)) rightX += SLOT;
    }
  }

  const cousinCenters = {};
  for (const group of relatives.cousinGroups) {
    const dir = group.side === "maternal" ? 1 : -1;
    const xs = [];
    group.children.forEach((c, i) => {
      const step = i === 0 ? SLOT : NODE_GAP;
      const x = dir > 0 ? rightX + step : leftX - step;
      if (!place(c, x, 0)) return;
      if (dir > 0) rightX = x;
      else leftX = x;
      xs.push(x);
      link(group.parent.id, c.id);
    });
    if (xs.length) cousinCenters[group.parent.id] = centerOf(xs);
  }

  // --- Row -1: uncles/aunts · father · mother · spouse's parents · uncles/aunts
  if (father && mother) {
    place(father, -SLOT / 2, parentsY);
    place(mother, SLOT / 2, parentsY);
    link(father.id, mother.id, { isSpouse: true });
  } else if (parents[0]) {
    place(parents[0], 0, parentsY);
  }
  for (const p of parents) {
    link(p.id, focal.id, { isPaternal: p === father });
    for (const sib of relatives.siblings) linkIfParent(p, sib);
  }

  const placeUnclesAunts = (list, parent, dir) => {
    let k = 0;
    for (const ua of list) {
      const x = cousinCenters[ua.id] ?? (parent ? xOf(parent.id) : 0) + dir * SLOT * ++k;
      place(ua, x, parentsY);
    }
  };
  placeUnclesAunts(relatives.paternalUnclesAunts, father, -1);
  placeUnclesAunts(relatives.maternalUnclesAunts, mother, 1);

  for (const info of spouseRow) {
    const sx = xOf(info.spouse.id);
    const [a, b] = info.parents;
    if (a && b) {
      place(a, sx - SLOT / 2, parentsY);
      place(b, sx + SLOT / 2, parentsY);
      link(a.id, b.id, { isSpouse: true });
    } else if (a) {
      place(a, sx, parentsY);
    }
    for (const p of info.parents) {
      link(p.id, info.spouse.id);
      for (const sib of info.siblings) linkIfParent(p, sib);
    }
  }

  resolveRow(rows.get(parentsY) || [], father?.id ?? parents[0]?.id);

  // --- Row -2: grandparents, one pair above each parent (shifted outward)
  parents.forEach((p, idx) => {
    const gps = relatives.grandparents.filter((gp) => gp.parentIdx === idx);
    const center = xOf(p.id) + (parents.length === 2 ? (idx === 0 ? -SLOT / 2 : SLOT / 2) : 0);
    if (gps.length === 2) {
      place(gps[0], center - SLOT / 2, gpY);
      place(gps[1], center + SLOT / 2, gpY);
      link(gps[0].id, gps[1].id, { isSpouse: true });
    } else if (gps[0]) {
      place(gps[0], center, gpY);
    }
    for (const gp of gps) {
      link(gp.id, p.id, { isPaternal: p === father && gp.id === father.fatherId });
      const unclesAunts = p === father ? relatives.paternalUnclesAunts : relatives.maternalUnclesAunts;
      for (const ua of unclesAunts) linkIfParent(gp, ua);
    }
  });
  resolveRow(rows.get(gpY) || [], father?.fatherId);

  // --- Rows -3 and up: paternal line above the paternal grandfather
  if (father?.fatherId && placed.has(father.fatherId)) {
    const baseX = xOf(father.fatherId);
    let prevId = father.fatherId;
    relatives.paternalAncestors.forEach((anc, i) => {
      place(anc, baseX, gpY - (i + 1) * Y_SPACING);
      link(anc.id, prevId, { isPaternal: true });
      prevId = anc.id;
    });
  }

  // --- Rows +1 / +2: children, each given enough width for its own children
  const childrenY = Y_SPACING;
  const gchildrenY = 2 * Y_SPACING;
  const groupsByChild = new Map(relatives.grandchildGroups.map((g) => [g.parent.id, g.children]));
  const widths = relatives.children.map((c) =>
    Math.max(SLOT, (groupsByChild.get(c.id)?.length || 0) * NODE_GAP + (SLOT - NODE_GAP))
  );
  const total = widths.reduce((a, b) => a + b, 0);
  let cursor = -total / 2;
  relatives.children.forEach((c, i) => {
    const cx = cursor + widths[i] / 2;
    cursor += widths[i];
    if (!place(c, cx, childrenY)) return;
    link(focal.id, c.id);
    for (const sp of relatives.spouses) linkIfParent(sp, c);

    const gcs = groupsByChild.get(c.id) || [];
    gcs.forEach((gc, j) => {
      const gx = cx + (j - (gcs.length - 1) / 2) * NODE_GAP;
      if (place(gc, gx, gchildrenY)) link(c.id, gc.id);
    });
  });

  for (const [y, items] of rows) {
    if (y !== parentsY && y !== gpY) resolveRow(items, y === 0 ? focal.id : undefined);
  }

  const nodes = [...placed.values()].map(({ data: d, x, y }) => ({ data: d, x, y }));
  const links = linkSpecs
    .filter((l) => placed.has(l.fromId) && placed.has(l.toId))
    .map(({ fromId, toId, ...flags }) => {
      const s = placed.get(fromId);
      const t = placed.get(toId);
      return { source: { x: s.x, y: s.y }, target: { x: t.x, y: t.y }, ...flags };
    });

  return { nodes, links };
}
