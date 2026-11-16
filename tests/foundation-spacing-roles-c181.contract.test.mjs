import assert from 'node:assert/strict';
import test from 'node:test';
import {code, readDoc, registerThemeTests, section, tableRows} from './support/foundation-tokens.mjs';

// Foundations standard, spacing roles H1-H6 (owner decision C181 (4); rules
// C69, C76, C77, C99, C105, C106, C109, C144). The Numbers table is resolved
// against the built core sheet; the role table must name the same first token
// per role as the geometry standard's §5, so the two pages cannot part.

const {doc} = registerThemeTests(test, assert, {page: 'foundation-spacing-roles.md', files: ['core/css/core.css']});

test('foundation-spacing-roles.md: six roles, each naming the token the geometry standard names first', () => {
  const roles = tableRows(section(doc, 'Roles'));
  assert.deepEqual(roles.map((row) => row.role), ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const geometry = readDoc('foundation-composition-geometry.md').split('\n');
  for (const row of roles) {
    const line = geometry.find((l) => l.startsWith(`| ${row.role} |`));
    assert.ok(line, `the geometry standard has a row for ${row.role}`);
    const first = line.split('|')[4].match(/`([^`]+)`/u)?.[1];
    assert.equal(code(row.token), first, `${row.role}: this page and the geometry standard name the same token`);
  }
});

test('foundation-spacing-roles.md: every role row of the Numbers table names its role', () => {
  for (const row of tableRows(section(doc, 'Numbers'))) {
    assert.match(row.rule, /\bC\d{2,3}\b/u);
  }
  const numbers = section(doc, 'Numbers');
  for (const role of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']) assert.match(numbers, new RegExp(`\\| C\\d+ ${role} \\|`, 'u'), `${role} has a row`);
});
