import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, isSupportedLanguage, DEFAULT_LANGUAGE, dictionaries } from '../src/utils/i18n.js';

test('i18n - defaults to Kazakh (kk)', () => {
  assert.equal(DEFAULT_LANGUAGE, 'kk');
});

test('i18n - translates keys to selected language', () => {
  assert.equal(translate('en', 'appTitle'), "Zharzhan & Mereke's Family Tree");
  assert.equal(translate('kk', 'appTitle'), 'Жаржан мен Мерекенің шежіресі');
});

test('i18n - falls back to the key itself when translation is missing', () => {
  assert.equal(translate('kk', 'nonexistentKey'), 'nonexistentKey');
});

test('i18n - only known languages are supported', () => {
  assert.ok(isSupportedLanguage('en'));
  assert.ok(isSupportedLanguage('kk'));
  assert.ok(!isSupportedLanguage('ru'));
  assert.ok(!isSupportedLanguage('toString'));
});

test('i18n - every language defines the same keys', () => {
  assert.deepEqual(Object.keys(dictionaries.kk).sort(), Object.keys(dictionaries.en).sort());
});
