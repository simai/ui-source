#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.1, the declarative mount, on the built core: a page that only
// writes data-sf-effect (a catalogue id or the address of an effect.json
// under the pinned catalogue base), data-sf-effect-settings and
// data-sf-effect-theme, or data-sf-effect-windows on a group of
// [data-sf-effect-window] cards, gets its effects -- loaded from the catalogue
// configured in SF_BOOT_CONFIG.effects.catalogue (served here from a fake
// catalogue with the real index format), after the page has loaded, each file
// once and verified, drawn under the content that stays in place. A pair by
// catalogue id is loaded the same way; an address outside the catalogue is
// refused without being asked for (this page sets SF_BOOT_CONFIG.effects.
// foreign = 'refuse'; by default it runs in the sandbox -- the probe
// effect-sandbox); content added later is found too.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {BASE, openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};

const area = 'style="display:block;inline-size:360px;block-size:160px"';
const body = `
<section id="by-id" ${area} data-sf-effect="sample-bands" data-sf-effect-settings='{"bands": 7}' data-sf-effect-theme="dark"><h2>Kept heading</h2></section>
<section id="by-url" ${area} data-sf-effect="${BASE}effects/night-bands/effect.json"><p>Text</p></section>
<section id="foreign" ${area} data-sf-effect="https://foreign.test/effects/x/effect.json"></section>
<section id="unknown" ${area} data-sf-effect="no-such-effect"></section>
<div id="win" data-sf-effect-windows="day-bands" style="display:flex;gap:16px;padding:16px;inline-size:600px;block-size:160px">
  <div data-sf-effect-window style="flex:1">A</div><div data-sf-effect-window style="flex:1">B</div><div class="plain" style="flex:1">C</div>
</div>
<div id="win-refused" data-sf-effect-windows="lone-light"><div data-sf-effect-window>x</div></div>`;

