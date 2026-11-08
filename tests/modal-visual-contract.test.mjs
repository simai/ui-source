import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);

test('all themes draw shadows from two black steps of the alpha scale', async () => {
  const [theme, shadow] = await Promise.all([
    read('src/core/scss/_sf_css__theme.scss'),
    read('src/core/scss/_sf_css__shadow.scss'),
  ]);

  // C20: the key shadow is black at 16 / 28 and the ambient one black at 8 /
  // none, each declared once on the theme root. A --sf-white here would mean
  // a theme had started lifting its own shadows, which is what this guards;
  // and the core declares no shadow colour of its own (it used to, at 24/12/8,
  // and the layer styles read those instead of the theme's).
  assert.equal(theme.match(/--sf-shadow-key-color: light-dark\(var\(--sf-black--alfa-16\), var\(--sf-black--alfa-28\)\);/g)?.length, 1);
  assert.equal(theme.match(/--sf-shadow-ambient-color: light-dark\(var\(--sf-black--alfa-8\), var\(--sf-transparent\)\);/g)?.length, 1);
  assert.doesNotMatch(theme, /--sf-shadow-[a-z-]*color: [^;]*--sf-white/);
  const code = shadow.replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(code, /--sf-shadow--color-/);
  assert.doesNotMatch(code, /var\(--sf-on-surface/);
});

test('modal overlay keeps a fixed scrim and composes optional backdrop blur', async () => {
  const [styles, component, template, docs] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/smart/modal/index.js'),
    read('src/smart/modal/js/templates/default.js'),
    read('src/smart/modal/docs/docs.md'),
  ]);

  // The shared scrim of the core first (reuse audit 2026-11-02), black at 64
  // since C16 and C20: the strength is in the colour, drawn at full opacity.
  assert.match(styles, /--sf-modal-overlay-background: var\(--sf-scrim-color, var\(--sf-black--alfa-64\)\)/);
  assert.match(styles, /--sf-modal-overlay-opacity: var\(--sf-scrim-opacity, 1\)/);
  assert.match(styles, /background-color: var\(--sf-modal-overlay-background\)/);
  assert.match(styles, /opacity: var\(--sf-modal-overlay-opacity\)/);

  // overlay-preset is a setting of the manifest (standard 1.3.8 §4): an enum
  // whose unknown value reads as its default.
  const preset = JSON.parse(await read('src/smart/modal/component.json')).settings['overlay-preset'];
  const {summary, ...shape} = preset;
  assert.deepEqual(shape, {type: 'enum', values: ['default', 'focus'], default: 'default'});
  assert.match(summary, /focus/u);
  assert.match(component, /overlayPreset: this\.overlayPreset/);

  assert.match(template, /context\.overlayPreset === 'focus'/);
  assert.match(template, /'backdrop-blur-small'/);
  assert.match(template, /`backdrop-blur-\$\{context\.blurType\}`/);
  assert.doesNotMatch(template, /bg-surface-overlay/);
  assert.doesNotMatch(template, /bg-black opacity-6/);
  assert.match(template, /data-sf-modal-overlay-preset=/);

  assert.match(docs, /overlay-preset="default\|focus"/);
  assert.match(docs, /shared black 64 scrim \(C20\) without blur/);
  assert.match(docs, /`blur-\*` blurs the element itself/);
  assert.match(docs, /`backdrop-blur-\*` blurs content behind/);
});

test('system modal defaults use current semantic utilities', async () => {
  const sources = await Promise.all([
    read('src/component/sf-system/js/init/_init.js'),
    read('src/component/sf-system/js/search/_search.js'),
  ]);
  const combined = sources.join('\n');

  assert.doesNotMatch(combined, /\bbg-opacity-/);
  assert.match(combined, /\bbg-surface-transparent-overlay\b/);
  assert.match(combined, /\bbg-surface-[01]\b/);
});

test('modal surfaces use the semantic surface radius and logical edge positions', async () => {
  const [styles, ordinary, smart] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/component/modal/js/_modal.js'),
    read('src/smart/modal/index.js'),
  ]);

  assert.match(styles, /--sf-modal-surface-radius: var\(--sf-radius--surface\)/);
  assert.doesNotMatch(styles, /--sf-modal-surface-radius: var\(--sf-radius-2\)/);
  assert.match(ordinary, /'inline-start'/);
  assert.match(ordinary, /'inline-end'/);
  const positions = JSON.parse(await read('src/smart/modal/component.json')).settings.position.values;
  assert.ok(positions.includes('inline-start') && positions.includes('inline-end'));
  assert.doesNotMatch(ordinary, /console\.log\(eventName\)/);
  assert.match(ordinary, /sf-modal-iframe w-full border-0 radius-surface/);
  assert.match(smart, /sf-modal-iframe w-full border-0 radius-surface/);
  assert.match(styles, /--sf-modal-iframe-min-height: var\(--sf-g2\)/);
  assert.match(ordinary, /minHeight = 'var\(--sf-modal-iframe-min-height\)'/);
  assert.match(smart, /min-height:var\(--sf-modal-iframe-min-height\)/);
  assert.doesNotMatch(`${ordinary}\n${smart}`, /400px/);
});

test('modal lifecycle has a bounded frame fallback for offscreen documents', async () => {
  const [motion, ordinary, smart] = await Promise.all([
    read('src/component/modal/js/_motion.js'),
    read('src/component/modal/js/_modal.js'),
    read('src/smart/modal/index.js'),
  ]);

  assert.match(motion, /export function scheduleModalFrame/);
  assert.match(motion, /requestAnimationFrame\(run\)/);
  assert.match(motion, /setTimeout\(run, 50\)/);
  assert.match(motion, /queueMicrotask\(run\)/);
  assert.match(motion, /const cancelFrame = scheduleModalFrame/);
  assert.match(ordinary, /scheduleModalClose, scheduleModalFrame/);
  assert.match(smart, /scheduleModalClose, scheduleModalFrame/);
  assert.match(ordinary, /scheduleModalFrame\(\(\) => \{/);
  assert.match(smart, /scheduleModalFrame\(\(\) => \{/);
  assert.match(smart, /changedAttributes\?\.includes\("open-state"\)/);
  assert.match(smart, /void projected\.then\(\(\) => \{/);
});
