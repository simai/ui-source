import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);

test('all themes use the same dark shadow color basis', async () => {
  const [theme, shadow] = await Promise.all([
    read('src/core/scss/_sf_css__theme.scss'),
    read('src/core/scss/_sf_css__shadow.scss'),
  ]);

  // The shadow basis is the same in both themes, so each of these is one plain
  // declaration — no light-dark() branch, because there is nothing to choose
  // between. A --sf-white here would mean a theme had started lifting its own
  // shadows, which is what this guards.
  for (const [token, basis] of [
    ['fill', 'alfa-12'],
    ['outline', 'alfa-8'],
    ['shading', 'alfa-4'],
  ]) {
    const declaration = new RegExp(
      `--sf-shadow--color-${token}: var\\(--sf-black--${basis}\\);`,
      'g',
    );
    assert.equal(theme.match(declaration)?.length, 1, `--sf-shadow--color-${token}`);
  }
  assert.doesNotMatch(theme, /--sf-shadow--color-\w+: var\(--sf-white/);
  assert.doesNotMatch(shadow, /var\(--sf-on-surface/);
  assert.match(shadow, /var\(--sf-shadow--color, var\(--sf-black, #000\)\)/);
});

test('modal overlay keeps a fixed scrim and composes optional backdrop blur', async () => {
  const [styles, component, template, docs] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/smart/modal/index.js'),
    read('src/smart/modal/js/templates/default.js'),
    read('src/smart/modal/docs/docs.md'),
  ]);

  assert.match(styles, /--sf-modal-overlay-background: var\(--sf-black, #000\)/);
  assert.match(styles, /--sf-modal-overlay-opacity: var\(--sf-opacity-60, 0\.6\)/);
  assert.match(styles, /background-color: var\(--sf-modal-overlay-background\)/);
  assert.match(styles, /opacity: var\(--sf-modal-overlay-opacity\)/);

  // overlay-preset is a setting of the manifest (standard 1.3.8 §4): an enum
  // whose unknown value reads as its default.
  const preset = JSON.parse(await read('src/smart/modal/component.json')).settings['overlay-preset'];
  assert.deepEqual(preset, {type: 'enum', values: ['default', 'focus'], default: 'default'});
  assert.match(component, /overlayPreset: this\.overlayPreset/);

  assert.match(template, /context\.overlayPreset === 'focus'/);
  assert.match(template, /'backdrop-blur-small'/);
  assert.match(template, /`backdrop-blur-\$\{context\.blurType\}`/);
  assert.doesNotMatch(template, /bg-surface-overlay/);
  assert.doesNotMatch(template, /bg-black opacity-6/);
  assert.match(template, /data-sf-modal-overlay-preset=/);

  assert.match(docs, /overlay-preset="default\|focus"/);
  assert.match(docs, /fixed black 60% scrim without blur/);
  assert.match(docs, /`blur-\*` blurs the element itself/);
  assert.match(docs, /`backdrop-blur-\*` blurs content behind/);
});

test('system modal defaults use current semantic utilities', async () => {
  const sources = await Promise.all([
    read('src/component/sf-system/js/init/_init.js'),
    read('src/component/sf-system/js/modal/_modal.js'),
    read('src/component/sf-system/js/param/modal.js'),
    read('src/component/sf-system/js/param/overbox.js'),
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
