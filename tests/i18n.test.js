import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, setLanguage, currentLanguage } from '../src/utils/i18n.js';

test('i18n - defaults to Kazakh (kk)', () => {
  assert.equal(currentLanguage, 'kk');
});

test('i18n - translates keys to selected language', () => {
  setLanguage('en');
  assert.equal(t('appTitle'), 'Family Tree Heritage');
  
  setLanguage('kk');
  assert.equal(t('appTitle'), 'Шежіре');
});

test('i18n - falls back to the key itself when translation is missing', () => {
  setLanguage('kk');
  assert.equal(t('nonexistentKey'), 'nonexistentKey');
});
