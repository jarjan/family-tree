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
