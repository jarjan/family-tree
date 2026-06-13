import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { slugify, parseAttrs, main } from '../scripts/compile.js';

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
