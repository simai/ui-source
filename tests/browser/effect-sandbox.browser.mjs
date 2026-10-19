#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.1, foreign-effects-sandboxed and pair-under-the-same-trust,
// on the built core. An effect from outside the pinned catalogue runs only in
// a frame sandboxed with allow-scripts alone (an opaque origin) under a
// strict content security policy, its module text and checked settings sent
// by message:
// - a benign foreign effect draws there (the area's pixels move), gets its
//   settings checked (an invalid stored value arrives as the default),
//   follows the page's scheme without a remount (the frame's document and
//   the area take the drawn theme), is paused while the tab is hidden and
//   while it is off screen, draws behind window cards when it declares the
//   capability, and leaves nothing after destroy;
// - a hostile foreign effect tries fetch, XHR, WebSocket, EventSource,
//   sendBeacon, image, script, stylesheet, CSS url(), import(), a nested
//   frame, a worker, the cookie, local and session storage, IndexedDB, the
//   parent's document and storage, top navigation, window.open, alert,
//   confirm, prompt and a form: no request reaches the router for its
//   beacon address, the page's cookie, storage and address are unchanged, no
//   popup opens and no dialog is shown;
// - a catalogue effect whose pair is a foreign address draws its pair in the
//   sandbox, never inline: the pair's module leaves its marks in the frame's
//   realm and none in the page's;
// - a frame that navigates itself away -- the one channel no policy closes,
//   carrying only what the frame was given -- is removed and reported;
// - with SF_BOOT_CONFIG.effects.foreign = 'refuse' both are refused again,
//   and no foreign address is asked for.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {FOREIGN_PAIR, EFFECTS, marked, openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};
const truthy = (name, got, detail = got) => {
  if (!got) failures.push({case: name, got: detail});
};

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'effect-sandbox');
const FOREIGN = 'https://foreign.test/effects/';
const BENIGN = `${FOREIGN}bands/effect.json`;
const HOSTILE = `${FOREIGN}hostile/effect.json`;
const WANDERER = `${FOREIGN}wanderer/effect.json`;
const file = (name) => readFileSync(join(fixtures, name), 'utf8');
const serve = new Map([
  [BENIGN, {type: 'application/json', body: file('benign/effect.json')}],
  [`${FOREIGN}bands/index.js`, {type: 'text/javascript', body: file('benign/index.js')}],
  [HOSTILE, {type: 'application/json', body: file('hostile/effect.json')}],
  [`${FOREIGN}hostile/index.js`, {type: 'text/javascript', body: file('hostile/index.js')}],
  // The pair of the catalogue's dusk-bands, by address: a light effect whose
  // module marks the realm it runs in.
  [FOREIGN_PAIR, {type: 'application/json', body: JSON.stringify({...EFFECTS['dusk-bands'], id: 'dawn-bands', label: {en: 'dawn-bands'}, schemes: ['light'], pair: undefined})}],
  [FOREIGN_PAIR.replace('effect.json', 'index.js'), {type: 'text/javascript', body: marked('dawn-bands')}],
  // An effect that navigates its own frame away: no policy stops a frame
  // from navigating itself, so the core removes a frame that leaves.
  [WANDERER, {type: 'application/json', body: JSON.stringify({...JSON.parse(file('hostile/effect.json')), id: 'wanderer'})}],
  [WANDERER.replace('effect.json', 'index.js'), {type: 'text/javascript', body: "export function mount() { setTimeout(() => { location.href = 'https://wander.test/away'; }, 50); return {}; }\n"}],
]);

