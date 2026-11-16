// VP-16 (C14 (3)): the controls on the scrim beside a floating sf-drawer take
// the core role of a control on the scrim -- a round plate, a white glyph,
// hover and press from the state family -- whatever appearance the page gave
// its edge button, and the edge column centres them a button group's gap apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const theme = readFileSync('src/core/scss/_sf_css__theme.scss', 'utf8');
const sheet = readFileSync('src/smart/drawer/scss/_smart__drawer.scss', 'utf8');
const value = (name) => theme.match(new RegExp(`${name}:\\s*([^;]+);`, 'u'))?.[1].trim();

test('VP-16: the scrim-control roles are declared from the glass and the state family', () => {
  assert.equal(value('--sf-scrim-control'), 'var(--sf-surface-media)');
  assert.equal(value('--sf-scrim-control-state-hover'), 'var(--sf-white--alfa-8)');
  assert.equal(value('--sf-scrim-control-state-active'), 'var(--sf-white--alfa-12)');
  assert.equal(value('--sf-on-scrim-control'), 'var(--sf-on-surface-media)');
});

test('VP-16: edge controls draw the scrim-control plate in sf.states, centred, a group gap apart', () => {
  const states = sheet.slice(sheet.lastIndexOf('@layer sf.states {'));
  const edge = ":not([data-sf-drawer-column='true']):not([data-sf-drawer-edge-in-head]) .sf-drawer-edge .sf-icon-button";
  assert.ok(states.includes(`${edge} {`), 'the plate rule');
  assert.match(states, /background-color: var\(--sf-scrim-control\);/u);
  assert.match(states, /background-image: linear-gradient\(var\(--sf-drawer--edge-state\), var\(--sf-drawer--edge-state\)\);/u);
  assert.match(states, /border-radius: var\(--sf-radius-rounded\);/u);
  assert.match(states, /:hover \{\s*--sf-drawer--edge-state: var\(--sf-scrim-control-state-hover\);/u);
  assert.match(states, /:is\(:active, \.active\) \{\s*--sf-drawer--edge-state: var\(--sf-scrim-control-state-active\);/u);
  assert.match(states, /\.sf-icon \{\s*color: var\(--sf-on-scrim-control\);/u);
  assert.match(states, /\.sf-close-icon \{\s*background-color: var\(--sf-on-scrim-control\);/u);
  assert.match(sheet, /\.sf-drawer-edge \{[^}]*align-items: center;\s*gap: var\(--sf-gap--actions\);/u);
  // No raw colour and no media plate of its own beside the role.
  assert.doesNotMatch(sheet, /--sf-surface-media/u);
});
