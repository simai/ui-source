import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {getInitials} from '../src/smart/helpers/text.js';

// One rule for initials (reuse audit 2026-11-02, finding 10): sf-avatar, the
// context menu and the Pro components draw them by helpers/text.js getInitials.

test('initials: two words, skipped words, compound names, empty names', () => {
  assert.equal(getInitials('Анна Смирнова'), 'АС');
  assert.equal(getInitials('anna smirnova'), 'AS');
  assert.equal(getInitials('Отдел по работе с клиентами'), 'ОР', 'a preposition after the first word is skipped');
  assert.equal(getInitials('Жан-Поль'), 'ЖП', 'one hyphenated word reads as its parts');
  assert.equal(getInitials('Mary—Jane'), 'MJ', 'a dash as well');
  assert.equal(getInitials('Анна-Мария Смирнова'), 'АС', 'a name of several words reads by its words');
  assert.equal(getInitials('Анна'), 'А');
  assert.equal(getInitials('  «Анна»  '), 'А', 'punctuation around a word is not a letter');
  assert.equal(getInitials('Design / Ops'), 'DO');
  assert.equal(getInitials('Анна Смирнова Петровна', {maxLetters: 3}), 'АСП');
});

test('initials: an empty name is empty, or the fallback where text must stand', () => {
  assert.equal(getInitials(''), '');
  assert.equal(getInitials('   '), '');
  assert.equal(getInitials(null), '');
  assert.equal(getInitials('', {fallback: '?'}), '?');
  assert.equal(getInitials('— —', {fallback: '?'}), '?');
});

test('initials: a letter is a whole grapheme, surrogate pairs and combining marks kept', () => {
  assert.equal(getInitials('\u{1D504}lice \u{1D505}ob'), '\u{1D504}\u{1D505}', 'letters outside the basic plane');
  assert.equal(getInitials('Éva Nagy'), 'ÉN', 'a combining accent stays with its letter');
  assert.equal(getInitials('istanbul', {locale: 'tr'}), 'İ', 'capitals by the locale\'s rule');
});

test('the context menu draws a header\'s initials by the one rule', () => {
  const template = readFileSync(new URL('../src/smart/menu-context/js/templates/default.js', import.meta.url), 'utf8');
  assert.match(template, /import \{getInitials\} from "\.\.\/\.\.\/\.\.\/helpers\/text"/u);
  assert.doesNotMatch(template, /function initials\(/u);
});
