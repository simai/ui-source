import assert from 'node:assert/strict';
import test from 'node:test';
import {cascade, chain, code, registerThemeTests, section, tableRows} from './support/foundation-tokens.mjs';

// Foundations standard, icons (owner decision C181 (4); rules C01, C107,
// C123, C132, C133, C151, C59). The Numbers table is resolved against the
// built core and icons sheets; the Colour table against the icon role's
// light-dark() pair.

const {doc, sheet, skip} = registerThemeTests(test, assert, {
  page: 'foundation-icons.md',
  files: ['core/css/core.css', 'component/icons/css/icons.css'],
});

test('foundation-icons.md: the Colour table holds the built light and dark of each icon role (C107)', {skip}, () => {
  const rows = tableRows(section(doc, 'Colour'));
  assert.ok(rows.length, 'the Colour table has rows');
  const {specified} = cascade(sheet, 1440);
  // the colour roles are declared on the theme class (.theme-light, .theme-dark)
  const declared = specified(chain('normal', '.theme-light'));
  for (const row of rows) {
    const token = code(row.token);
    const value = declared.get(token)?.value;
    assert.ok(value, `${token} is declared on .theme-light`);
    const pair = value.match(/^light-dark\(\s*var\((--[^)]+)\)\s*,\s*var\((--[^)]+)\)\s*\)$/u);
    assert.ok(pair, `${token} is a light-dark() pair: ${value}`);
    assert.deepEqual([pair[1], pair[2]], [code(row.light), code(row.dark)], `${token} light / dark`);
  }
});

test('foundation-icons.md: no icon size is under 12 (C132)', () => {
  for (const row of tableRows(section(doc, 'Numbers'))) {
    for (const scenario of ['normal', 'compact', 'phone']) assert.ok(Number(row[scenario]) >= 12, `${code(row.on) || code(row.token)} ${scenario}`);
  }
});
