import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONTROL_STEPS, EXPLICIT, FAMILIES, TIGHTNESS_BELOW, ladder } from '../scripts/generate-density.mjs';

// Density (owner decision C22, 2026-11-09): data-sf-density="compact" moves
// every component one ladder step down -- control height, padding, gap, icon
// and text together -- through the ladder variables the components read. The
// body text moves with them (it was the only thing compact moved before: 16 ->
// 14 on desktop, the step a phone already reads). An explicit size wins; no
// rem, no font-size alone.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const contract = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json'));
const DENSITY = 'src/core/scss/_sf_css__density.scss';

const block = (selectorStart) => {
  const source = read(DENSITY);
  const at = source.indexOf(`${selectorStart}`);
  assert.ok(at > 0, `${selectorStart} is declared`);
  const open = source.indexOf('{', at);
  return Object.fromEntries([...source.slice(open + 1, source.indexOf('}', open)).matchAll(/(--sf-[^:\s]+):\s*([^;]+);/gu)].map(([, name, value]) => [name.replaceAll('\\/', '/'), value.trim()]));
};

test('the density projection is current with the ladder files', () => {
  execFileSync(process.execPath, ['scripts/generate-density.mjs', '--check'], {cwd: root, stdio: 'pipe'});
});

test('compact holds the value of the step below for every family; the lowest step stays, a tightness takes the one below it (C27)', () => {
  const compact = block('[data-sf-density="compact"] {');
  for (const [file, name, steps] of FAMILIES) {
    steps.forEach((step, index) => {
      // Size 1/3 has no size below: a tightness takes the tightness below in
      // the same size (default low's, high default's, highest high's; low stays).
      const lower = index === 0 && TIGHTNESS_BELOW[file] ? FAMILIES.find(([other]) => other === TIGHTNESS_BELOW[file]) : null;
      const below = lower
        ? ladder().find((row) => row.variable === lower[1](step))
        : ladder().find((row) => row.variable === name(steps[Math.max(0, index - 1)]));
      assert.equal(compact[name(step)], below.normal, `${file}: ${name(step)}`);
    });
  }
});

test('compact body text lands on the mobile body step, 14/20', () => {
  const compact = block('[data-sf-density="compact"] {');
  assert.equal(compact['--sf-text--size'], 'var(--sf-text--size-1)');
  assert.equal(compact['--sf-text--size-1'], `var(--sf-${contract.typography.sizes['1'].mobile})`);
  assert.equal(compact['--sf-text--height-1'], `var(--sf-${contract.typography.lineHeights['1'].mobile})`);
});

