import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = (file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
for (const [name, file] of [
  ['checkbox', '_css__checkbox.scss'], ['radio', '_css_radio.scss'],
  ['switch', '_css_switch.scss'], ['toggle', '_css_toggle.scss'],
]) {
  test(`${name}: keyboard-only visual focus and high-contrast fallback`, async () => {
    const css = await source(`component/${name}/scss/${file}`);
    assert.doesNotMatch(css, /:focus(?![\w-])/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
    assert.match(css, /outline:\s*var\(--sf-focus-outline-width\) solid currentColor/);
    assert.match(css, /forced-color-adjust:\s*none/);
    assert.match(css, /background-color:\s*Highlight/);
    assert.match(css, /(?:background-color|color):\s*GrayText/);
  });
}

test('checkbox error preserves focus; compact control uses the UI radius', async () => {
  const css = await source('component/checkbox/scss/_css__checkbox.scss');
  assert.match(css, /\.sf-checkbox:has\(input:not\(:disabled\):not\(\.disabled\):focus-visible\) \.sf-checkbox-box/);
  assert.doesNotMatch(css, /var\(--sf-radius-default\)/);
  assert.match(css, /var\(--sf-radius--ui\)/);
});

test('checkbox state indicator supports both direct icons and Smart icon wrappers', async () => {
  const css = await source('component/checkbox/scss/_css__checkbox.scss');
  assert.match(css, /:has\(input:checked\) > \.sf-checkbox-box \.sf-icon/);
  assert.match(css, /:has\(input:indeterminate\):not\(:has\(input:disabled\)\) > \.sf-checkbox-box \.sf-icon/);
  assert.doesNotMatch(css, /> \.sf-checkbox-box > \.sf-icon/);
});

test('Switch never hides the native checkbox from the accessibility tree', async () => {
  const js = await source('component/switch/js/_switch.js');
  // Execute the production state synchronizer, not a duplicate implementation.
  const code = js.slice(js.indexOf('function getSwitchNodes'), js.indexOf('function bindSwitch'));
  const node = () => ({
    attributes: new Map(), classList: { toggle() {} },
    setAttribute(k, v) { this.attributes.set(k, v); },
    removeAttribute(k) { this.attributes.delete(k); },
  });
  const input = { checked: true, disabled: false };
  const toggler = node(), inner = node();
  toggler.setAttribute('aria-hidden', 'true');
  const nodes = { 'input[type="checkbox"]': input, '.sf-switch-toggler': toggler, '.sf-switch-inner': inner };
  const root = { querySelector: (s) => nodes[s], dataset: {}, classList: { toggle() {} } };
  vm.runInNewContext(`${code}\nsyncSwitchState(root);`, { root });
  assert.equal(toggler.attributes.has('aria-hidden'), false);
  assert.equal(inner.attributes.get('aria-hidden'), 'true');
  assert.equal(input.checked, true);
});

test('long selection labels can wrap without shrinking the indicator', async () => {
  for (const [kind, file] of [
    ['switch', '_css_switch_custom.scss'], ['radio', '_css_radio_custom.scss'],
    ['checkbox', '_custom__checkbox.scss'], ['toggle', '_css_toggle_custom.scss'],
  ]) {
    const css = await source(`component/${kind}/scss/${file}`);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /flex-shrink:\s*0/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(css, /white-space:.*nowrap/);
  }
});

test('Toggle off-state has a role-colored boundary and visible simple/icon thumb', async () => {
  const css = await source('component/toggle/scss/_css_toggle.scss');
  assert.match(css, /outline: var\(--sf-px\) solid var\(--sf-toggle-container--outline-color, var\(--sf-toggle-border-color, var\(--sf-outline\)\)\)/);
  assert.match(css, /\.sf-toggle\.sf-toggle--simple \.sf-toggle-inner \{\s*--sf-toggle-inner--background-color: var\(--sf-on-surface-variant\)/);
  assert.match(css, /\.sf-toggle\.sf-toggle--icon \.sf-toggle-inner-wrap \{\s*--sf-toggle-inner-wrap--background-color: var\(--sf-on-surface-variant\)/);
  assert.match(css, /--sf-toggle-container--outline-color: var\(--sf-outline-disable\)/);
});
