/* global URL */
// C59 (owner decision 2026-11-11): the tooltip and «?» kinds of the floating
// surfaces. The behaviour is measured in a browser by
// tests/browser/tooltip-kind.browser.mjs; this pins the source shape.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the tooltip opens after 0.5 s of hover, its neighbours at once, a long press on touch', async () => {
  const source = await read('src/component/tooltip/js/_tooltip.js');
  assert.match(source, /const OPEN_DELAY = 500;/);
  assert.match(source, /const GROUP_WINDOW = 300;/);
  assert.match(source, /const TOUCH_SHOWN = 1500;/);
  // One group per page, whatever bundle carries the controller.
  assert.match(source, /Symbol\.for\('sf\.tooltip\.group'\)/);
  assert.match(source, /setTimeout\(\(\) => \{\s*this\.openTimer = 0;/);
  // Touch: the long press, its release click swallowed, no context menu over it.
  assert.match(source, /event\.pointerType !== 'touch'/);
  assert.match(source, /addEventListener\('click', this\.onClickCapture, true\)/);
  assert.match(source, /addEventListener\('contextmenu', this\.onContextMenu\)/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  // Every listener added is removed.
  for (const name of ['pointerdown', 'pointerup', 'pointercancel', 'contextmenu']) {
    assert.match(source, new RegExp(`removeEventListener\\('${name}'`));
  }
});

test('no tooltip draws a frame or a flat tail: the light look takes the window shadow as a filter', async () => {
  const sheet = await read('src/component/tooltip/scss/_css__tooltip.scss');
  const light = sheet.slice(sheet.indexOf('.sf-tooltip--light .sf-tooltip-content {'));
  assert.doesNotMatch(light.slice(0, light.indexOf('}')), /border:|box-shadow:/);
  assert.match(sheet, /\.sf-tooltip\.sf-tooltip--light \{\s*filter: var\(--sf-shadow-overlay-filter\);/);
  const custom = await read('src/component/tooltip/scss/_css__tooltip_custom.scss');
  assert.match(custom, /border: var\(--sf-tooltip-border-width, 0\)/);
});

test('the smart tooltip has no arrow by default and writes a shortcut through kbd', async () => {
  const manifest = JSON.parse(await read('src/smart/tooltip/component.json'));
  assert.equal(manifest.settings.arrow.default, 'none');
  const fixture = JSON.parse(await read('src/smart/tooltip/studio.fixture.json'));
  assert.equal(fixture.props.arrow, 'none');
  const examples = await read('src/smart/tooltip/examples.json');
  assert.doesNotMatch(examples, /Ctrl\s*\+?\s*S/);
  const template = await read('src/smart/tooltip/js/templates/default.js');
  assert.match(template, /shortcutView\(context\.shortcut\)/);
});

test('the «?» window has a shadow and no frame; its button keeps its target over running text', async () => {
  const sheet = await read('src/smart/help-mark/scss/_smart__help_mark.scss');
  assert.match(sheet, /border: var\(--sf-px\) solid var\(--sf-help-mark-border-color, transparent\);/);
  assert.match(sheet, /box-shadow: var\(--sf-shadow-overlay\);/);
  assert.match(sheet, /\.sf-help-mark-button > button \{\s*position: relative;\s*z-index: 1;/);
  const docs = await read('src/smart/help-mark/docs.md');
  assert.doesNotMatch(docs, /<label>[^<]*<sf-help-mark/);
  const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
  const variables = JSON.stringify(contract);
  assert.match(variables, /"name":"--sf-help-mark-border-color","role":"border-color","summary":"[^"]*","default":"transparent"/);
});
