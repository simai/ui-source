import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { withoutPublicVariables } from './support/public-variables.mjs';

const source = async (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
// The sheet as it was before the public variables (2026-10-25): each wraps the
// value it falls back to, and these contracts hold those values.
const sheet = async () =>
  withoutPublicVariables(await source('src/component/accordion/scss/_css__accordion.scss'));

test('accordion uses a dedicated trigger and preserves the legacy contract', async () => {
  const behavior = await source('src/component/accordion/js/_accordion.js');

  assert.match(behavior, /\.sf-accordion-trigger/);
  assert.match(behavior, /this\.trigger === this\.el/);
  assert.match(behavior, /aria-controls/);
  assert.match(behavior, /aria-expanded/);
  assert.match(behavior, /event\.key !== 'Enter'/);
  assert.match(behavior, /ACCORDION_GROUP_SELECTOR = '\.sf-accordion-group'/);
  assert.match(behavior, /getAttribute\('data-mode'\) === 'single'/);
  assert.match(behavior, /data-sf-accordion-mode="single"/);
  assert.match(behavior, /singleModeGroup/);
  assert.match(behavior, /:scope > \.sf-accordion/);
  assert.match(behavior, /closeSingleModeSiblings/);
  assert.match(behavior, /PLUS_MINUS_MODIFIER = 'sf-accordion--plus-minus'/);
  assert.match(behavior, /\? 'remove'/);
  assert.match(behavior, /: 'add'/);
  assert.match(behavior, /: 'chevron_right'/);
  assert.doesNotMatch(behavior, /keyboard_arrow_(?:up|down)/);
  assert.doesNotMatch(behavior, /localStorage|fetch\(|XMLHttpRequest/);
});

test('accordion keeps interaction states neutral and keyboard-visible', async () => {
  const styles = await sheet();

  assert.match(
    styles,
    /--sf-accordion--background-color: var\(--sf-surface-container\)/,
  );
  assert.match(styles, /--sf-surface-container-hover/);
  assert.match(styles, /--sf-surface-container-active/);
  assert.match(styles, /--sf-accordion--radius: var\(--sf-radius--surface\)/);
  assert.match(styles, /--sf-accordion--border-width: var\(--sf-px\)/);
  assert.match(styles, /--sf-accordion--trigger-padding-block/);
  assert.match(styles, /--sf-accordion--content-padding/);
  assert.match(
    styles,
    /\.sf-accordion \.sf-accordion-content \{[\s\S]*padding: var\(--sf-space-3\)/,
  );
  assert.match(styles, /\.sf-accordion-trigger::after/);
  assert.match(styles, /\.sf-accordion-trigger\[aria-expanded='true'\]::after/);
  assert.match(styles, /--sf-accordion-divider--color/);
  assert.match(styles, /var\(--sf-outline-variant\)/);
  assert.match(styles, /height: var\(--sf-accordion--border-width\)/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--outline/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--flush/);
  assert.match(styles, /--sf-radius-square/);
  assert.match(styles, /border-block-end/);
  assert.match(styles, /--sf-accordion--border-color/);
  assert.match(styles, /var\(--sf-outline-variant\)/);
  assert.match(styles, /background-color: transparent/);
  // The text is the accordion's, which is the body text until a size class
  // puts it on the ladder (simai/ui-source#19).
  assert.match(styles, /--sf-accordion--text-size: var\(--sf-text--size\);/);
  assert.match(styles, /--sf-accordion--text-height: var\(--sf-text--height\);/);
  assert.match(
    styles,
    /\.sf-accordion \.sf-accordion-title \{[^}]*font-size: var\(--sf-accordion--text-size\);[^}]*line-height: var\(--sf-accordion--text-height\)/,
  );
  assert.match(
    styles,
    /\.sf-accordion \.sf-accordion-content \{[^}]*font-size: var\(--sf-accordion--text-size\);[^}]*line-height: var\(--sf-accordion--text-height\)/,
  );
  assert.match(styles, /\.sf-accordion-trigger:focus-visible/);
  // The trigger fills its row, so the shared ring turns inwards instead of
  // covering the row above.
  assert.match(styles, /outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.match(styles, /outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  assert.match(styles, /--sf-focus-outline-width/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /\.sf-accordion-trigger:focus\s*\{/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /var\(--sf-duration-fast\) var\(--sf-animation\)/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--legacy/);
  assert.match(styles, /\[aria-expanded='true'\] \.sf-icon/);
  assert.match(styles, /transform: rotate\(90deg\)/);
  assert.match(styles, /\[dir='rtl'\].*\[aria-expanded='false'\]/s);
  assert.match(styles, /transform: rotate\(180deg\)/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--plus-minus/);
  assert.match(styles, /transform: none/);
  assert.doesNotMatch(styles, /--sf-primary-container|--sf-on-primary/);
  assert.doesNotMatch(styles, /\b\d+(?:px|rem|em|ms)\b/i);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test('accordion sizes are the control ladder', async () => {
  const styles = await sheet();

  assert.match(styles, /min-block-size: var\(--sf-accordion--trigger-min-block-size\)/);
  for (const step of ['1\\/3', '1\\/2', '1', '2', '3']) {
    const rule = styles.match(new RegExp(`\\.sf-accordion\\.sf-accordion--size-${step.replace('\\', '\\\\')} \\{([^}]*)\\}`));
    assert.ok(rule, `size ${step} has its rule`);
    const body = rule[1];
    assert.match(body, new RegExp(`--sf-accordion--trigger-padding-block: var\\(--sf-ui-${step.replace('\\', '\\\\')}--space-y-tightness-default\\)`));
    assert.match(body, new RegExp(`--sf-accordion--trigger-min-block-size: var\\(--sf-ui-${step.replace('\\', '\\\\')}--control-height\\)`));
    assert.match(body, new RegExp(`--sf-accordion--text-height: var\\(--sf-text-height-${step.replace('\\', '\\\\')}\\)`));
    assert.match(body, new RegExp(`--sf-accordion--icon-size: var\\(--sf-text-height-${step.replace('\\', '\\\\')}\\)`));
  }
});

test('accordion laboratory covers surface and stress scenarios', async () => {
  const fixture = await source('tests/fixtures/accordion-method-lab.html');

  assert.match(fixture, /sf-accordion--outline/);
  assert.match(fixture, /sf-accordion--flush/);
  assert.match(fixture, /sf-accordion--plus-minus/);
  assert.match(fixture, />remove<\/i>/);
  assert.match(fixture, />add<\/i>/);
  assert.match(fixture, /class="sf-accordion-group grid gap-2"/);
  assert.match(fixture, /data-mode="single"/);
  assert.doesNotMatch(fixture, /data-sf-accordion-mode/);
  assert.match(fixture, /params\.get\('theme'\) === 'dark'/);
  assert.match(fixture, /params\.get\('dir'\) === 'rtl'/);
  assert.match(fixture, /params\.get\('font'\) === 'large'/);
  assert.match(fixture, /params\.get\('check'\) === 'long'/);
});

// One section needs no disclosure (simai/ui-source#19, #29; ui-mail P-07).
test('a single section is a plain section, not a toggle', async () => {
  const [behavior, styles] = await Promise.all([
    source('src/component/accordion/js/_accordion.js'),
    sheet(),
  ]);
  assert.match(behavior, /SINGLE_MODIFIER = 'sf-accordion--single'/);
  assert.match(behavior, /SINGLE_TOGGLE_ATTRIBUTE = 'data-single-section'/);
  assert.match(behavior, /group\.querySelectorAll\(':scope > \.sf-accordion'\)\.length === 1/);
  // The legacy markup, where the section is its own control, keeps its toggle.
  assert.match(behavior, /if \(!this\.el \|\| this\.trigger === this\.el \|\| !this\.content\) return false;/);
  assert.match(behavior, /document\.createElement\('span'\)/);
  assert.match(behavior, /data-sf-accordion-static/);
  assert.match(behavior, /this\.trigger\.replaceWith\(header\)/);
  assert.match(behavior, /header\.replaceWith\(this\.trigger\)/);
  assert.match(behavior, /if \(!this\.content \|\| this\.staticHeader\) return;/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--static \.sf-accordion-trigger \.sf-icon \{\s*display: none;/);
  assert.match(styles, /\.sf-accordion\.sf-accordion--static \.sf-accordion-trigger:is\(:hover, :active\) \{\s*background-color: transparent;/);
});
