import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

const root = new URL('../', import.meta.url);
const read = async path => withoutPublicVariables(await readFile(new URL(path, root), 'utf8'));
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('Button custom presentation uses semantic design and motion tokens', async () => {
  const [base, custom] = await Promise.all([
    read('src/component/buttons/scss/_css__buttons.scss'),
    read('src/component/buttons/scss/_css__buttons_custom.scss'),
  ]);

  assert.match(base, /--sf-button--radius: var\(--sf-radius--ui\)/);
  assert.match(base, /:focus-visible/);
  assert.match(base, /forced-colors: active/);
  assert.match(custom, /var\(--sf-duration-fast\)/);
  assert.match(custom, /var\(--sf-duration-slow\)/);
  assert.match(custom, /prefers-reduced-motion: reduce/);
  // The loading stripe is one neutral alpha step, not a mix of the variant's roles.
  assert.match(custom, /--sf-button-loading-stripe: var\(--sf-alpha-\d+\)/);
  assert.match(custom, /var\(--sf-px\)/);
  assert.doesNotMatch(custom, /rgba?\(|#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(custom, /\b(?:1|2|4|6|8|12|14|16|20|24|32|52)(?:px|rem)\b|0\.3s|0\.01ms/);
});

test('ordinary and Smart Buttons block duplicate loading actions and hide decorative icons', async () => {
  const [ordinary, smart, template] = await Promise.all([
    read('src/component/buttons/js/_buttons.js'),
    read('src/smart/buttons/index.js'),
    read('src/smart/buttons/js/templates/default.js'),
  ]);

  assert.match(ordinary, /if \(loading\)[\s\S]*this\.button\.disabled = true/);
  assert.match(ordinary, /icon\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(smart, /aria-hidden="true"/);
  assert.match(template, /\?disabled=\$\{disabled \|\| loading\}/);
  assert.match(template, /aria-busy=\$\{loading/);
  assert.match(template, /type=\$\{nativeType\}/);
});

test('Button documentation exposes every supported axis through runnable examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, basic, variants, sizes, icons, states, tightness, radius] = await Promise.all([
    readUiDoc('content/ru/components/actions/buttons.md'),
    readUiDoc('examples/components/buttons/basic/index.html'),
    readUiDoc('examples/components/buttons/variants/index.html'),
    readUiDoc('examples/components/buttons/sizes/index.html'),
    readUiDoc('examples/components/buttons/icons/index.html'),
    readUiDoc('examples/components/buttons/state-loading/index.html'),
    readUiDoc('examples/components/buttons/tightness/index.html'),
    readUiDoc('examples/components/buttons/radius/index.html'),
  ]);
  const examples = [basic, variants, sizes, icons, states, tightness, radius].join('\n');

  // One live example per axis and per state (ui-doc reference page standard):
  // the states page became one example each.
  for (const id of ['basic', 'variants', 'sizes', 'icons', 'state-focus', 'state-active', 'state-disabled', 'state-loading', 'tightness', 'radius']) {
    assert.ok(page.includes(`components/buttons/${id}`));
  }
  assert.match(icons, /class="sf-icon/);
  assert.match(icons, /aria-hidden="true"/);
  assert.match(states, /disabled aria-busy="true"/);
  assert.match(radius, /radius-square/);
  assert.match(radius, /radius-rounded/);
  assert.doesNotMatch(radius, /radius-default/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});
