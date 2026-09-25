/**
 * Relationship resolution for the family tree dataset.
 * Shared by TreeCanvas (layout) and DetailPanel (lists).
 */

// Per-dataset lookup tables, built once and reused across calls.
const indexCache = new WeakMap();

function getIndex(data) {
  let index = indexCache.get(data);
  if (index) return index;

  const byId = new Map();
  const childrenOf = new Map(); // parent id -> nodes naming it as fatherId/motherId
  const spousesOf = new Map(); // id -> direct spouses (both directions of spouseOf)

  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(value)) list.push(value);
  };

  for (const d of data) byId.set(d.id, d);
  for (const d of data) {
    if (d.fatherId) push(childrenOf, d.fatherId, d);
    if (d.motherId) push(childrenOf, d.motherId, d);
    if (d.spouseOf && byId.has(d.spouseOf)) {
      push(spousesOf, d.id, byId.get(d.spouseOf));
      push(spousesOf, d.spouseOf, d);
    }
  }

  index = { byId, childrenOf, spousesOf };
  indexCache.set(data, index);
  return index;
}

/** Direct spouses of a person (never co-wives). */
export function spousesOf(data, person) {
  if (!person) return [];
  return getIndex(data).spousesOf.get(person.id) || [];
}

/**
 * Father and mother of a person. A missing parent is inferred from the known
 * parent's spouse, but only when that spouse is unambiguous (exactly one).
 */
export function resolveParents(data, person) {
  const { byId } = getIndex(data);
  let father = person?.fatherId ? byId.get(person.fatherId) || null : null;
  let mother = person?.motherId ? byId.get(person.motherId) || null : null;

  if (father && !mother) {
    const sp = spousesOf(data, father);
    if (sp.length === 1) mother = sp[0];
  } else if (mother && !father) {
    const sp = spousesOf(data, mother);
    if (sp.length === 1) father = sp[0];
  }
  return { father, mother };
}

export function isParentOf(data, parent, child) {
  if (!parent || !child) return false;
  const { father, mother } = resolveParents(data, child);
  return father?.id === parent.id || mother?.id === parent.id;
}

/** Children of a person, including those whose link to them is inferred via a spouse. */
export function childrenOf(data, person) {
  if (!person) return [];
  const { childrenOf: direct } = getIndex(data);
  const result = [...(direct.get(person.id) || [])];
  for (const sp of spousesOf(data, person)) {
    for (const c of direct.get(sp.id) || []) {
      if (!result.includes(c) && isParentOf(data, person, c)) result.push(c);
    }
  }
  return result;
}

/** Full and half siblings (sharing an explicit or inferred parent). */
export function siblingsOf(data, person) {
  if (!person) return [];
  const { father, mother } = resolveParents(data, person);
  const result = [];
  for (const p of [father, mother]) {
    for (const c of childrenOf(data, p)) {
      if (c.id !== person.id && !result.includes(c)) result.push(c);
    }
  }
  return result;
}

/**
 * Resolves all relatives for a focal node.
 *
 * @param {Array} data - Complete list of family member nodes.
 * @param {Object} node - The focal node to resolve relatives for.
 */
export function getRelatives(data, node) {
  const relatives = {
    focal: node,
    spouses: [],
    parents: [],
    father: null,
    mother: null,
    grandparents: [],
    siblings: [],
    cousins: [],
    cousinGroups: [],
    children: [],
    grandchildren: [],
    grandchildGroups: [],
    paternalAncestors: [],
    paternalUnclesAunts: [],
    maternalUnclesAunts: [],
    spouseInfo: [],
  };

  if (!node) return relatives;
  const { byId } = getIndex(data);

  relatives.spouses = spousesOf(data, node);

  const { father, mother } = resolveParents(data, node);
  relatives.father = father;
  relatives.mother = mother;
  if (father) relatives.parents.push(father);
  if (mother) relatives.parents.push(mother);

  // Grandparents, tagged with the index of the parent they belong to
  relatives.parents.forEach((p, parentIdx) => {
    const gp = resolveParents(data, p);
    if (gp.father) relatives.grandparents.push({ ...gp.father, parentIdx });
    if (gp.mother) relatives.grandparents.push({ ...gp.mother, parentIdx });
  });

  // Paternal line beyond the paternal grandfather (guarded against cycles)
  const paternalGF = father?.fatherId ? byId.get(father.fatherId) : null;
  if (paternalGF) {
    const seen = new Set([node.id, father.id, paternalGF.id]);
    let current = paternalGF.fatherId ? byId.get(paternalGF.fatherId) : null;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      relatives.paternalAncestors.push(current);
      current = current.fatherId ? byId.get(current.fatherId) : null;
    }
  }

  relatives.siblings = siblingsOf(data, node);

  relatives.children = childrenOf(data, node);
  const seenGrandchildren = new Set();
  for (const c of relatives.children) {
    const kids = childrenOf(data, c).filter((gc) => !seenGrandchildren.has(gc.id));
    kids.forEach((gc) => seenGrandchildren.add(gc.id));
    if (kids.length) relatives.grandchildGroups.push({ parent: c, children: kids });
    relatives.grandchildren.push(...kids);
  }

  // Uncles & aunts, and their children (first cousins)
  relatives.paternalUnclesAunts = father ? siblingsOf(data, father) : [];
  relatives.maternalUnclesAunts = mother ? siblingsOf(data, mother) : [];

  const seenCousins = new Set();
  const addCousinGroups = (unclesAunts, side) => {
    for (const ua of unclesAunts) {
      const kids = childrenOf(data, ua).filter(
        (c) => c.id !== node.id && !seenCousins.has(c.id)
      );
      kids.forEach((c) => seenCousins.add(c.id));
      if (kids.length) relatives.cousinGroups.push({ parent: ua, side, children: kids });
      relatives.cousins.push(...kids);
    }
  };
  addCousinGroups(relatives.paternalUnclesAunts, "paternal");
  addCousinGroups(relatives.maternalUnclesAunts, "maternal");

  // Spouse's parents and siblings
  relatives.spouseInfo = relatives.spouses.map((sp) => {
    const sParents = resolveParents(data, sp);
    return {
      spouse: sp,
      parents: [sParents.father, sParents.mother].filter(Boolean),
      father: sParents.father,
      mother: sParents.mother,
      siblings: siblingsOf(data, sp),
    };
  });

  return relatives;
}
