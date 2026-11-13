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
  // C130 (5): one look; a former one is noted and drawn as the arc.
  assert.match(ordinary, /const variant = named \? 'arc' : '';/);
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
  assert.doesNotMatch(visual, /dash: 24 76,|sf-loader-breathing/, 'one look, the arc (C130 (5))');
  assert.match(visual, /stroke-dasharray: var\(--sf-loader--look-dash, 30 70\)/);
  assert.doesNotMatch(visual, /sf-loader-ring-accent-fill/);
  assert.doesNotMatch(visual, /3\.2s|1\.4s|opacity: 0\.(?:16|32|62)/);
});

test('Spinner machine contract documents status, ownership and closed variants', async () => {
  const manifest = JSON.parse(await read('src/smart/spinner/smart.manifest.json'));

  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  // One look (C130 (5)): breathing, comet and dots are dated value aliases.
  assert.deepEqual(manifest.inputs.properties.variant.enum, ['', 'arc']);
  assert.deepEqual(manifest.inputs.properties.kind.enum, ['', 'arc']);
  assert.equal(manifest.inputs.properties.kind.default, '');
  for (const look of ['breathing', 'comet', 'dots']) assert.ok(manifest.compatibility.aliases.includes(`kind=${look}`), look);
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
  // C130 (6): on its own the quiet ink; a control sets its own spinner's colour.
  assert.match(base, /color: var\(--sf-spinner-color, var\(--sf-loader--color, var\(--sf-on-surface-variant\)\)\);/);
  assert.match(base, /--sf-loader-text-size: var\(--sf-text-size-1\\\/2\);/);
  // C130 (8): shown after the delay, 1 s unless delay says otherwise.
  assert.match(base, /sf-spinner > \.sf-loader-container,\n\.sf-loader-container\[data-delay\] \{\n  animation: sf-loader-wait var\(--sf-loader--delay, 1s\) step-end;/);
  assert.doesNotMatch(base, /--sf-loader--color\s*:/, 'the Framework never sets the colour variable');
  assert.doesNotMatch(base, /(?<![\w-])(?:\d*\.)?\d+(?:px|rem|em)\b/, 'dimensions on system tokens');
  for (const attribute of ['data-width', 'data-height', 'data-stroke-width', 'data-dot-radius']) {
    assert.ok(ordinary.includes(`'${attribute}'`), `${attribute} is noted as deprecated`);
  }
  assert.match(ordinary, /noteDeprecated\(\{/);
});

/* One look (owner decision C130 (5)): the arc, whatever the page's
   data-sf-spinner or the spinner's data-variant name; the former looks are
   dated (journal value-spinner-one-look). */
test('Spinner draws one look, the arc, whatever the page or the instance names', async () => {
  const visual = await read('src/component/spinner/scss/_css__spinner_custom.scss');
  const core = await read('src/core/js/index.js');
  for (const look of ['breathing', 'comet', 'dots']) {
    assert.ok(!visual.includes(`'${look}': (`), `${look} is no longer a look`);
  }
  assert.match(visual, /:where\(\[data-sf-spinner\]:not\(\[data-sf-spinner=''\]\)\)/, 'a page look is the arc, weighing nothing');
  assert.match(visual, /\.sf-loader-container:where\(\[data-variant\]:not\(\[data-variant=''\]\)\)/);
  assert.doesNotMatch(visual, /\[data-sf-spinner='#\{\$look\}'\]|\[data-variant='#\{\$look\}'\]/);
  const journal = JSON.parse(await read('contracts/changes/journal.json'));
  assert.ok(journal.records.some((record) => record.id === 'value-spinner-one-look' && record.remove_after === '2027-01-01'));
  assert.match(visual, /display: var\(--sf-loader--look-comet, none\)/);
  assert.match(visual, /display: var\(--sf-loader--look-dots, none\)/);
  assert.match(core, /SF_BOOT_CONFIG\.spinner/);
});
