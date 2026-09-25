import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRelatives } from '../src/utils/relations.js';
import { computeLayout, NODE_GAP } from '../src/utils/layout.js';
import familyData from '../src/data/family.json' with { type: 'json' };

function findOverlaps(nodes) {
  const overlaps = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.y === b.y && Math.abs(a.x - b.x) < NODE_GAP) {
        overlaps.push(`${a.data.id} / ${b.data.id} at y=${a.y}`);
      }
    }
  }
  return overlaps;
}

test('layout - no overlapping cards for any focal person in family.json', () => {
  for (const person of familyData) {
    const { nodes } = computeLayout(familyData, getRelatives(familyData, person));
    assert.deepEqual(findOverlaps(nodes), [], `overlaps when focused on ${person.id}`);
  }
});

test('layout - every person is rendered once and the focal node is centred', () => {
  for (const person of familyData) {
    const { nodes } = computeLayout(familyData, getRelatives(familyData, person));
    const ids = nodes.map(n => n.data.id);
    assert.equal(new Set(ids).size, ids.length, `duplicates when focused on ${person.id}`);
    const focal = nodes.find(n => n.data.id === person.id);
    assert.deepEqual([focal.x, focal.y], [0, 0]);
  }
});

test('layout - links always connect two rendered cards', () => {
  for (const person of familyData) {
    const { nodes, links } = computeLayout(familyData, getRelatives(familyData, person));
    const points = new Set(nodes.map(n => `${n.x},${n.y}`));
    for (const l of links) {
      assert.ok(points.has(`${l.source.x},${l.source.y}`), `dangling link source for ${person.id}`);
      assert.ok(points.has(`${l.target.x},${l.target.y}`), `dangling link target for ${person.id}`);
    }
  }
});

test('layout - with several wives, each child links only to its own mother', () => {
  const data = [
    { id: 'h', name: 'H', gender: 'male' },
    { id: 'w1', name: 'W1', gender: 'female', spouseOf: 'h' },
    { id: 'w2', name: 'W2', gender: 'female', spouseOf: 'h' },
    { id: 'c1', name: 'C1', gender: 'male', fatherId: 'h', motherId: 'w1' },
    { id: 'c2', name: 'C2', gender: 'male', fatherId: 'h', motherId: 'w2' }
  ];
  const { nodes, links } = computeLayout(data, getRelatives(data, data[0]));
  const pos = Object.fromEntries(nodes.map(n => [n.data.id, n]));
  const linked = (from, to) => links.some(l =>
    l.source.x === pos[from].x && l.source.y === pos[from].y &&
    l.target.x === pos[to].x && l.target.y === pos[to].y);

  assert.ok(linked('h', 'c1') && linked('h', 'c2'));
  assert.ok(linked('w1', 'c1'));
  assert.ok(linked('w2', 'c2'));
  assert.ok(!linked('w1', 'c2'), 'wife 1 must not be linked to wife 2\'s child');
  assert.ok(!linked('w2', 'c1'), 'wife 2 must not be linked to wife 1\'s child');
});
