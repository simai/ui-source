import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-drawer 1.16.4 (study VP-5, C157 (7) = C159 (5)): the panel publishes the
// window title step above the body's heading shift, so a head drawn inside the
// body (sf-view-properties) keeps 20 on 24 (a phone 16) and not the shifted h4.
const sheet = readFileSync('src/smart/drawer/scss/_smart__drawer.scss', 'utf8');
const docs = readFileSync('src/smart/drawer/docs.md', 'utf8');
const manifest = JSON.parse(readFileSync('src/smart/drawer/component.json', 'utf8'));

const rule = (selector) => {
  const at = sheet.indexOf(`\n  ${selector} {`);
  assert.ok(at >= 0, `rule ${selector}`);
  return sheet.slice(at, sheet.indexOf('\n  }', at));
};

test('drawer VP-5: the panel sets the title step from the h4 role', () => {
  const panel = rule('.sf-drawer-panel');
  assert.match(panel, /--sf-drawer--title-size: var\(--sf-heading-4--size\);/u);
  assert.match(panel, /--sf-drawer--title-height: var\(--sf-heading-4--height\);/u);
});

test('drawer VP-5: the step is taken above the shift (panel, not body or foot)', () => {
  const shift = sheet.match(/\.sf-drawer-body,\n\s+\.sf-drawer-foot \{([^}]*)\}/u);
  assert.ok(shift);
  assert.doesNotMatch(shift[1], /--sf-drawer--title-/u);
  assert.match(shift[1], /--sf-heading-4--size: var\(--sf-heading-6--size\);/u, 'the content shift stays (r-077)');
});

test('drawer VP-5: the title reads the step', () => {
  const title = rule('.sf-drawer-title');
  assert.match(title, /font-size: var\(--sf-drawer--title-size, var\(--sf-heading-4--size\)\);/u);
  assert.match(title, /line-height: var\(--sf-drawer--title-height, var\(--sf-heading-4--height\)\);/u);
  assert.match(docs, /`--sf-drawer--title-size`/u);
  assert.match(JSON.stringify(manifest['x-decisions']), /version 1\.16\.4 \(2026-11-16, study VP-5/u);
});
