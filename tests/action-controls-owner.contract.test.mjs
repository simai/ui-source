/* global URL, process */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ordinary Icon Button creates one safe native icon action', async () => {
  const source = await read('src/component/icon-buttons/js/_icon-buttons.js');

  assert.match(source, /'sf-icon-button--icon'/);
  assert.match(source, /if \(!this\.button\.hasAttribute\('type'\)\)[\s\S]*setAttribute\('type', 'button'\)/);
  assert.match(source, /if \(loading\)[\s\S]*this\.button\.disabled = true/);
  assert.match(source, /icon\.setAttribute\('aria-hidden', 'true'\)/);
});

test('Smart Icon Button mirrors blocked loading and declared composition', async () => {
  const template = await read('src/smart/icon-button/js/templates/default.js');
  const runtime = await read('src/smart/icon-button/index.js');
  const rule = await read('src/smart/icon-button/rule.js');
  const manifest = JSON.parse(await read('src/smart/icon-button/smart.manifest.json'));

  assert.match(template, /\?disabled=\$\{disabled \|\| loading\}/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(runtime, /button\.disabled = this\.disabled \|\| this\.loading/);
  // segment and filled are made from component.json (core/js/element-manifest.js).
  const component = JSON.parse(await read('src/smart/icon-button/component.json'));
  assert.match(runtime, /elementFromManifest\(manifest/);
  assert.deepEqual(component.settings.segment.values, ['', 'start', 'middle', 'end']);
  assert.equal(component.settings.filled.type, 'boolean');
  assert.match(rule, /name: 'cl-close'/);
  // composition.uses is generated from the Loader relations (standard 1.4), sorted:
  // the spinner a loading icon button shows (simai/ui-source#10) and the sheet
  // that places a count or a dot on it (simai/ui-source#12) among them.
  assert.deepEqual(manifest.composition.uses, [
    'component.badges',
    'component.icon-buttons',
    'component.spinner',
    'smart.close',
    'smart.icon',
  ]);
  assert.equal(manifest.accessibility.role, 'button');
  assert.equal(manifest.accessibility.accessible_name, 'required');
  assert.ok(manifest.state.visual_states.includes('loading'));
  assert.ok(manifest.state.visual_states.includes('disabled'));
  assert.equal(manifest.contracts.visual_pairings.type, 'array');
  assert.deepEqual(manifest.contracts.visual_pairings.examples[0], [
    {type: 'default', schemes: ['primary', 'on-surface']},
    {type: 'tonal', schemes: ['secondary', 'on-surface']},
    {type: 'outline', schemes: ['primary', 'on-surface']},
    {type: 'link', schemes: ['primary', 'on-surface']},
  ]);
});

test('FAB constructor keeps generic action attributes and explicit legacy scroll ownership', async () => {
  const source = await read('src/component/fab/js/_fab.js');
  const css = await read('src/component/fab/scss/_css_fab.scss');

  assert.match(source, /size = '1'/);
  assert.match(source, /if \(!this\.button\.hasAttribute\('type'\)\)[\s\S]*setAttribute\('type', 'button'\)/);
  assert.match(source, /icon\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.sf-fab \{[\s\S]*border-width: 0;/);
  assert.match(css, /sf-fab--default\.sf-fab--primary[^{]*:active[\s\S]*--sf-fab--background-color: var\(--sf-primary-active\)/);
  assert.doesNotMatch(css, /\.sf-fab\.sf-fab--default\s*\{/);
  assert.doesNotMatch(css, /\.sf-fab\.sf-fab--tonal\s*\{/);
  assert.match(css, /\.sf-fab\.sf-fab--default\.sf-fab--on-surface\s*\{/);
  assert.match(css, /\.sf-fab\.sf-fab--tonal\.sf-fab--on-surface\s*\{/);
});

test('action documentation covers the complete supported public surface', async () => {
  const root = process.env.UI_DOC_ROOT;
  assert.ok(root, 'UI_DOC_ROOT is required');
  const iconPage = await readFile(`${root}/content/ru/components/actions/icon-buttons.md`, 'utf8');
  const fabPage = await readFile(`${root}/content/ru/components/actions/fab.md`, 'utf8');
  const iconSizes = await readFile(`${root}/examples/components/icon-buttons/sizes/index.html`, 'utf8');
  const iconVariants = await readFile(`${root}/examples/components/icon-buttons/variants/index.html`, 'utf8');
  const iconDisabled = await readFile(`${root}/examples/components/icon-buttons/state-disabled/index.html`, 'utf8');
  const iconPressed = await readFile(`${root}/examples/components/icon-buttons/state-active/index.html`, 'utf8');

  for (const size of ['1/3', '1/2', '1', '2', '3']) {
    assert.match(iconSizes, new RegExp(`sf-icon-button--size-${size.replace('/', '\\/')}`));
  }
  // A running operation keeps the focus on the button: the page tells the
  // reader to use the loading class with aria-busy and aria-disabled, not native
  // disabled, which drops the focus to body (docs trial 5).
  assert.match(iconPage, /### Недоступная[\s\S]*?`loading`, `aria-busy="true"` и\s+`aria-disabled="true"`[\s\S]*?:::example \{id="components\/icon-buttons\/state-disabled"/);
  assert.match(iconDisabled, /<button [^>]*class="sf-icon-button [^"]*"[^>]*aria-label="[^"]+"[^>]* disabled>/);
  assert.match(iconPressed, /aria-pressed="true"/);
  assert.doesNotMatch(iconPage, /`radius-default`.*(?:норм|вариант)/i);
  for (const variant of ['default', 'tonal', 'outline', 'surface', 'link']) {
    assert.match(iconVariants, new RegExp(`sf-icon-button--${variant}\\b`));
    assert.match(iconPage, new RegExp(`\`(?:sf-icon-button--)?${variant}\``));
  }
  assert.match(fabPage, /кнопк[аиу] «наверх»|возврат[а-я ]+начал/i);
});