const area = 'style="display:block;inline-size:300px;block-size:120px"';
const card = '<article data-sf-effect-window style="flex:1;border-radius:12px"></article>';
const body = `
<section id="benign" ${area} data-sf-effect="${BENIGN}" data-sf-effect-settings='{"bands": 999}'></section>
<section id="hostile" ${area} data-sf-effect="${HOSTILE}"></section>
<section id="dusk" ${area} data-sf-effect="dusk-bands"></section>
<div id="win" style="display:flex;gap:16px;padding:16px;inline-size:600px;block-size:140px;box-sizing:border-box" data-sf-effect-windows="${BENIGN}">${card}${card}</div>
<div id="win-hostile" style="display:flex;inline-size:300px;block-size:80px" data-sf-effect-windows="${HOSTILE}">${card}</div>
<div style="block-size:3000px"></div>`;
// The page's own cookie and storage, set before anything runs; every message
// a frame posts to the page is kept.
const head = `<script>document.cookie = 'own=1; path=/'; localStorage.setItem('own', '1'); sessionStorage.setItem('own', '1');
window.__messages = []; addEventListener('message', (event) => window.__messages.push(event.data));
window.__errors = []; document.addEventListener('sf-effect-error', (event) => window.__errors.push({target: event.target.closest('[id]')?.id ?? null, ...event.detail}));</script>`;

const ids = ['benign', 'hostile', 'dusk', 'win', 'win-hostile'];
const settled = (page, list) => page.waitForFunction((list) => list
  .every((id) => !['loading', null].includes(document.getElementById(id).getAttribute('data-sf-effect-state'))), list, {timeout: 15000});
const read = (page, id) => page.evaluate((id) => {
  const element = document.getElementById(id);
  const frame = element.querySelector('iframe');
  return {
    state: element.getAttribute('data-sf-effect-state'),
    reason: element.getAttribute('data-sf-effect-reason'),
    theme: ['theme-dark', 'theme-light'].filter((name) => element.classList.contains(name)),
    frames: element.querySelectorAll('iframe').length,
    canvases: element.querySelectorAll('canvas').length,
    sandbox: frame?.getAttribute('sandbox') ?? null,
  };
}, id);
// The sandbox frame inside an element, as Playwright reaches it.
const frameIn = async (page, id) => {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const element = await frame.frameElement().catch(() => null);
    if (element && await element.evaluate((node, id) => node.closest(`#${id}`) !== null, id)) return frame;
  }
  return null;
};
const luminance = (page, id) => page.locator(`#${id}`).screenshot().then((png) => page.evaluate(async (data) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const channel = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  let sum = 0;
  for (let index = 0; index < pixels.length; index += 4) sum += 0.2126 * channel(pixels[index]) + 0.7152 * channel(pixels[index + 1]) + 0.0722 * channel(pixels[index + 2]);
  return {mean: Number((sum / (pixels.length / 4)).toFixed(3)), hash: [...pixels].filter((_, index) => index % 397 === 0).join(',')};
}, png.toString('base64')));

// Polls until `read` answers `wanted` (the page's IntersectionObserver may take a frame or two).
const until = async (read, wanted, timeout = 3000) => {
  const end = Date.now() + timeout;
  let got = await read();
  while (JSON.stringify(got) !== JSON.stringify(wanted) && Date.now() < end) {
    await new Promise((done) => setTimeout(done, 100));
    got = await read();
  }
  return got;
};

