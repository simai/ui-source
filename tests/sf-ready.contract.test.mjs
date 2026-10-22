import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// SF.ready (simai/ui-source#16): the Loader's readiness, on window.SF as soon
// as core has run, created once on the shared global. The module is run here
// against a stand-in window; tests/browser/sf-ready.browser.mjs drives the
// built bytes.
const contract = JSON.parse(readFileSync(new URL('../src/core/contracts/public-js-api.json', import.meta.url), 'utf8'));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Each import is a fresh module instance: what two bundles each carrying
// their own copy look like.
let copies = 0;
const freshCopy = async () => (await import(`../src/core/js/ready.js?copy=${copies++}`)).installReady;

const standIn = ({readyState = 'complete'} = {}) => {
  const listeners = new Map();
  const on = (target) => (type, fn) => {
    const key = `${target}:${type}`;
    listeners.set(key, [...(listeners.get(key) ?? []), fn]);
  };
  const fire = (target, type) => (listeners.get(`${target}:${type}`) ?? []).forEach((fn) => fn());
  const document = {readyState, addEventListener: on('document')};
  const win = {document, addEventListener: on('window')};
  return {
    win,
    loaderInit() {
      win.SF.Loader = {};
      win.SF.loadSmartBase = () => {};
      fire('window', 'sf-loader-init');
    },
    parsed() {
      document.readyState = 'interactive';
      fire('document', 'readystatechange');
    },
  };
};
const tick = () => new Promise((settle) => setTimeout(settle, 0));

test('the contract lists SF.ready as core, a thenable, with what it settles with', () => {
  const entry = contract.globals.find((item) => item.name === 'SF.ready');
  assert.ok(entry);
  assert.equal(entry.status, 'public');
  assert.equal(entry.loaded_by, 'core');
  assert.deepEqual(entry.members, ['then', 'catch', 'finally']);
  assert.match(entry.summary, /sf-loader-init/u);
  assert.match(entry.summary, /window\.SF/u);
  assert.match(entry.summary, /SF_ON_READY/u);
});

test('core creates SF.ready before it asks for the Loader chunk; the sf-system copy keeps it', () => {
  const core = read('src/core/js/index.js');
  const install = core.indexOf('installReady(window)');
  assert.ok(install > 0, 'core.js installs SF.ready');
  assert.ok(install < core.indexOf("'./loader'"), 'before the Loader chunk');
  const system = read('src/component/sf-system/js/ready/_ready.js');
  assert.match(system, /installReady\(\)/u);
  assert.doesNotMatch(system, /SF\.ready\s*=/u, 'no bundle assigns SF.ready');
  // sf-loader-init is still sent by the Loader, as it was.
  assert.match(read('src/core/js/loader.js'), /new CustomEvent\('sf-loader-init'/u);
});

test('SF.ready settles once, with window.SF, exactly at sf-loader-init; late askers get it settled', async () => {
  const page = standIn();
  const ready = (await freshCopy())(page.win);
  assert.equal(page.win.SF.ready, ready);
  let calls = 0;
  let value;
  ready.then((SF) => { calls += 1; value = SF; });
  await tick();
  assert.equal(calls, 0, 'not before the Loader');
  page.loaderInit();
  await tick();
  assert.equal(calls, 1);
  assert.equal(value, page.win.SF);
  assert.equal(typeof value.loadSmartBase, 'function');
  page.loaderInit(); // a second event changes nothing
  await tick();
  assert.equal(calls, 1);
  assert.equal(await page.win.SF.ready, page.win.SF, 'await on the thenable, late');
  assert.equal(await Promise.resolve(page.win.SF.ready), page.win.SF);
});

test('a second copy of the module keeps the first SF.ready, and nothing replaces it', async () => {
  const page = standIn();
  const first = (await freshCopy())(page.win);
  const second = (await freshCopy())(page.win);
  assert.equal(second, first);
  page.win.SF.ready = () => 'an older bundle';
  assert.equal(page.win.SF.ready, first);
  let calls = 0;
  page.win.SF.ready.then(() => { calls += 1; });
  page.loaderInit();
  await tick();
  assert.equal(calls, 1);
});

test('a copy installed after the Loader started settles at once', async () => {
  const page = standIn();
  page.win.SF = {Loader: {}, loadSmartBase() {}};
  const ready = (await freshCopy())(page.win);
  assert.equal(await ready, page.win.SF);
});

test('functions queued before core run once, with window.SF; later pushes chain', async () => {
  const page = standIn();
  const seen = [];
  page.win.SF_ON_READY = [(SF) => seen.push(['early', SF])];
  (await freshCopy())(page.win);
  page.win.SF_ON_READY.push((SF) => seen.push(['after core', SF]));
  await tick();
  assert.equal(seen.length, 0);
  page.loaderInit();
  await tick();
  assert.deepEqual(seen.map(([when]) => when), ['early', 'after core']);
  assert.ok(seen.every(([, SF]) => SF === page.win.SF));
  page.win.SF_ON_READY.push((SF) => seen.push(['late', SF]));
  await tick();
  assert.equal(seen.length, 3);
});

test('the callback form waits for the Loader and the parsed document, then runs synchronously', async () => {
  const page = standIn({readyState: 'loading'});
  const ready = (await freshCopy())(page.win);
  const order = [];
  ready(() => order.push('queued'));
  page.loaderInit();
  assert.deepEqual(order, [], 'the document is still loading');
  page.parsed();
  assert.deepEqual(order, ['queued']);
  ready(() => order.push('sync'));
  assert.deepEqual(order, ['queued', 'sync']);
});
