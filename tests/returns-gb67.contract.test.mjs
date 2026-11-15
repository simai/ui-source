// DEV returns of the GB6+GB7 intent acceptance (ui-control
// control/evidence/2026-11-15-gb67-intent): MR-2 (C185, C131 (7)), the class
// scale reads the thresholds; TT-11 (C160 (1)), no browser title where the
// Framework tooltip names a control.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('MR-2: one threshold source; 79 / 80 / 85 / 97 of warning 80 and error 95', async () => {
  const {effectiveStatus, readThreshold, thresholdStatus} = await import(new URL('src/component/progress-threshold.js', root));
  const drawn = (value, status = '') => effectiveStatus(status, value, readThreshold('80'), readThreshold('95'));
  assert.deepEqual([79, 80, 85, 97].map((value) => drawn(value)), ['', 'warning', 'warning', 'error']);
  // The more serious wins: an error status stays, a success one gives way.
  assert.equal(drawn(85, 'error'), 'error');
  assert.equal(drawn(85, 'success'), 'warning');
  // Unset, empty or a word is no threshold, never 0.
  for (const raw of [null, undefined, '', '  ', 'high']) assert.equal(readThreshold(raw), null, String(raw));
  assert.equal(thresholdStatus(5, readThreshold(''), null), '');

  const [ordinary, element, bar] = await Promise.all([
    read('src/component/progress-scale/js/_progress_scale.js'),
    read('src/smart/progress-scale/index.js'),
    read('src/smart/progress-bar/index.js'),
  ]);
  // The class scale (div.sf-progress-scale) reads data-warning-at and
  // data-error-at, the names the Smart element documents, and draws the
  // threshold's status while data-tone keeps the page's.
  assert.match(ordinary, /from '\.\.\/\.\.\/progress-threshold'/u);
  assert.match(ordinary, /effectiveStatus\(tone, value, readThreshold\(root\.dataset\.warningAt\), readThreshold\(root\.dataset\.errorAt\)\)/u);
  assert.match(ordinary, /syncScaleClasses\(root, step, size, drawn\);/u);
  // The Smart scale and the bar take the same source; no copy stays.
  for (const [name, source] of [['sf-progress-scale', element], ['sf-progress-bar', bar]]) {
    assert.match(source, /from '\.\.\/\.\.\/component\/progress-threshold'/u, name);
    assert.doesNotMatch(source, /function thresholdReached|function thresholdStatus|function effectiveStatus/u, name);
  }
});

test('TT-11: sf-language and a drilling row name themselves by the Framework tooltip, not a title', async () => {
  const [language, languageElement, languageManifest, menu, menuElement] = await Promise.all([
    read('src/smart/language/js/templates/default.js'),
    read('src/smart/language/index.js'),
    read('src/smart/language/component.json'),
    read('src/smart/menu-context/js/templates/default.js'),
    read('src/smart/menu-context/index.js'),
  ]);
  assert.doesNotMatch(language, /title=\$\{context\.triggerLabel\}/u);
  assert.match(language, /aria-label=\$\{context\.triggerLabel\}/u, 'the accessible name stays');
  assert.match(language, /data-tooltip=\$\{context\.tipId \|\| nothing\}/u);
  assert.match(language, /class="sf-tooltip sf-tooltip--dark sf-language-tooltip" id=\$\{context\.tipId\} hidden/u);
  assert.match(languageElement, /ensurePlugin\?\.\('tooltip'\)/u);
  assert.ok(JSON.parse(languageManifest).relations.some((one) => one.name === 'tooltip' && one.lazy === true));

  assert.doesNotMatch(menu, /sf-context-menu-item-under" title=/u);
  assert.match(menuElement, /syncValueTooltip\(event\)/u);
  assert.match(menuElement, /under\.scrollWidth > under\.clientWidth \+ 1/u, 'only a cut value has a tooltip');
});