const browser = await chromium.launch();
try {
  const dialogs = [];
  const sockets = [];
  const popups = [];
  const failed = [];
  const listen = (page) => {
    page.on('requestfailed', (request) => failed.push({url: request.url(), failure: request.failure()?.errorText ?? null}));
    page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.dismiss().catch(() => {}); });
    page.on('websocket', (socket) => sockets.push(socket.url()));
    page.on('popup', (popup) => popups.push(popup.url()));
    page.context().on('page', (other) => popups.push(other.url()));
  };
  const {page, requests, routed, errors} = await openPage(browser, out, {theme: 'theme-light', body, head, listen, serve});
  const address = page.url();
  await settled(page, ids);
  await page.waitForTimeout(400);
  expect('foreign effects run in the sandbox by default', await page.evaluate(() => window.SF.Effects.foreignMode()), 'sandbox');

  // The frame: allow-scripts alone, the policy in its document.
  const attributes = await page.evaluate(() => {
    const frame = document.querySelector('#benign iframe');
    return {
      sandbox: frame.getAttribute('sandbox'),
      referrer: frame.getAttribute('referrerpolicy'),
      hidden: frame.getAttribute('aria-hidden'),
      pointer: getComputedStyle(frame).pointerEvents,
      mounted: frame.getAttribute('data-sf-effect-sandbox'),
      policy: (/content="([^"]+)"/u.exec(frame.srcdoc) ?? [])[1],
      runner: (/<script>([\s\S]*)<\/script>/u.exec(frame.srcdoc) ?? [])[1],
      scripts: (frame.srcdoc.match(/<script/gu) ?? []).length,
    };
  });
  // The one script the policy admits by hash is the runner the frame holds.
  const runnerHash = createHash('sha256').update(attributes.runner ?? '', 'utf8').digest('base64');
  delete attributes.runner;
  expect('the frame is sandboxed with allow-scripts alone, under the policy', attributes, {
    sandbox: 'allow-scripts', referrer: 'no-referrer', hidden: 'true', pointer: 'none', mounted: 'mounted',
    policy: `default-src 'none'; script-src 'sha256-${runnerHash}' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'`,
    scripts: 1,
  });

  // Benign: drawn in the sandbox, its settings checked, in the page's scheme.
  expect('a benign foreign effect runs in a frame', await read(page, 'benign'), {state: 'running', reason: null, theme: ['theme-light'], frames: 1, canvases: 0, sandbox: 'allow-scripts'});
  const benign = await frameIn(page, 'benign');
  truthy('its frame is reachable', benign);
  const inside = () => benign.evaluate(() => ({...globalThis.__sandbox, origin: globalThis.origin, cookie: (() => { try { return document.cookie; } catch (error) { return error.name; } })()}));
  const first = await inside();
  expect('the frame has an opaque origin and no cookie', [first.origin, first.cookie], ['null', 'SecurityError']);
  expect('an invalid stored value arrives as the default (checked in the page)', first.settings, {bands: 5});
  expect('it draws in the page\'s scheme, its document in that theme', [first.scheme, first.theme], ['light', 'theme-light']);
  expect('its realm is not the page\'s', await page.evaluate(() => typeof window.__sandbox), 'undefined');
  const shotA = await luminance(page, 'benign');
  await page.waitForTimeout(300);
  const shotB = await luminance(page, 'benign');
  truthy('the area\'s pixels move', shotA.hash !== shotB.hash, {a: shotA.mean, b: shotB.mean});
  truthy('a light frame on a light page', shotB.mean >= 0.18, shotB);

  // Scheme switch: an update, not a remount.
  const frameNode = await page.evaluate(() => { window.__frameNode = document.querySelector('#benign iframe'); return true; });
  await page.evaluate(() => document.documentElement.classList.replace('theme-light', 'theme-dark'));
  await page.waitForTimeout(400);
  const dark = await inside();
  expect('a scheme switch reaches the frame as update', [dark.scheme, dark.theme, dark.updates >= 1], ['dark', 'theme-dark', true]);
  expect('the same frame stays', frameNode && await page.evaluate(() => document.querySelector('#benign iframe') === window.__frameNode), true);
  expect('the area takes the drawn theme', (await read(page, 'benign')).theme, ['theme-dark']);
  const shotDark = await luminance(page, 'benign');
  truthy('a dark frame on a dark page', shotDark.mean < 0.18, shotDark);

  // Hidden tab, then off screen: paused by message, resumed after.
  const frames = async () => (await inside()).frames;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  const hiddenFrom = await frames();
  await page.waitForTimeout(400);
  const hiddenState = await inside();
  expect('a hidden tab pauses it', [hiddenState.paused, hiddenState.frames - hiddenFrom <= 1], [true, true]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect('shown again, it resumes', await until(async () => (await inside()).paused, false), false);
  await page.evaluate(() => window.scrollTo(0, 2600));
  await page.waitForTimeout(400);
  const offFrom = await frames();
  await page.waitForTimeout(400);
  const offState = await inside();
  expect('off screen it is paused', [offState.paused, offState.frames - offFrom <= 1], [true, true]);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect('back on screen, it resumes', await until(async () => (await inside()).paused, false), false);
  await page.evaluate(() => document.documentElement.classList.replace('theme-dark', 'theme-light'));
  await page.waitForTimeout(300);

  // Windows: a foreign effect that declares the capability, behind the window cards.
  const windows = await page.evaluate(() => {
    const group = document.getElementById('win');
    const layer = group.querySelector('[data-sf-effect-layer]');
    return {
      state: group.getAttribute('data-sf-effect-state'),
      clipped: /^path\(/u.test(layer?.style.clipPath ?? ''),
      frameInLayer: layer?.querySelector('iframe')?.getAttribute('sandbox') ?? null,
      cards: [...group.querySelectorAll('[data-sf-effect-window]')].map((node) => node.classList.contains('theme-light')),
    };
  });
  expect('windows: one sandboxed scene behind the cards, clipped to them', windows, {state: 'running', clipped: true, frameInLayer: 'allow-scripts', cards: [true, true]});
  expect('windows: refused without the capability', await read(page, 'win-hostile'), {state: 'refused', reason: 'windows-not-declared', theme: [], frames: 0, canvases: 0, sandbox: null});

  // Hostile: every attempt contained.
  await page.waitForFunction(() => window.__messages.some((message) => message?.sfSandboxProbe === 'hostile'), null, {timeout: 60000});
  await page.waitForTimeout(500);
  const report = (await page.evaluate(() => window.__messages.find((message) => message?.sfSandboxProbe === 'hostile'))).results;
  const blocked = {
    // Requests: each refused before it leaves (the router below is the proof).
    fetch: /^threw/u, xhr: /^threw/u, websocket: /^threw/u, eventsource: /^threw/u,
    // Queued (true) and then refused by connect-src: the router is the proof.
    sendBeacon: /./u,
    image: /^threw/u, script: /^threw/u, stylesheet: /^threw/u, import: /^threw/u,
    cssUrl: /./u, iframe: /./u,
    // Created, and its blob script then refused by worker-src 'none'.
    worker: /./u,
    // The page's data: out of reach.
    cookieRead: /^threw SecurityError/u, cookieWrite: /^threw SecurityError/u, localStorage: /^threw SecurityError/u,
    sessionStorage: /^threw SecurityError/u, indexedDB: /^threw SecurityError/u,
    parentDocument: /^threw SecurityError/u, topDocument: /^threw SecurityError/u, parentStorage: /^threw SecurityError/u,
    frameElement: /^returned null$/u,
    // Popups, dialogs, forms and top navigation: ignored or thrown.
    open: /^returned null$/u, alert: /^returned undefined$/u, confirm: /^returned false$/u, prompt: /^returned null$/u,
    form: /./u, topNavigation: /./u, topNavigationHref: /./u,
  };
  for (const [name, pattern] of Object.entries(blocked)) truthy(`hostile ${name}: contained`, pattern.test(report[name] ?? ''), report[name] ?? 'not attempted');
  const beacon = (url) => url.startsWith('https://beacon.test/') || url.startsWith('wss://beacon.test/');
  expect('hostile: no request reached the router for a beacon address', routed.filter(beacon), []);
  // What the browser was asked for and refused: each one blocked by the frame's policy.
  const refusedBy = [...new Set(failed.filter(({url}) => beacon(url)).map(({failure}) => failure))];
  const asked = requests.filter(beacon);
  expect('hostile: every beacon the browser saw was blocked by the policy', [asked.length === failed.filter(({url}) => beacon(url)).length, refusedBy], [true, asked.length ? ['csp'] : []]);
  expect('hostile: no WebSocket was opened', sockets, []);
  expect('hostile: no dialog was shown', dialogs, []);
  expect('hostile: no popup was opened', popups, []);
  expect('hostile: the page\'s address is unchanged', page.url(), address);
  expect('hostile: the page\'s cookie and storage are unchanged', await page.evaluate(() => ({
    cookie: document.cookie,
    local: [localStorage.getItem('own'), localStorage.getItem('stolen')],
    session: [sessionStorage.getItem('own'), sessionStorage.getItem('stolen')],
  })), {cookie: 'own=1', local: ['1', null], session: ['1', null]});
  expect('hostile: its frame is still the runner (it did not navigate)', (await read(page, 'hostile')).state, 'running');

  // A catalogue effect with a foreign pair: on a light page the pair is drawn, sandboxed.
  expect('a foreign pair is drawn in the sandbox', await read(page, 'dusk'), {state: 'running', reason: null, theme: ['theme-light'], frames: 1, canvases: 0, sandbox: 'allow-scripts'});
  const dawn = await frameIn(page, 'dusk');
  const realms = {
    page: await page.evaluate(() => ({ran: (window.__effectRan ?? []).includes('dawn-bands'), mounted: (window.__effectMounted ?? []).includes('dawn-bands')})),
    frame: dawn ? await dawn.evaluate(() => ({ran: (globalThis.__effectRan ?? []).includes('dawn-bands'), mounted: (globalThis.__effectMounted ?? []).includes('dawn-bands')})) : null,
  };
  expect('the pair\'s module ran in the frame\'s realm, never in the page\'s', realms, {page: {ran: false, mounted: false}, frame: {ran: true, mounted: true}});
  await page.evaluate(() => document.documentElement.classList.replace('theme-light', 'theme-dark'));
  await page.waitForTimeout(400);
  expect('on a dark page the catalogue effect draws itself, inline', await read(page, 'dusk'), {state: 'running', reason: null, theme: ['theme-dark'], frames: 0, canvases: 1, sandbox: null});
  await page.evaluate(() => document.documentElement.classList.replace('theme-dark', 'theme-light'));
  await page.waitForTimeout(400);

  // The JS API: a foreign pair runs only as the sandbox module loadEffect made.
  const api = await page.evaluate(async ({manifest, pairUrl, benign}) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:relative;inline-size:100px;block-size:60px';
    document.body.prepend(host);
    let rawMounted = false;
    const raw = {manifest: {...manifest, id: 'dawn-bands', schemes: ['light'], pair: undefined}, module: {mount() { rawMounted = true; return {}; }}};
    const refused = window.SF.Effects.mountEffect(host, {manifest, module: {mount: () => ({})}, pair: raw, themeMode: 'light'});
    const handed = {effect: refused.effect, reason: refused.resolution.reason, rawMounted, sandboxed: refused.sandboxed};
    refused.destroy();
    const loaded = await window.SF.Effects.loadEffect(pairUrl);
    const placed = window.SF.Effects.mountEffect(host, {manifest, module: {mount: () => ({})}, pair: loaded, themeMode: 'light'});
    const viaLoad = {sandboxed: loaded.sandboxed, effect: placed.effect, handle: placed.sandboxed, frames: host.querySelectorAll('iframe').length};
    placed.destroy();
    // placeEffect's handle, then destroy: nothing left behind.
    const element = document.createElement('section');
    element.style.cssText = 'display:block;inline-size:200px;block-size:80px';
    document.body.prepend(element);
    const handle = await window.SF.Effects.placeEffect(element, {effect: benign, settings: {bands: 3}});
    await new Promise((done) => setTimeout(done, 400));
    const running = {sandboxed: handle.sandboxed, effect: handle.effect, frames: element.querySelectorAll('iframe').length, mounted: element.querySelector('iframe')?.getAttribute('data-sf-effect-sandbox')};
    handle.destroy();
    const after = {layers: element.querySelectorAll('[data-sf-effect-layer]').length, frames: element.querySelectorAll('iframe').length, state: element.getAttribute('data-sf-effect-state'), nodes: host.childNodes.length};
    host.remove();
    element.remove();
    return {handed, viaLoad, running, after};
  }, {manifest: EFFECTS['dusk-bands'], pairUrl: FOREIGN_PAIR, benign: BENIGN});
  expect('the JS API never runs a foreign pair handed in as a module', api.handed, {effect: null, reason: 'foreign-pair-needs-sandbox', rawMounted: false, sandboxed: false});
  expect('a foreign pair from loadEffect runs sandboxed', api.viaLoad, {sandboxed: true, effect: 'pair', handle: true, frames: 1});
  expect('placeEffect of a foreign effect: sandboxed: true', api.running, {sandboxed: true, effect: 'self', frames: 1, mounted: 'mounted'});
  expect('destroy leaves nothing behind', api.after, {layers: 0, frames: 0, state: null, nodes: 0});
  await page.waitForTimeout(200);
  const attached = page.frames().filter((frame) => frame.parentFrame() === page.mainFrame()).length;
  expect('only the placements on the page keep a frame', attached, 4);

  // Each foreign file was asked for once: the module runs from those bytes.
  const foreign = requests.filter((url) => url.startsWith('https://foreign.test/'));
  expect('each foreign file is asked for once', [...new Set(foreign)].length === foreign.length, true);
  expect('the foreign files asked for', [...new Set(foreign)].map((url) => url.slice('https://foreign.test/effects/'.length)).sort(),
    ['bands/effect.json', 'bands/index.js', 'dawn-bands/effect.json', 'dawn-bands/index.js', 'hostile/effect.json', 'hostile/index.js']);
  const sandboxErrors = await page.evaluate(() => window.__errors);
  expect('no effect error was reported', sandboxErrors, []);
  if (errors.length) failures.push({case: 'no page errors', got: errors});
  console.log(JSON.stringify({hostile: report, blockedByPolicy: failed.filter(({url}) => beacon(url))}, null, 2));
  await page.context().close();

  // A frame that navigates itself away is removed and reported; what it was
  // given (its settings, size and scheme) is all the address could carry.
  const wander = await openPage(browser, out, {theme: 'theme-light', serve, head, body: `<section id="wanderer" ${area} data-sf-effect="${WANDERER}"></section>`});
  await settled(wander.page, ['wanderer']);
  const gone = await until(() => wander.page.evaluate(() => ({frames: document.querySelectorAll('#wanderer iframe').length, errors: window.__errors.map(({target, phase, sandboxed}) => ({target, phase, sandboxed}))})),
    {frames: 0, errors: [{target: 'wanderer', phase: 'sandbox', sandboxed: true}]});
  expect('a frame that navigates itself away is removed and reported', gone, {frames: 0, errors: [{target: 'wanderer', phase: 'sandbox', sandboxed: true}]});
  const wandered = wander.routed.filter((url) => url.startsWith('https://wander.test/'));
  expect('self-navigation is the residual channel: the address is asked for once, then the frame is gone', wandered, ['https://wander.test/away']);
  await wander.context.close();

  // foreign: 'refuse' restores the refusal.
  const refusedPage = await openPage(browser, out, {theme: 'theme-light', effects: {foreign: 'refuse'}, serve, body: `
<section id="benign" ${area} data-sf-effect="${BENIGN}"></section>
<section id="dusk" ${area} data-sf-effect="dusk-bands"></section>`});
  await settled(refusedPage.page, ['benign', 'dusk']);
  await refusedPage.page.waitForTimeout(200);
  expect('refuse: the mode', await refusedPage.page.evaluate(() => window.SF.Effects.foreignMode()), 'refuse');
  expect('refuse: a foreign effect is refused', await read(refusedPage.page, 'benign'), {state: 'refused', reason: 'foreign-effect-needs-sandbox', theme: [], frames: 0, canvases: 0, sandbox: null});
  expect('refuse: a foreign pair is not drawn', await read(refusedPage.page, 'dusk'), {state: 'hidden', reason: 'foreign-pair-needs-sandbox', theme: ['theme-light'], frames: 0, canvases: 0, sandbox: null});
  expect('refuse: no foreign address is asked for', refusedPage.requests.filter((url) => !url.startsWith('https://probe.test/')), []);
  if (refusedPage.errors.length) failures.push({case: 'refuse: no page errors', got: refusedPage.errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_SANDBOX_OK');
