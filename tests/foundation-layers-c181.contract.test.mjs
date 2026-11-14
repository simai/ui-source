import assert from 'node:assert/strict';
import test from 'node:test';
import {code, registerThemeTests, resolveToken, section, tableRows} from './support/foundation-tokens.mjs';

// Foundations standard, layers (owner decision C181 (4); rules C181 (3),
// C173 (7), C59). The Numbers table is resolved against the built core sheet;
// the five layers of the Pending table must keep their decided order on the
// steps they point at: base < sticky < popover < window <= message.

const {doc, sheet, skip} = registerThemeTests(test, assert, {page: 'foundation-layers.md', files: ['core/css/core.css']});

test('foundation-layers.md: the five layers keep their order on today\'s steps (C181 (3))', {skip}, () => {
  const rows = tableRows(section(doc, 'Pending'));
  assert.deepEqual(rows.map((row) => row.layer), ['base', 'sticky', 'popover', 'window', 'message']);
  const value = rows.map((row) => resolveToken(sheet, 'normal', code(row.step)));
  value.forEach((v, i) => assert.equal(typeof v, 'number', `${rows[i].layer}: ${code(rows[i].step)} resolves`));
  for (let i = 1; i < value.length; i++) {
    const strict = rows[i].layer !== 'message';
    assert.ok(strict ? value[i] > value[i - 1] : value[i] >= value[i - 1], `${rows[i - 1].layer} ${value[i - 1]} under ${rows[i].layer} ${value[i]}`);
  }
});

test('foundation-layers.md: the numbered steps rise and the window stack starts above them', () => {
  const rows = tableRows(section(doc, 'Numbers'));
  const steps = rows.filter((row) => /^--sf-z-index--?\d$/u.test(code(row.token))).map((row) => Number(row.normal));
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
  const layer = Number(rows.find((row) => code(row.token) === '--sf-z-index-layer').normal);
  assert.ok(layer > Math.max(...steps));
});
