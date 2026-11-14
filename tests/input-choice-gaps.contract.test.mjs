// sf-input-choice gaps inside a card (owner C68 and C72, DEV C71, 2026-11-12):
// a quarter step from the name to the description, a wrapped badge with the
// same 4 above it, and the icon as far from the name as sf-button size 1 puts
// its text from its icon. Measured on the built bytes by ui-control evidence
// 2026-11-12-input-choice-c68-c71.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/smart/input-choice/scss/_smart__choice.scss', import.meta.url), 'utf8');
const rule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, selector);
  return css.slice(at, css.indexOf('}', at));
};

test('the name and the description are a quarter step apart, as a wrapped badge and the name', () => {
  assert.match(rule('.sf-choice .sf-choice-body'), /row-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(rule('.sf-choice .sf-choice-title'), /gap: var\(--sf-space-1\\\/4\) var\(--sf-space-1\\\/3\);/u);
});

test('the icon is as far from the name as the text of sf-button size 1 from its icon', () => {
  assert.match(rule('.sf-choice .sf-choice-icon'), /margin-inline-end: calc\(var\(--sf-ui-1--text-space-x\) - var\(--sf-space-1\\\/3\)\);/u);
  const buttons = readFileSync(new URL('../src/component/buttons/scss/_css__buttons.scss', import.meta.url), 'utf8');
  assert.match(buttons, /--sf-button-text-container--padding-inline-start: var\(--sf-ui-1--text-space-x\);/u);
});

test('the name stays beside its icon in a narrow tile', () => {
  assert.match(rule('.sf-choice .sf-choice-icon + .sf-choice-title-text'), /max-inline-size: calc\(100% - var\(--sf-text-height-1\) - var\(--sf-ui-1--text-space-x\)\);/u);
});

// DEV return of C72 (ui-control evidence 2026-11-12-input-choice-c72-r2): the
// room beside the icon split «Бизнес» into «Бизне / с» in a 154.7 px tile.
test('a tile name breaks only between words, never inside one', () => {
  assert.match(rule('.sf-choice .sf-choice-title-text'), /overflow-wrap: break-word;/u);
  assert.doesNotMatch(rule('.sf-choice .sf-choice-title-text'), /overflow-wrap: anywhere/u);
  assert.match(rule(".sf-choice:not([data-layout='list']) .sf-choice-title-text"), /min-inline-size: min-content;/u);
});

// The same in layout terms, at the tile widths DEV measured (1440: 640 and 480
// fields, compact 480, phone 480): the name box is never narrower than its
// longest word, so the line it stands on is the one that gives way. The room
// beside the icon is the title less the icon (--sf-text-height-1) and the text
// space (--sf-ui-1--text-space-x); word widths are Inter 16/14 medium as measured.
test('at the measured tile widths no word is narrower than its box, so none is split', () => {
  const box = ({title, icon, space, words}) => {
    const room = title - icon - space;
    const longest = Math.max(...words);
    const name = Math.max(longest, Math.min(words.reduce((a, b) => a + b, 0), room));
    return {beside: longest <= room, name};
  };
  const cases = [
    {where: '1440 field 480 «Бизнес»', title: 84.7, icon: 24, space: 8, words: [56.2], beside: false},
    {where: '1440 field 480 «Корпорация»', title: 84.7, icon: 24, space: 8, words: [96.8], beside: false},
    {where: '1440 field 640 «Бизнес»', title: 138, icon: 24, space: 8, words: [56.2], beside: true},
    {where: '1440 compact field 480 «Корпорация»', title: 102, icon: 20, space: 7, words: [84.7], beside: false},
    {where: '1440 compact field 480 «Бизнес»', title: 102, icon: 20, space: 7, words: [49.2], beside: true},
  ];
  for (const c of cases) {
    const r = box(c);
    assert.equal(r.beside, c.beside, c.where);
    for (const w of c.words) assert.ok(r.name >= w, `${c.where}: the name box ${r.name} holds the word ${w}`);
  }
});