test('control heights, text aliases and text roles are declared again in a region', () => {
  const compact = block('[data-sf-density="compact"] {');
  for (const step of CONTROL_STEPS) {
    assert.match(compact[`--sf-ui-${step}--control-height`], /^calc\(var\(--sf-text--height-/u);
    assert.equal(compact[`--sf-text-size-${step}`], `var(--sf-text--size-${step.replace('/', '\\/')})`);
  }
  assert.ok(compact['--sf-text-medium--size']);
});

test('an explicit size and density normal take the normal ladder back', () => {
  const source = read(DENSITY);
  assert.ok(source.includes(`[data-sf-density="compact"] ${EXPLICIT},\n    [data-sf-density="normal"] {`));
  const normal = block(`[data-sf-density="normal"] {`);
  for (const row of ladder()) assert.equal(normal[row.variable], row.normal, row.variable);
});

test('density applies only at the desktop breakpoint', () => {
  const source = read(DENSITY);
  const at = source.indexOf('[data-sf-density="compact"]');
  const media = source.lastIndexOf('@media', at);
  assert.match(source.slice(media, at), new RegExp(`min-width:\\s*${contract.modes.desktop.minWidthPx / 16}rem`, 'u'));
});

test('density never sets the root font size, which would move rem', () => {
  const source = read(DENSITY);
  for (const [, selector, body] of source.matchAll(/(\[data-sf-density="(?:compact|normal)"\][^{]*)\{([^}]*)\}/gu)) {
    if (/font-size/u.test(body)) assert.match(selector, /:not\(:root\)/u);
  }
  assert.ok(!/data-sf-density/u.test(read('src/core/scss/_sf_css__typograpy.scss').replace(/\/\/.*$/gmu, '')), 'the old text-only rule is gone');
});

test('Smart drawings mark the sizes they give as relative', () => {
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /drawing\(\(\) => this\.renderTemplateResult\(templateResult\)\);\n\s*markRelativeSizes\(this, this\._sfSizedBefore\);/u);
  for (const file of ['src/smart/drawer/index.js', 'src/smart/modal/index.js', 'src/smart/search/index.js']) {
    assert.match(read(file), /this\.drawInto\(/u, file);
  }
  assert.match(read('src/core/js/layer-stack.js'), /densityOf\(host\)/u);
  const menu = read('src/smart/menu-context/index.js');
  assert.match(menu, /followDensity\(child, this\.surface\(\) \?\? this\)/u);
  // A menu opened for a control is drawn in that control's density, unless
  // the page gave it a size (C22).
  assert.match(menu, /if \(!this\.hasAttribute\("size"\) \|\| this\.hasAttribute\(RELATIVE\)\) \{[\s\S]{0,120}?surface\.setAttribute\("data-sf-density", densityOf\(anchor\) \?\? "normal"\);/u);
});

test('a size that is a width does not take the normal ladder back (manifest x-scale)', () => {
  assert.match(EXPLICIT, /\[data-sf-size-scale\]/u);
  const drawer = JSON.parse(read('src/smart/drawer/component.json'));
  assert.equal(drawer.settings.size['x-scale'], 'width');
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /markSizeScale\(\) \{[\s\S]*?setting\["x-scale"\][\s\S]*?"data-sf-size-scale"/u);
  assert.match(read('src/core/js/host-runtime-marks.js'), /"data-sf-size-scale"/u);
  // Every other Smart size setting is a step of a ladder.
  for (const name of ['button', 'input', 'tabs', 'menu-context', 'list-item']) {
    const manifest = JSON.parse(read(`src/smart/${name}/component.json`));
    assert.equal(manifest.settings.size['x-scale'], undefined, name);
  }
});

// Owner decision C32 (2026-11-09): a popup's width tied to text follows the
// text -- compact = normal x 14/16, rounded up to the next step of the size
// scale; a region of normal density or an explicit size takes the normal
// width back.
test('the popup widths follow the text in compact density (C32)', async () => {
  const {widths} = await import('../scripts/generate-density.mjs');
  const expected = {
    '--sf-popup-menu-min-width': ['var(--sf-f0)', 'var(--sf-e8)'],
    '--sf-popup-menu-max-width': ['var(--sf-f8)', 'var(--sf-f6)'],
    '--sf-popup-list-max-width': ['var(--sf-g0)', 'var(--sf-f8)'],
    '--sf-popup-panel-width': ['var(--sf-g0)', 'var(--sf-f8)'],
    '--sf-popup-form-width': ['var(--sf-g0)', 'var(--sf-f8)'],
    '--sf-popup-form-wide-width': ['var(--sf-g2)', 'var(--sf-g1)'],
    // The question window (C39): 28rem, 26rem in compact.
    '--sf-popup-question-width': ['var(--sf-g4)', 'var(--sf-g3)'],
  };
  const rows = Object.fromEntries(widths().map((row) => [row.variable, [row.normal, row.compact]]));
  assert.deepEqual(rows, expected);
  const compact = block('[data-sf-density="compact"] {');
  const normal = block('[data-sf-density="normal"] {');
  for (const [name, [wide, narrow]] of Object.entries(expected)) {
    assert.equal(compact[name], narrow, name);
    assert.equal(normal[name], wide, name);
  }
  assert.match(read('src/core/scss/_sf_css__size.scss'), /@layer sf\.base \{\s*:root \{[\s\S]*--sf-popup-menu-min-width: var\(--sf-f0\);/u);
});
