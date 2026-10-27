import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Spinner normalizes its public visual inputs to bounded contracts', async () => {
  const ordinary = await read('src/component/spinner/js/_spinner.js');
  const smartTemplate = await read('src/smart/spinner/js/templates/default.js');

  const draw = await read('src/component/spinner/js/_spinner-draw.js');
  assert.match(draw, /export const SPINNER_LOOKS = \['arc', 'breathing', 'comet', 'dots'\];/);
  assert.match(ordinary, /normalizeChoice\(root\.dataset\.variant, SPINNER_LOOKS, 'arc'\)/);
  assert.match(ordinary, /\['clockwise', 'counterclockwise'\]/);
  assert.match(ordinary, /Math\.floor\(toNumber\(root\.dataset\.dots, SPINNER_DOTS\)\), 3, 32/);
  assert.match(ordinary, /Math\.floor\(toNumber\(root\.dataset\.filled, SPINNER_DOTS_FILLED\)\), 1, dots/);
  assert.match(smartTemplate, /\['1\/3', '1\/2', '1', '2', '3'\]/);
});

test('Spinner owns optional polite status semantics without entering focus order', async () => {
  const ordinary = await read('src/component/spinner/js/_spinner.js');
  const smart = await read('src/smart/spinner/index.js');
  const template = await read('src/smart/spinner/js/templates/default.js');

  assert.match(ordinary, /config\.announce && hasLabel/);
  assert.match(ordinary, /setAttribute\('role', 'status'\)/);
  assert.match(ordinary, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(ordinary, /toggleAttribute\('aria-hidden', !hasLabel\)/);
  // Standard 1.3.8: announce is a boolean setting of component.json, off by default.
  assert.match(smart, /elementFromManifest\(manifest, \{/);
  assert.deepEqual(JSON.parse(await read('src/smart/spinner/component.json')).settings.announce, {type: 'boolean', default: false});
  assert.match(template, /data-announce=\$\{String\(!!context\.announce\)\}/);
  assert.doesNotMatch(template, /tabindex=/);
});

test('Spinner motion uses Framework tokens and has a static reduced-motion state', async () => {
  const base = await read('src/component/spinner/scss/_css__spinner.scss');
  const visual = await read('src/component/spinner/scss/_css__spinner_custom.scss');

  assert.match(base, /--sf-loader-cycle-duration: calc\(var\(--sf-duration-slow\) \* 6\)/);
  assert.match(base, /--sf-loader-dot-duration: calc\(var\(--sf-duration-slow\) \* 3\)/);
  assert.match(visual, /animation-iteration-count: infinite/);
  assert.match(visual, /@media \(prefers-reduced-motion: reduce\)/);
  // The arc (simai/ui-source#13): a fixed 30% of the ring that turns, linear,
  // once a second; its still frame is the same 30%, breathing's a quarter.
  assert.match(base, /--sf-loader-arc-duration: calc\(var\(--sf-duration-slow\) \* 2\)/);
  assert.match(visual, /spin: sf-loader-svg-rotate, spin-duration: var\(--sf-loader-arc-duration\), dash: 30 70,/);
  assert.match(visual, /dash: 24 76,/);
  assert.match(visual, /stroke-dasharray: var\(--sf-loader--look-dash, 30 70\)/);
  assert.doesNotMatch(visual, /sf-loader-ring-accent-fill/);
  assert.doesNotMatch(visual, /3\.2s|1\.4s|opacity: 0\.(?:16|32|62)/);
});

test('Spinner machine contract documents status, ownership and closed variants', async () => {
  const manifest = JSON.parse(await read('src/smart/spinner/smart.manifest.json'));

  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  assert.deepEqual(manifest.inputs.properties.variant.enum, ['', 'arc', 'breathing', 'comet', 'dots']);
  assert.deepEqual(manifest.inputs.properties.kind.enum, ['', 'arc', 'breathing', 'comet', 'dots']);
  assert.equal(manifest.inputs.properties.kind.default, '', 'unset, the page decides the look');
  assert.deepEqual(manifest.inputs.properties.direction.enum, [
    'clockwise',
    'counterclockwise',
  ]);
  assert.equal(manifest.inputs.properties.announce.type, 'boolean');
  assert.deepEqual(manifest.accessibility.keyboard, []);
  assert.equal(manifest.ownership.data, 'host');
});

/* The spinner is the Framework's one loading indicator (simai/ui-source#10): on
   the full size ladder, where each step is the icon of a button of the same
   size, stroked on the icon grid; in the current ink unless --sf-loader--color
   says otherwise; the pixel attributes deprecated and noted, not obeyed by
   default. The probe spinner-ladder measures the boxes. */
test('Spinner takes its geometry from the ladder and its colour from the ink', async () => {
  const base = (await read('src/component/spinner/scss/_css__spinner.scss')).replace(/\/\*[\s\S]*?\*\//g, '');
  const ordinary = await read('src/component/spinner/js/_spinner.js');
  const draw = await read('src/component/spinner/js/_spinner-draw.js');

  for (const step of ['1\\/3', '1\\/2', '1', '2', '3']) {
    // The public --sf-spinner-size first, the step's icon its fallback (standard 1.3.8 §6).
    assert.ok(base.includes(`.sf-loader-container.sf-loader--size-${step} {\n  --sf-loader-svg-width: var(--sf-spinner-size, var(--sf-text-height-${step}));`), `step ${step} is the button icon of that step`);
  }
  assert.match(base, /--sf-loader-stroke-width: var\(--sf-spinner-stroke-width, 2\);/, 'the regular icon stroke on the 24-unit grid');
  assert.match(draw, /export const SPINNER_GRID = 24;/);
  assert.match(draw, /export const SPINNER_STROKE = 2;/);
  assert.match(base, /color: var\(--sf-spinner-color, var\(--sf-loader--color, currentColor\)\);/);
  assert.doesNotMatch(base, /--sf-loader--color\s*:/, 'the Framework never sets the colour variable');
  assert.doesNotMatch(base, /(?<![\w-])(?:\d*\.)?\d+(?:px|rem|em)\b/, 'dimensions on system tokens');
  for (const attribute of ['data-width', 'data-height', 'data-stroke-width', 'data-dot-radius']) {
    assert.ok(ordinary.includes(`'${attribute}'`), `${attribute} is noted as deprecated`);
  }
  assert.match(ordinary, /noteDeprecated\(\{/);
});

/* The looks (simai/ui-source#11): four on one ring, chosen once for the page by
   data-sf-spinner, inherited (the nearest block wins), with the spinner's own
   data-variant above it; resolved in CSS alone, so a change of the attribute
   changes every spinner at once. The probe spinner-looks measures them. */
test('Spinner looks are resolved by inherited variables, the instance above the page', async () => {
  const visual = await read('src/component/spinner/scss/_css__spinner_custom.scss');
  const core = await read('src/core/js/index.js');
  for (const look of ['breathing', 'comet', 'dots']) {
    assert.ok(visual.includes(`'${look}': (`), `${look} is a look`);
  }
  assert.match(visual, /:where\(\[data-sf-spinner\]:not\(\[data-sf-spinner=''\]\)\)/, 'an unknown page look is the arc, weighing nothing');
  assert.match(visual, /\.sf-loader-container:where\(\[data-variant\]:not\(\[data-variant=''\]\)\)/);
  assert.ok(visual.indexOf("[data-sf-spinner='#{$look}']") < visual.indexOf(".sf-loader-container[data-variant='#{$look}']"), 'the instance is written after the page');
  assert.match(visual, /display: var\(--sf-loader--look-comet, none\)/);
  assert.match(visual, /display: var\(--sf-loader--look-dots, none\)/);
  assert.match(core, /SF_BOOT_CONFIG\.spinner/);
});
