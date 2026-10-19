#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.1, pair-under-the-same-trust and the catalogue's integrity,
// on the built core. Every file of a catalogue effect is checked against the
// SHA-256 its index gives before any of it runs: one byte changed in the
// module, or in the manifest, and the effect is refused -- its code never
// executed (the fixture module marks the page when its top level or its
// mount runs), the refusal reported as a console warning and an
// sf-effect-refused event naming the file. A verified module is executed
// from the verified bytes, not fetched a second time. A trusted effect never
// pulls an untrusted pair inline: a catalogue effect whose pair is a foreign
// address, needed on a light page, is hidden with the reason
// foreign-pair-needs-sandbox, and that address is never asked for -- not by
// the declarative mount, not when the JS API is handed the pair. Foreign
// effects are refused on this page (SF_BOOT_CONFIG.effects.foreign =
// 'refuse'); with the default they run in the sandbox, which the probe
// effect-sandbox holds.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {BASE, EFFECTS, FOREIGN_PAIR, moduleUrl, openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};

const area = 'style="display:block;inline-size:300px;block-size:120px"';
const body = `
<section id="module" ${area} data-sf-effect="tampered-module"></section>
<section id="manifest" ${area} data-sf-effect="tampered-manifest"></section>
<section id="dusk" ${area} data-sf-effect="dusk-bands"></section>
<section id="good" ${area} data-sf-effect="sample-bands"></section>`;

const browser = await chromium.launch();
try {
  const warnings = [];
  const listen = (page) => page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
  const {page, requests, errors} = await openPage(browser, out, {theme: 'theme-light', body, listen, effects: {foreign: 'refuse'}});
  await page.waitForFunction(() => ['module', 'manifest', 'dusk', 'good']
    .every((id) => !['loading', null].includes(document.getElementById(id).getAttribute('data-sf-effect-state'))), null, {timeout: 15000});
  await page.waitForTimeout(200);
  const read = (id) => page.evaluate((id) => {
    const element = document.getElementById(id);
    return {
      state: element.getAttribute('data-sf-effect-state'),
      reason: element.getAttribute('data-sf-effect-reason'),
      layers: element.querySelectorAll('[data-sf-effect-layer]').length,
      canvases: element.querySelectorAll('canvas').length,
    };
  }, id);

  // Tampered: refused, never run.
  expect('one byte changed in the module: refused', await read('module'), {state: 'refused', reason: 'integrity', layers: 0, canvases: 0});
  expect('one byte changed in the manifest: refused', await read('manifest'), {state: 'refused', reason: 'integrity', layers: 0, canvases: 0});
  const ran = await page.evaluate(() => ({ran: window.__effectRan ?? [], mounted: window.__effectMounted ?? []}));
  expect('no tampered code was executed', ran.ran.filter((id) => id.startsWith('tampered')).concat(ran.mounted.filter((id) => id.startsWith('tampered'))), []);
  expect('the verified effect ran, once', ran.ran.filter((id) => id === 'sample-bands'), ['sample-bands']);
  expect('the verified effect is drawn', await read('good'), {state: 'running', reason: null, layers: 1, canvases: 1});
  const refused = await page.evaluate(() => window.__refused.map(({target, effect, reason, file}) => ({target, effect, reason, file: file ?? null}))
    .sort((a, b) => a.target.localeCompare(b.target)));
  expect('each refusal is dispatched with its reason and file', refused, [
    {target: 'dusk', effect: FOREIGN_PAIR, reason: 'foreign-pair-needs-sandbox', file: null},
    {target: 'manifest', effect: 'tampered-manifest', reason: 'integrity', file: 'effect.json'},
    {target: 'module', effect: 'tampered-module', reason: 'integrity', file: 'index.js'},
  ]);

  // The tampered module was fetched once and never again (no second, unverified fetch).
  const asked = requests.filter((url) => url.startsWith(BASE)).map((url) => url.slice(BASE.length));
  const count = (path) => asked.filter((entry) => entry === path).length;
  expect('the tampered module was fetched once', count('effects/tampered-module/index.js'), 1);
  expect('a tampered manifest stops before the module is fetched', count('effects/tampered-manifest/index.js'), 0);
  expect('a verified module is fetched once: it runs from the verified bytes', count('effects/sample-bands/index.js'), 1);

  // The foreign pair: hidden on a light page, never asked for.
  expect('a catalogue effect with a foreign pair on a light page: hidden', await read('dusk'), {state: 'hidden', reason: 'foreign-pair-needs-sandbox', layers: 1, canvases: 0});
  // On a dark page the effect draws itself: only the pair is refused.
  await page.evaluate(() => document.documentElement.classList.replace('theme-light', 'theme-dark'));
  await page.waitForTimeout(150);
  expect('on a dark page it draws itself', await read('dusk'), {state: 'running', reason: null, layers: 1, canvases: 1});
  await page.evaluate(() => document.documentElement.classList.replace('theme-dark', 'theme-light'));
  await page.waitForTimeout(150);
  expect('back on a light page: hidden again', (await read('dusk')).reason, 'foreign-pair-needs-sandbox');

  // The JS API handed a module for the foreign pair still never runs it.
  const handed = await page.evaluate(async ({manifest, url}) => {
    const host = document.createElement('div');
    host.style.cssText = 'inline-size:100px;block-size:60px';
    document.body.append(host);
    const module = await import(url);
    let pairMounted = false;
    const pair = {manifest: {...manifest, id: 'dawn-bands', schemes: ['light'], pair: undefined}, module: {mount() { pairMounted = true; return {}; }}};
    const handle = window.SF.Effects.mountEffect(host, {manifest, module, pair, themeMode: 'auto'});
    const result = {effect: handle.effect, reason: handle.resolution.reason, pairMounted, nodes: host.childNodes.length};
    handle.destroy();
    host.remove();
    return result;
  }, {manifest: EFFECTS['dusk-bands'], url: moduleUrl('dusk-bands')});
  expect('the JS API never runs a pair the effect names by address', handed, {effect: null, reason: 'foreign-pair-needs-sandbox', pairMounted: false, nodes: 0});

  // loadEffect refuses an address outside the catalogue without asking for it.
  const direct = await page.evaluate(async (url) => {
    try {
      await window.SF.Effects.loadEffect(url);
      return 'loaded';
    } catch (error) {
      return error.reason;
    }
  }, FOREIGN_PAIR);
  expect('loadEffect refuses a foreign address', direct, 'foreign-effect-needs-sandbox');
  expect('no foreign address was ever asked for', requests.filter((url) => !url.startsWith('https://probe.test/')), []);
  expect('the refusals are warned on the console', ['tampered-module is not run (integrity)', 'tampered-manifest is not run (integrity)', `${FOREIGN_PAIR} is not run (foreign-pair-needs-sandbox)`]
    .map((text) => warnings.some((warning) => warning.includes(text))), [true, true, true]);

  if (errors.length) failures.push({case: 'no page errors', got: errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_INTEGRITY_OK');
