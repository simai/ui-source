import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Two rules of the interaction layer: the keyboard ring is drawn from our own
// tokens, and a layer that arrives and a layer that leaves do not share one
// curve.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('the base focus ring reads tokens that exist', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  for (const name of ['color', 'offset', 'style', 'width']) {
    assert.match(border, new RegExp(`--sf-focus--${name}:`, 'u'), `--sf-focus--${name} is declared`);
    assert.match(border, new RegExp(`outline-${name}: var\\(--sf-focus--${name}\\)`, 'u'), `outline-${name} reads it`);
  }
  assert.doesNotMatch(
    border,
    /var\(--sf-focus-(color|offset|style|width)\)/u,
    'the single-dash spellings are gone; they were declared nowhere',
  );
});

test('the base ring is keyboard-only', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  assert.match(border, /:focus-visible \{/u);
  assert.doesNotMatch(border, /^:focus \{/mu, 'a mouse click leaves no ring');
});

test('the focus colour comes from the theme and the ring is drawn in pixels', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  assert.match(border, /--sf-focus--color: var\(--sf-focus\)/u, 'the theme colour, not a new blue');
  // The width is one value under two names: the ring reads --sf-focus--width,
  // the Figma export declares --sf-focus-outline-width. The ring marks an edge,
  // so it is counted in pixels like every hairline: 2px wide, 1px off the
  // element, whatever the root font size (owner, 2026-10-10). On the rem scale
  // a larger root font thickened the ring and pushed it away.
  assert.match(border, /--sf-focus--width: var\(--sf-focus-outline-width\)/u, 'one value, two names');
  const focusExport = read('src/core/figma_variables/figma_focus.scss');
  assert.match(focusExport, /--sf-focus-outline-width: calc\(var\(--sf-px\) \* 2\)/u, 'two pixels');
  assert.doesNotMatch(focusExport, /--sf-a\d/u, 'not on the rem scale');
  const theme = read('src/core/scss/_sf_css__theme.scss');
  // One declaration with a branch per theme, and a solid role in both: at 24%
  // alpha the ring read 1.4:1 against the light surface, where an indicator
  // needs 3:1. light-dark() picks which primary from the active color-scheme.
  assert.match(
    theme,
    /--sf-focus: light-dark\(var\(--sf-primary-\d+\), var\(--sf-primary-\d+\)\);/u,
    'declared once, with both themes, and not translucent',
  );
  // The ring stands off the element: flush, it vanishes into a control filled
  // with the same colour.
  assert.match(border, /--sf-focus--offset: var\(--sf-px\)/u, 'a one-pixel gap, not flush');
});

test('a plain link keeps the keyboard ring', () => {
  const link = read('src/core/scss/_sf_css__link.scss');
  assert.doesNotMatch(
    link,
    /^\s*outline: none;/mu,
    'the reset also removed the ring, so a link was invisible under Tab',
  );
});

test('the direction-aware curves are declared once, beside the default', () => {
  const transition = read('src/core/scss/_sf_css__transition.scss');
  for (const name of ['enter', 'exit', 'move']) {
    assert.match(transition, new RegExp(`--sf-ease-${name}: cubic-bezier\\(`, 'u'), `--sf-ease-${name}`);
  }
  assert.match(transition, /--sf-animation: cubic-bezier\(\.25, \.8, \.25, 1\)/u, 'the default curve is unchanged');
});

test('a layer that leaves does not reuse the curve of a layer that arrives', () => {
  const cases = [
    ['src/smart/drawer/scss/_smart__drawer.scss', 'drawer'],
    ['src/component/toast/scss/_css__toast.scss', 'toast'],
    ['src/component/alerts/scss/_css__alerts.scss', 'alert'],
  ];
  for (const [path, name] of cases) {
    const source = read(path);
    assert.match(source, /var\(--sf-ease-enter\)/u, `${name}: arrival curve`);
    assert.match(source, /var\(--sf-ease-exit\)/u, `${name}: departure curve`);
    assert.doesNotMatch(
      source,
      /transition:[^;]*opacity[^;]*var\(--sf-animation\)/u,
      `${name}: the layer no longer opens and closes on one curve`,
    );
  }
});

test('state feedback on the spot keeps the default curve', () => {
  const buttons = read('src/component/buttons/scss/_css__buttons_custom.scss');
  assert.match(buttons, /transition-timing-function: var\(--sf-animation\)/u);
  assert.match(buttons, /transition-duration: var\(--sf-duration-fast\)/u, 'hover feedback stays at 100ms');
});
