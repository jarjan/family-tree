import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { slugify, parseAttrs, validateNodes, main } from '../scripts/compile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('slugify - transliterates Cyrillic to clean Latin', () => {
  assert.equal(slugify('Жаржан'), 'zharzhan');
  assert.equal(slugify('Әлім'), 'alim');
  assert.equal(slugify('Құлмұрат'), 'qulmurat');
});

test('slugify - handles special characters and casing', () => {
  assert.equal(slugify('Жаманақ (Шекті)'), 'zhamanaq-shekti');
  assert.equal(slugify('Ата-ана'), 'ata-ana');
  assert.equal(slugify(''), '');
  assert.equal(slugify(null), '');
});

test('parseAttrs - parses key-value pairs', () => {
  const attrsStr = 'id: zharzhan-serik, lastName: Qulmyrza, birthday: 1991-11-03';
  const parsed = parseAttrs(attrsStr);
  assert.deepEqual(parsed, {
    id: 'zharzhan-serik',
    lastName: 'Qulmyrza',
    birthday: '1991-11-03'
  });
});

test('parseAttrs - handles empty inputs', () => {
  assert.deepEqual(parseAttrs(''), {});
  assert.deepEqual(parseAttrs(null), {});
});

test('compiler integration - parses family tree hierarchy and resolves motherId', () => {
  const mockTxtPath = path.join(__dirname, 'mock_family.txt');
  const mockJsonPath = path.join(__dirname, 'mock_family.json');

  const mockContent = `
# Shezhire Mock Data
- Father [id: father-node, lastName: Qulmyrza] (spouse: Mother [lastName: Sartabanova])
  - Son [lastName: Qulmyrza, birthday: 2026-01-01]
  `;

  fs.writeFileSync(mockTxtPath, mockContent, 'utf-8');

  try {
    // Run the compiler using mock overrides
    main(mockTxtPath, mockJsonPath);

    assert.ok(fs.existsSync(mockJsonPath), 'mock_family.json should be created');
    const compiled = JSON.parse(fs.readFileSync(mockJsonPath, 'utf-8'));

    // Should contain 3 nodes: Father, Mother, and Son
    assert.equal(compiled.length, 3);

    const father = compiled.find(n => n.id === 'father-node');
    const mother = compiled.find(n => n.spouseOf === 'father-node');
    const son = compiled.find(n => n.name === 'Son');

    assert.ok(father, 'Father node should exist');
    assert.ok(mother, 'Mother node should exist');
    assert.ok(son, 'Son node should exist');

    assert.equal(son.fatherId, 'father-node', 'Son fatherId should reference Father');
    assert.equal(son.motherId, mother.id, 'Son motherId should resolve to Mother');
  } finally {
    // Clean up temporary files
    if (fs.existsSync(mockTxtPath)) fs.unlinkSync(mockTxtPath);
    if (fs.existsSync(mockJsonPath)) fs.unlinkSync(mockJsonPath);
  }
});

test('parseAttrs - keywords inside free text are not treated as attributes', () => {
  assert.deepEqual(parseAttrs('notes: gender: unknown, lived in id: 5'), {
    notes: 'gender: unknown, lived in id: 5'
  });
  assert.deepEqual(parseAttrs('fatherId: abc, notes: x'), { fatherId: 'abc', notes: 'x' });
});

test('validateNodes - reports duplicate ids, dangling references and bad values', () => {
  const errors = validateNodes([
    { id: 'a', name: 'A', gender: 'male' },
    { id: 'a', name: 'A2' },
    { id: 'b', name: 'B', fatherId: 'missing', gender: 'robot', birthday: '03/11/1991' }
  ]);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /Duplicate id "a"/);
  assert.match(errors.join('\n'), /fatherId "missing"/);
  assert.match(errors.join('\n'), /gender "robot"/);
  assert.match(errors.join('\n'), /birthday "03\/11\/1991"/);
});

test('validateNodes - reports ancestry cycles', () => {
  const errors = validateNodes([
    { id: 'a', name: 'A', fatherId: 'b' },
    { id: 'b', name: 'B', fatherId: 'a' }
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Ancestry cycle/);
});

test('validateNodes - the real family data is valid', async () => {
  const { default: data } = await import('../src/data/family.json', { with: { type: 'json' } });
  assert.deepEqual(validateNodes(data), []);
});

function compileString(content) {
  const txtPath = path.join(__dirname, `tmp_${process.pid}_${Math.random().toString(36).slice(2)}.txt`);
  const jsonPath = txtPath.replace(/\.txt$/, '.json');
  fs.writeFileSync(txtPath, content, 'utf-8');
  try {
    main(txtPath, jsonPath);
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } finally {
    for (const p of [txtPath, jsonPath]) if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

test('compiler - does not guess the mother when the father has several wives', () => {
  const compiled = compileString(`
- Father [id: father] (spouse: Wife One [id: wife-1])
  - Son
- Wife Two [id: wife-2, gender: female, spouseOf: father]
`);
  const son = compiled.find(n => n.name === 'Son');
  assert.equal(son.fatherId, 'father');
  assert.equal(son.motherId, undefined);
});

test('compiler - fails on invalid data instead of writing it', () => {
  assert.throws(
    () => compileString('- A [id: same]\n- B [id: same]\n'),
    /Duplicate id "same"/
  );
});

test('compiler - throws when the source file is missing', () => {
  assert.throws(() => main(path.join(__dirname, 'does-not-exist.txt'), '/dev/null'), /not found/);
});
