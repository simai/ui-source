import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// C196 follow-up (queue #134): the SF4 low-vision panel's text size (kegl,
// 14-24 px, default 16) is the core display setting data-sf-text-scale, not
// its own px on <html> and <body>. The panel writes one class special-kegl-<n>
// beside its other special-* classes; the bridge (module.special) reads it as
// the nearest text step and notes it in SF.deprecations, as the colours and
// intervals. Nothing new is kept: the panel's own cookie stays its own.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const {legacySettings, keglScale} = await import('../src/component/special/js/bridge.js');
const {TEXT_SCALES} = await import('../src/core/js/display-settings.js');

const classes = (...names) => ({classList: {contains: (name) => names.includes(name), [Symbol.iterator]: () => names[Symbol.iterator]()}});

test('a kegl is the nearest text step of core, never below the person\'s own size', () => {
  const expected = {14: 100, 15: 100, 16: 100, 17: 100, 18: 125, 19: 125, 20: 125, 21: 125, 22: 150, 23: 150, 24: 150};
  for (const [kegl, scale] of Object.entries(expected)) {
    assert.equal(keglScale(kegl), scale, `kegl ${kegl}`);
    assert.ok(TEXT_SCALES.includes(scale));
  }
  assert.equal(keglScale('x'), 100);
});

test('the special-kegl-<n> class is read as data-sf-text-scale', () => {
  assert.deepEqual(legacySettings(classes('special', 'special-kegl-20'), classes()), {textScale: 125});
  assert.deepEqual(legacySettings(classes('special', 'special-kegl-16'), classes()), {textScale: 100});
  assert.equal(legacySettings(classes('special-kegl-24'), classes()), null, 'the version off: nothing');
});

test('the panel writes no px of its own on the root or the body', () => {
  const panel = read('src/component/sf-system/js/04-blocks/_special.js').replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(panel, /\.style\.fontSize\s*=/u);
  assert.doesNotMatch(panel, /fontSize = `\$\{/u);
  assert.match(panel, /special-kegl-/u);
});
