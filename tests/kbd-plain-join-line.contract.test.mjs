import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {unfoldModes} from './support/paint-blocks.mjs';

// component.kbd 1.5.1 (admin K-2 acceptance N5): in a plain group the + join
// takes the glyphs' own line, as the plain keys do (line-height: 1). With the
// row's line it stood 20 px tall beside 14 px keys, so sf-search's Ctrl+K group
// was 20 px on Windows and ⌘K's 14 px on a Mac at the same 14 px text.

const root = resolve(import.meta.dirname, '..');
const sheet = readFileSync(resolve(root, 'src/component/kbd/scss/_kbd.scss'), 'utf8');
const passport = JSON.parse(readFileSync(resolve(root, 'src/component/kbd/passport.json'), 'utf8'));
const body = (selector) => {
  const at = sheet.indexOf(`${selector} {`);
  assert.ok(at >= 0, selector);
  const open = at + selector.length + 2;
  return sheet.slice(open, sheet.indexOf('}', open));
};

test('the plain join has the plain keys\' line', () => {
  // C273 splits the mixin by paint and shape mode; unfolded it reads as one (group build 10).
  assert.match(/@mixin plain \{([^}]*)\}/u.exec(unfoldModes(sheet))[1], /line-height: 1;/u);
  for (const selector of [':where(#{$plain-places}) :where(.sf-kbd-join)', ':where(#{said-group(plain)}) > :where(.sf-kbd-join)']) {
    const rule = body(selector);
    assert.match(rule, /display: inline;/u);
    assert.match(rule, /line-height: 1;/u);
  }
  assert.equal(passport.version, '1.7.1'); // group build 9: 1.5.1 moved on by the merged branches or a GB9 patch // C282: 1.5.2 moved on by the language-file patch (Russian is a language file) // group build 11: 1.6.1 moved on by the merged branches or a GB11 merge (fix/c178-findings) // C278: 1.7.0 moved on by the language packs
});
