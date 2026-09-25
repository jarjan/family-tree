import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRelatives } from '../src/utils/relations.js';

// Setup mock family tree data
const mockData = [
  // Generation 1 (Grandparents)
  { id: 'grandfather-pat', name: 'Grandfather Pat', gender: 'male' },
  { id: 'grandmother-pat', name: 'Grandmother Pat', gender: 'female', spouseOf: 'grandfather-pat' },
  
  // Generation 2 (Parents & Uncles/Aunts)
  { id: 'father', name: 'Father', gender: 'male', fatherId: 'grandfather-pat', motherId: 'grandmother-pat' },
  { id: 'mother', name: 'Mother', gender: 'female', spouseOf: 'father' },
  { id: 'uncle-pat', name: 'Uncle Pat', gender: 'male', fatherId: 'grandfather-pat', motherId: 'grandmother-pat' },
  
  // Generation 3 (Focal, Siblings, Cousins)
  { id: 'focal', name: 'Focal', gender: 'male', fatherId: 'father', motherId: 'mother' },
  { id: 'sibling', name: 'Sibling', gender: 'male', fatherId: 'father', motherId: 'mother' },
  { id: 'cousin', name: 'Cousin', gender: 'male', fatherId: 'uncle-pat' },
  
  // Generation 4 (Children)
  { id: 'child', name: 'Child', gender: 'male', fatherId: 'focal' }
];

test('relations - resolves direct parents', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const relatives = getRelatives(mockData, focal);
  
  assert.equal(relatives.father.id, 'father');
  assert.equal(relatives.mother.id, 'mother');
});

test('relations - resolves grandparents', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const relatives = getRelatives(mockData, focal);
  
  const gf = relatives.grandparents.find(g => g.id === 'grandfather-pat');
  const gm = relatives.grandparents.find(g => g.id === 'grandmother-pat');
  
  assert.ok(gf);
  assert.ok(gm);
});

test('relations - resolves siblings', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const relatives = getRelatives(mockData, focal);
  
  assert.equal(relatives.siblings.length, 1);
  assert.equal(relatives.siblings[0].id, 'sibling');
});

test('relations - resolves cousins', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const relatives = getRelatives(mockData, focal);
  
  assert.equal(relatives.cousins.length, 1);
  assert.equal(relatives.cousins[0].id, 'cousin');
});

test('relations - resolves children', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const relatives = getRelatives(mockData, focal);
  
  assert.equal(relatives.children.length, 1);
  assert.equal(relatives.children[0].id, 'child');
});

// Polygamous family: one husband, two wives, children with explicit mothers,
// and a daughter whose child is fathered by someone outside the focal line.
const multiData = [
  { id: 'husband', name: 'Husband', gender: 'male' },
  { id: 'wife-1', name: 'Wife 1', gender: 'female', spouseOf: 'husband' },
  { id: 'wife-2', name: 'Wife 2', gender: 'female', spouseOf: 'husband' },
  { id: 'son-1', name: 'Son 1', gender: 'male', fatherId: 'husband', motherId: 'wife-1' },
  { id: 'son-2', name: 'Son 2', gender: 'male', fatherId: 'husband', motherId: 'wife-2' },
  { id: 'daughter', name: 'Daughter', gender: 'female', fatherId: 'husband', motherId: 'wife-1' },
  { id: 'son-in-law', name: 'Son-in-law', gender: 'male' },
  { id: 'granddaughter', name: 'Granddaughter', gender: 'female', fatherId: 'son-in-law', motherId: 'daughter' }
];
const byId = (id) => multiData.find(n => n.id === id);

test('relations - co-wives are not listed as spouses', () => {
  const rel = getRelatives(multiData, byId('wife-1'));
  assert.deepEqual(rel.spouses.map(s => s.id), ['husband']);
});

test('relations - husband lists every wife', () => {
  const rel = getRelatives(multiData, byId('husband'));
  assert.deepEqual(rel.spouses.map(s => s.id).sort(), ['wife-1', 'wife-2']);
});

test('relations - each wife only gets her own children', () => {
  const rel1 = getRelatives(multiData, byId('wife-1'));
  assert.deepEqual(rel1.children.map(c => c.id).sort(), ['daughter', 'son-1']);
  const rel2 = getRelatives(multiData, byId('wife-2'));
  assert.deepEqual(rel2.children.map(c => c.id), ['son-2']);
});

test('relations - half-siblings are siblings', () => {
  const rel = getRelatives(multiData, byId('son-1'));
  assert.deepEqual(rel.siblings.map(s => s.id).sort(), ['daughter', 'son-2']);
});

test('relations - grandchildren through a daughter are grouped under her', () => {
  const rel = getRelatives(multiData, byId('husband'));
  assert.deepEqual(rel.grandchildren.map(g => g.id), ['granddaughter']);
  assert.equal(rel.grandchildGroups.length, 1);
  assert.equal(rel.grandchildGroups[0].parent.id, 'daughter');
});

test('relations - mother is not inferred when the father has several wives', () => {
  const data = [
    ...multiData,
    { id: 'son-3', name: 'Son 3', gender: 'male', fatherId: 'husband' }
  ];
  const rel = getRelatives(data, data.find(n => n.id === 'son-3'));
  assert.equal(rel.father.id, 'husband');
  assert.equal(rel.mother, null);
});

test('relations - cousins are grouped by their parent', () => {
  const focal = mockData.find(n => n.id === 'focal');
  const rel = getRelatives(mockData, focal);
  assert.equal(rel.cousinGroups.length, 1);
  assert.equal(rel.cousinGroups[0].parent.id, 'uncle-pat');
  assert.equal(rel.cousinGroups[0].side, 'paternal');
});

test('relations - an ancestry cycle does not hang', () => {
  const data = [
    { id: 'a', name: 'A', fatherId: 'd' },
    { id: 'b', name: 'B', fatherId: 'a' },
    { id: 'c', name: 'C', fatherId: 'b' },
    { id: 'd', name: 'D', fatherId: 'c' },
    { id: 'e', name: 'E', fatherId: 'd' }
  ];
  const rel = getRelatives(data, data.find(n => n.id === 'e'));
  assert.ok(rel.paternalAncestors.length <= data.length);
});
