import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// Changes met while the Loader's search runs are queued and handled when it
// ends. It ended only at the window's load: a Loader chunk that started after
// load, and every Turbo visit, never saw it end, and the queue was never read,
// so an element inserted later never loaded (loader-packages.browser.mjs
// failed one run in two on exactly that).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loader = readFileSync(resolve(root, 'src/core/js/loader.js'), 'utf8');

test('every prepare schedules the end of its search, at once when the window has already loaded', () => {
  const schedule = loader.slice(loader.indexOf('SFLoaderPlugin.prototype.scheduleSearchEnd = function'));
  const body = schedule.slice(0, schedule.indexOf('\n};'));
  assert.match(body, /if \(document\.readyState === 'complete'\) \{\s*setTimeout\(\(\) => this\.endSearch\(\), 0\);/u);
  assert.match(body, /window\.addEventListener\('load', \(\) => \{[\s\S]*this\.endSearch\(\);/u);
  const prepare = loader.slice(loader.indexOf('SFLoaderPlugin.prototype.prepare = function'));
  assert.match(prepare.slice(0, 400), /this\.searchEnd = false;\s*this\.scheduleSearchEnd\(\);/u);
});

test('ending the search processes the changes queued meanwhile', () => {
  const end = loader.slice(loader.indexOf('SFLoaderPlugin.prototype.endSearch = function'));
  assert.match(end.slice(0, end.indexOf('};')), /this\.flushObservedChanges\?\.\(\)/u);
  assert.match(loader, /this\.flushObservedChanges = \(\) => \{[\s\S]{0,120}processChanges\(_this\.observeElements\.splice\(0\)\)/u);
});

test('a Turbo visit prepares, and so ends its search too', () => {
  const visit = loader.slice(loader.indexOf("document.addEventListener('turbo:load'"));
  assert.match(visit.slice(0, visit.indexOf('});')), /this\.prepare\(\)/u);
});

test('nothing sets searchEnd true without draining the queue', () => {
  assert.deepEqual(loader.match(/this\.searchEnd = true/gu), ['this.searchEnd = true'], 'only endSearch sets it');
});