const browser = await chromium.launch();
try {
  const {page, requests, errors} = await openPage(browser, out, {theme: 'theme-light', body, effects: {foreign: 'refuse'}});
  await page.waitForFunction(() => ['by-id', 'by-url', 'foreign', 'unknown', 'win', 'win-refused']
    .every((id) => !['loading', null].includes(document.getElementById(id).getAttribute('data-sf-effect-state'))), null, {timeout: 15000});
  await page.waitForTimeout(200);
  const read = (id) => page.evaluate((id) => {
    const element = document.getElementById(id);
    const layer = element.querySelector(':scope > [data-sf-effect-layer]');
    return {
      state: element.getAttribute('data-sf-effect-state'),
      reason: element.getAttribute('data-sf-effect-reason'),
      classes: [...element.classList].filter((name) => name.startsWith('theme-')),
      drawn: layer?.getAttribute('data-sf-effect') ?? null,
      canvases: layer ? layer.querySelectorAll('canvas').length : 0,
      layerFirst: element.firstElementChild === layer && Boolean(layer),
    };
  }, id);

  expect('by catalogue id, fixed dark: drawn dark in a layer under the content', await read('by-id'),
    {state: 'running', reason: null, classes: ['theme-dark'], drawn: 'sample-bands', canvases: 1, layerFirst: true});
  expect('the content stays', await page.evaluate(() => document.querySelector('#by-id h2')?.textContent), 'Kept heading');
  // Under the content: a layer at z-index -1 in the area's own stacking context.
  expect('the layer stands under the content', await page.evaluate(() => {
    const element = document.getElementById('by-id');
    const layer = element.querySelector('[data-sf-effect-layer]');
    const style = getComputedStyle(layer);
    return {zIndex: style.zIndex, position: style.position, isolation: getComputedStyle(element).isolation, area: getComputedStyle(element).position};
  }), {zIndex: '-1', position: 'absolute', isolation: 'isolate', area: 'relative'});
  expect('by address under the catalogue, auto on a light page: its pair by id, light', await read('by-url'),
    {state: 'running', reason: null, classes: ['theme-light'], drawn: 'day-bands', canvases: 1, layerFirst: true});
  expect('an address outside the catalogue is refused', await read('foreign'),
    {state: 'refused', reason: 'foreign-effect-needs-sandbox', classes: [], drawn: null, canvases: 0, layerFirst: false});
  expect('an id the catalogue does not hold is refused', (await read('unknown')).reason, 'not-in-catalogue');
  const windows = await page.evaluate(() => {
    const group = document.getElementById('win');
    return {
      state: group.getAttribute('data-sf-effect-state'),
      canvases: group.querySelectorAll('[data-sf-effect-layer] canvas').length,
      windows: [...group.querySelectorAll('[data-sf-effect-window]')].map((card) => [...card.classList]),
      plain: [...group.querySelector('.plain').classList],
      clip: group.querySelector('[data-sf-effect-layer]')?.style.clipPath.startsWith('path(') ?? false,
    };
  });
  expect('a windows group by id: one canvas, a path mask, light windows', windows,
    {state: 'running', canvases: 1, windows: [['sf-effect-area', 'theme-light'], ['sf-effect-area', 'theme-light']], plain: ['plain'], clip: true});
  expect('a windows group for an effect without the capability is refused', (await read('win-refused')).reason, 'windows-not-declared');

  const refusals = await page.evaluate(() => window.__refused.map(({target, reason}) => `${target}:${reason}`).sort());
  expect('each refusal is dispatched as sf-effect-refused', refusals,
    ['foreign:foreign-effect-needs-sandbox', 'unknown:not-in-catalogue', 'win-refused:windows-not-declared']);

  // Requests: the catalogue alone, each file once, nothing from elsewhere, and
  // nothing before the page had loaded.
  const asked = requests.filter((url) => url.startsWith(BASE)).map((url) => url.slice(BASE.length));
  const once = asked.length === new Set(asked).size;
  expect('each catalogue file is asked for once', once, true);
  expect('the index, then each effect and its pair', [...new Set(asked)].sort(), [
    'catalogue/index.json',
    'effects/day-bands/effect.json', 'effects/day-bands/index.js',
    'effects/lone-light/effect.json', 'effects/lone-light/index.js',
    'effects/night-bands/effect.json', 'effects/night-bands/index.js',
    'effects/sample-bands/effect.json', 'effects/sample-bands/index.js',
  ]);
  expect('no foreign address is asked for', requests.filter((url) => !url.startsWith('https://probe.test/')), []);
  const timing = await page.evaluate((base) => {
    const first = Math.min(...performance.getEntriesByType('resource').filter((entry) => entry.name.startsWith(base)).map((entry) => entry.startTime));
    return first >= window.__loadAt;
  }, BASE);
  expect('effects are loaded after the page has loaded', timing, true);

  // Content added later is found; content removed is let go.
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<section id="later" style="display:block;inline-size:200px;block-size:100px" data-sf-effect="sample-bands"></section>');
  });
  await page.waitForFunction(() => document.getElementById('later').getAttribute('data-sf-effect-state') === 'running', null, {timeout: 10000});
  expect('a placement added later is mounted', (await read('later')).canvases, 1);
  const released = await page.evaluate(async () => {
    const element = document.getElementById('later');
    const layer = element.querySelector('[data-sf-effect-layer]');
    element.remove();
    await new Promise((done) => setTimeout(done, 50));
    return {layerAttached: layer.isConnected || element.contains(layer), state: element.getAttribute('data-sf-effect-state'), classes: [...element.classList]};
  });
  expect('a placement taken off the page is destroyed', released, {layerAttached: false, state: null, classes: []});

  // The page theme switches: auto placements follow, the fixed one holds.
  await page.evaluate(() => document.documentElement.classList.replace('theme-light', 'theme-dark'));
  await page.waitForTimeout(150);
  expect('auto follows the page: the effect itself, dark', await read('by-url'),
    {state: 'running', reason: null, classes: ['theme-dark'], drawn: 'night-bands', canvases: 1, layerFirst: true});
  expect('fixed dark holds', (await read('by-id')).classes, ['theme-dark']);

  if (errors.length) failures.push({case: 'no page errors', got: errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_DECLARATIVE_OK');
