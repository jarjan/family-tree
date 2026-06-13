/**
 * Resolves all relatives for a focal node from the family tree dataset.
 * Unifies the logic used by TreeCanvas and DetailPanel.
 * 
 * @param {Array} data - Complete list of family member nodes.
 * @param {Object} node - The focal node to resolve relatives for.
 * @returns {Object} An object containing resolved relationships.
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
    children: [],
    grandchildren: [],
    paternalAncestors: [],
    paternalUnclesAunts: [],
    maternalUnclesAunts: [],
    spouseInfo: []
  };

  if (!node) return relatives;

  // Spouses (including co-spouses/wives in polygamous structures)
  relatives.spouses = data.filter(
    (d) =>
      d.spouseOf === node.id ||
      (node.spouseOf && d.id === node.spouseOf) ||
      (node.spouseOf && d.spouseOf === node.spouseOf && d.id !== node.id)
  );

  // Direct Parents
  relatives.father = node.fatherId ? data.find((d) => d.id === node.fatherId) : null;
  relatives.mother = node.motherId ? data.find((d) => d.id === node.motherId) : null;

  // Resolve parents (filling missing father/mother if spouse exists)
  let resolvedFather = relatives.father;
  let resolvedMother = relatives.mother;
  if (resolvedFather && !resolvedMother) {
    resolvedMother = data.find((d) => d.spouseOf === resolvedFather.id || (resolvedFather.spouseOf && d.id === resolvedFather.spouseOf));
  } else if (resolvedMother && !resolvedFather) {
    resolvedFather = data.find((d) => d.spouseOf === resolvedMother.id || (resolvedMother.spouseOf && d.id === resolvedMother.spouseOf));
  }
  if (resolvedFather) relatives.parents.push(resolvedFather);
  if (resolvedMother) relatives.parents.push(resolvedMother);

  // Grandparents
  relatives.parents.forEach((p, pIdx) => {
    if (p) {
      const gFather = p.fatherId ? data.find((d) => d.id === p.fatherId) : null;
      let gMother = null;
      if (gFather) {
        gMother = data.find((d) => d.spouseOf === gFather.id || (gFather.spouseOf && d.id === gFather.spouseOf));
      }
      if (gFather) relatives.grandparents.push({ ...gFather, parentIdx: pIdx });
      if (gMother) relatives.grandparents.push({ ...gMother, parentIdx: pIdx });
    }
  });

  // Paternal Line (Ancestors beyond Grandfather)
  if (resolvedFather) {
    const paternalGFId = resolvedFather.fatherId;
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
      d.id !== node.id &&
      ((node.fatherId && d.fatherId === node.fatherId) ||
        (node.motherId && d.motherId === node.motherId))
  );

  // Children
  let children = data.filter(
    (d) => d.fatherId === node.id || d.motherId === node.id
  );
  // If node is female (mother) and no children are found directly, resolve through spouse
  if (node.gender === "female" && children.length === 0) {
    const spouse = data.find(
      (d) => d.spouseOf === node.id || (node.spouseOf && d.id === node.spouseOf)
    );
    if (spouse) {
      children = data.filter((d) => d.fatherId === spouse.id || d.motherId === spouse.id);
    }
  }
  relatives.children = children;

  // Grandchildren
  children.forEach((c) => {
    relatives.grandchildren.push(
      ...data.filter((d) => d.fatherId === c.id || d.motherId === c.id)
    );
  });

  // Uncles & Aunts (for Cousins)
  const paternalUnclesAunts = data.filter(
    (d) =>
      node.fatherId &&
      d.id !== node.fatherId &&
      ((data.find((f) => f.id === node.fatherId)?.fatherId &&
        d.fatherId === data.find((f) => f.id === node.fatherId).fatherId) ||
        (data.find((f) => f.id === node.fatherId)?.motherId &&
          d.motherId === data.find((f) => f.id === node.fatherId).motherId))
  );
  const maternalUnclesAunts = data.filter(
    (d) =>
      node.motherId &&
      d.id !== node.motherId &&
      ((data.find((m) => m.id === node.motherId)?.fatherId &&
        d.fatherId === data.find((m) => m.id === node.motherId).fatherId) ||
        (data.find((m) => m.id === node.motherId)?.motherId &&
          d.motherId === data.find((m) => m.id === node.motherId).motherId))
  );
  relatives.paternalUnclesAunts = paternalUnclesAunts;
  relatives.maternalUnclesAunts = maternalUnclesAunts;

  // Cousins
  const cousins = [];
  [...paternalUnclesAunts, ...maternalUnclesAunts].forEach((ua) => {
    cousins.push(...data.filter((d) => d.fatherId === ua.id || d.motherId === ua.id));
  });
  // Deduplicate cousins
  relatives.cousins = cousins.filter((c, index, self) =>
    self.findIndex((t) => t.id === c.id) === index
  );

  // Spouse Info (parents, siblings for canvas styling)
  relatives.spouseInfo = relatives.spouses.map((sp) => {
    let sFather = sp.fatherId ? data.find((d) => d.id === sp.fatherId) : null;
    let sMother = sp.motherId ? data.find((d) => d.id === sp.motherId) : null;
    if (sFather && !sMother) {
      sMother = data.find((d) => d.spouseOf === sFather.id || (sFather.spouseOf && d.id === sFather.spouseOf));
    } else if (sMother && !sFather) {
      sFather = data.find((d) => d.spouseOf === sMother.id || (sMother.spouseOf && d.id === sMother.spouseOf));
    }
    const sParents = [];
    if (sFather) sParents.push(sFather);
    if (sMother) sParents.push(sMother);

    const sSiblings = data.filter(
      (d) =>
        d.id !== sp.id &&
        ((sp.fatherId && d.fatherId === sp.fatherId) ||
          (sp.motherId && d.motherId === sp.motherId))
    );

    return {
      spouse: sp,
      parents: sParents,
      father: sFather,
      mother: sMother,
      siblings: sSiblings
    };
  });

  relatives.spouse = relatives.spouses;
  return relatives;
}
