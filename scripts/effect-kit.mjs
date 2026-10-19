#!/usr/bin/env node
// Usage: node scripts/effect-kit.mjs <effect directory> <built output root> [--sandbox]
//
// The conformance kit of simai.effect 1.1.0: what a product runs on an effect
// before it lists or installs it. The effect directory holds effect.json and
// the files it names; the built output is a Framework build (core.js serves
// SF.Effects). Each check is printed with its result; the exit code is 1 when
// any fails.
//
//   manifest       effect.json holds against simai.effect.v1
//   defaults       every setting's default is a valid value
//   mounts         mount() answers update/pause/resume/destroy and draws in the host
//   no-network     nothing is requested beyond the effect's own files
//   still-motion   with reduced motion it draws and then stops asking for frames
//   hidden-tab     while the tab is hidden it asks for no frames
//   pixel-ratio    a canvas it draws is at most twice the host's size
//   update         update() with new settings does not remount (the host keeps its nodes)
//   cleanup        after destroy() the host is empty and no frames are asked for
//   remount        it mounts again after destroy()
//   accessibility  the host is out of the accessibility tree and out of the pointer's way
//
// simai.effect 1.1, run when the manifest declares them (a 1.0 manifest gets the
// eleven checks above and nothing more):
//
//   scheme-<s>     for each declared scheme: drawn in a .theme-<s> area, every
//                  sampled frame has that scheme's polarity (mean relative
//                  luminance below 0.18 for dark, at or above it for light)
//   contrast-<s>   over the worst of five frames, text in the area's roles
//                  measures, against 95 % of the pixels (the 5th percentile),
//                  at least 4.5:1 for --sf-on-surface and 3:1 for
//                  --sf-on-surface-variant (dimmed text over an effect is large)
//   scheme-switch  a two-scheme effect switches through update(settings,
//                  {scheme}) without a remount, and the frame changes polarity
//   windows        capability windows: drawn once behind a group of three window
//                  cards under a mask, nothing shows outside the windows, the
//                  scene spans the whole group, and all of it holds after the
//                  group narrows and the mask is rebuilt
//   pair           a pair given as a URL is outside the catalogue: noted as
//                  running only in the sandbox runner, never inline; an id is
//                  noted as resolved against the catalogue and its index digest
//
// With --sandbox (runEffectKit(..., {sandbox: true})), as a foreign effect:
//
//   sandbox        loaded by its effect.json address, it runs in the sandboxed
//                  frame (handle.sandboxed), mounts there without an error,
//                  draws (the host's pixels change), and destroy leaves the
//                  host empty
//
// The contrast and polarity checks sample frames, so an effect draws
// deterministically at its defaults: no unseeded Math.random -- seed any
// randomness (a fixed seed, or one derived from the settings) so every run
// draws the same scene. The catalogue found a randomly placed template that
// failed contrast about one run in two. (Guidance for area-takes-the-drawn-
// theme; simai.effect 1.1.0's published bytes do not change, so it is stated
// here and in docs/developer/background-effects.md.)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

export async function runEffectKit(effectDirectory, outputRoot, {sandbox = false} = {}) {
  const effectRoot = resolve(effectDirectory);
  const out = resolve(outputRoot);
  const manifest = JSON.parse(readFileSync(join(effectRoot, 'effect.json'), 'utf8'));
  const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>effect kit</title>
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'effect-kit', pluginListVersion: 'effect-kit', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
</head><body style="margin:0"><div id="host" style="position:relative;inline-size:400px;block-size:300px"></div>
<script src="/distr/core/js/core.js"></script></body></html>`;
  const requests = [];
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    requests.push(path);
    if (path === '/kit.html') {
      response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      return response.end(page);
    }
    const [prefix, root] = path.startsWith('/effect/') ? ['/effect/', effectRoot] : path.startsWith('/distr/core/') ? ['/distr/core/', join(out, 'core', 'core')] : [null, null];
    if (!prefix) { response.writeHead(404); return response.end(); }
    const file = resolve(root, path.slice(prefix.length));
    if (!file.startsWith(root + sep) || !existsSync(file)) { response.writeHead(404); return response.end(); }
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/javascript';
    response.writeHead(200, {'content-type': `${type}; charset=utf-8`});
    response.end(await readFile(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  const check = (id, ok, detail = null) => results.push({id, ok: Boolean(ok), ...(detail === null ? {} : {detail})});
  const browser = await chromium.launch();
  try {
    const run = async ({reducedMotion = 'no-preference'} = {}) => {
      const context = await browser.newContext({reducedMotion});
      const tab = await context.newPage();
      await tab.goto(`${base}/kit.html`);
      await tab.waitForFunction(() => window.SF?.Effects, null, {timeout: 10000});
      await tab.evaluate(() => {
        // Frames asked for, counted from here on.
        window.__frames = 0;
        const own = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (fn) => { window.__frames += 1; return own(fn); };
      });
      return {context, tab};
    };
    const mountIn = (tab, manifestValue, entry) => tab.evaluate(async ({manifestValue, entry}) => {
      const module = await import(`/effect/${entry}`);
      window.__handle = window.SF.Effects.mountEffect(document.getElementById('host'), {manifest: manifestValue, module});
      return Object.keys(window.__handle);
    }, {manifestValue, entry});
    const wait = (tab, ms) => tab.waitForTimeout(ms);
    const frames = (tab) => tab.evaluate(() => window.__frames);

    // manifest and defaults, without running anything.
    const plain = await run();
    const problems = await plain.tab.evaluate((value) => window.SF.Effects.checkEffectManifest(value), manifest);
    check('manifest', problems.length === 0, problems.length ? problems : null);
    check('defaults', !problems.some((problem) => /default/u.test(problem)));
    if (problems.length) return {ok: false, results};

    const before = requests.length;
    const methods = await mountIn(plain.tab, manifest, manifest.entry);
    await wait(plain.tab, 400);
    const drawn = await plain.tab.evaluate(() => document.getElementById('host').children.length);
    check('mounts', ['update', 'pause', 'resume', 'destroy'].every((name) => methods.includes(name)) && drawn > 0, {methods, nodes: drawn});
    const own = (path) => path.startsWith('/effect/') || path.startsWith('/distr/core/');
    const foreign = requests.slice(before).filter((path) => !own(path));
    check('no-network', foreign.length === 0, foreign.length ? foreign : null);
    const host = await plain.tab.evaluate(() => {
      const element = document.getElementById('host');
      const canvas = element.querySelector('canvas');
      const box = element.getBoundingClientRect();
      return {hidden: element.getAttribute('aria-hidden'), pointer: getComputedStyle(element).pointerEvents,
        canvas: canvas ? {width: canvas.width, height: canvas.height, max: [box.width * 2, box.height * 2]} : null};
    });
    check('accessibility', host.hidden === 'true' && host.pointer === 'none', host);
    check('pixel-ratio', !host.canvas || (host.canvas.width <= host.canvas.max[0] && host.canvas.height <= host.canvas.max[1]), host.canvas);
    const kept = await plain.tab.evaluate((value) => {
      const host = document.getElementById('host');
      const first = host.firstElementChild;
      window.__handle.update(Object.fromEntries(value.settings.map((setting) => [setting.key, setting.default])));
      return Boolean(first) && host.firstElementChild === first;
    }, manifest);
    check('update', kept);

    // hidden tab: no frames asked for while hidden.
    await plain.tab.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(plain.tab, 150);
    const hiddenFrom = await frames(plain.tab);
    await wait(plain.tab, 500);
    const hiddenTo = await frames(plain.tab);
    check('hidden-tab', hiddenTo - hiddenFrom <= 1, {frames: hiddenTo - hiddenFrom});
    await plain.tab.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => false});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(plain.tab, 200);

    // cleanup and remount.
    await plain.tab.evaluate(() => window.__handle.destroy());
    await wait(plain.tab, 150);
    const afterFrom = await frames(plain.tab);
    await wait(plain.tab, 400);
    const afterTo = await frames(plain.tab);
    const left = await plain.tab.evaluate(() => document.getElementById('host').childNodes.length);
    check('cleanup', left === 0 && afterTo - afterFrom === 0, {nodes: left, frames: afterTo - afterFrom});
    const again = await mountIn(plain.tab, manifest, manifest.entry).then(() => plain.tab.evaluate(() => document.getElementById('host').children.length), () => 0);
    check('remount', again > 0, {nodes: again});
    await plain.tab.evaluate(() => window.__handle.destroy());
    await plain.context.close();

    // reduced motion: draws, then asks for no frames.
    const still = await run({reducedMotion: 'reduce'});
    await mountIn(still.tab, manifest, manifest.entry);
    await wait(still.tab, 200);
    const stillFrom = await frames(still.tab);
    await wait(still.tab, 500);
    const stillTo = await frames(still.tab);
    const stillNodes = await still.tab.evaluate(() => document.getElementById('host').children.length);
    check('still-motion', stillNodes > 0 && stillTo - stillFrom === 0, {frames: stillTo - stillFrom, nodes: stillNodes});
    await still.context.close();

    // simai.effect 1.1: only what the manifest declares is checked.
    await checkSchemes({manifest, run, check, wait});
    if ((manifest.capabilities ?? []).includes('windows')) await checkWindows({manifest, run, check, wait});
    if (sandbox) await checkSandbox({run, check, wait});
    if (typeof manifest.pair === 'string') {
      const foreign = /^https:\/\//u.test(manifest.pair);
      check('pair', true, foreign
        ? {pair: manifest.pair, foreign: true, note: 'outside the pinned catalogue: runs only in the sandbox runner (refused with effects.foreign = refuse), never inline'}
        : {pair: manifest.pair, foreign: false, note: 'resolved against the catalogue base and checked against its index digest'});
    }
  } finally {
    await browser.close();
    server.close();
  }
  return {ok: results.every((result) => result.ok), results};
}

// As a foreign effect, in the sandbox: loaded by address, drawn in the frame.
async function checkSandbox({run, check, wait}) {
  const {context, tab} = await run();
  const shot = () => tab.locator('#host').screenshot().then((png) => png.toString('base64'));
  const blank = await shot();
  const mounted = await tab.evaluate(async () => {
    window.__sandboxErrors = [];
    document.addEventListener('sf-effect-error', (event) => window.__sandboxErrors.push(event.detail));
    try {
      const effect = await window.SF.Effects.loadEffect(`${location.origin}/effect/effect.json`);
      window.__handle = window.SF.Effects.mountEffect(document.getElementById('host'), {manifest: effect.manifest, module: effect.module});
      return {loaded: effect.sandboxed, handle: window.__handle.sandboxed};
    } catch (error) {
      return {refused: error.reason ?? String(error)};
    }
  });
  await wait(tab, 800);
  const drawn = await shot();
  const state = await tab.evaluate(() => ({
    frame: document.querySelector('#host iframe')?.getAttribute('data-sf-effect-sandbox') ?? null,
    errors: window.__sandboxErrors,
  }));
  if (mounted.handle) await tab.evaluate(() => window.__handle.destroy());
  const left = await tab.evaluate(() => document.getElementById('host').childNodes.length);
  await context.close();
  check('sandbox', mounted.loaded === true && mounted.handle === true && state.frame === 'mounted' && !state.errors.length && drawn !== blank && left === 0,
    {...mounted, frame: state.frame, errors: state.errors, draws: drawn !== blank, nodesAfterDestroy: left});
}

// simai.effect 1.1: schemes, contrast, windows --------------------------------

const POLARITY = 0.18; // mean relative luminance between a dark and a light frame
// Text over an effect (owner, 2026-10-19, variant 1): the primary role at
// 4.5:1, the text WCAG calls normal; the dimmed role at 3:1, which WCAG allows
// for large text (24px, or 18.66px bold) -- so dimmed text over an effect is
// large, and small text there takes the primary role.
const CONTRAST = Object.freeze({'--sf-on-surface': 4.5, '--sf-on-surface-variant': 3});
const TEXT_ROLES = Object.keys(CONTRAST);
const MAGENTA = [255, 0, 255]; // the page behind a windows group: no effect draws it

// A screenshot decoded in the page: its luminance mean, the 5th percentile of
// contrast for each named colour, and -- given window rectangles -- how many
// sampled pixels outside them are not the page colour and what share inside
// them is drawn.
const measure = (tab, png, {colors = {}, rects = null} = {}) => tab.evaluate(async ({data, colors, rects, magenta}) => {
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
  const luminance = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const parse = (color) => {
    const probe = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return luminance(r, g, b);
  };
  if (rects) {
    const within = (x, y, inset) => rects.some((rect) => x >= rect.x + inset && x < rect.x + rect.w - inset && y >= rect.y + inset && y < rect.y + rect.h - inset);
    let leaked = 0;
    let inside = 0;
    let drawn = 0;
    for (let y = 0; y < image.height; y += 2) {
      for (let x = 0; x < image.width; x += 2) {
        const index = (y * image.width + x) * 4;
        const page = Math.abs(pixels[index] - magenta[0]) + Math.abs(pixels[index + 1] - magenta[1]) + Math.abs(pixels[index + 2] - magenta[2]) <= 6;
        // Edges (a window's corners and antialiasing) count as neither.
        if (within(x, y, 14)) { inside += 1; if (!page) drawn += 1; } else if (!within(x, y, -2) && !page) leaked += 1;
      }
    }
    return {leaked, drawn: Number((drawn / Math.max(inside, 1)).toFixed(3))};
  }
  const lums = [];
  for (let index = 0; index < pixels.length; index += 4) lums.push(luminance(pixels[index], pixels[index + 1], pixels[index + 2]));
  const mean = lums.reduce((sum, value) => sum + value, 0) / lums.length;
  const contrast = {};
  for (const [name, color] of Object.entries(colors)) {
    const text = parse(color);
    const ratios = lums.map((value) => (Math.max(value, text) + 0.05) / (Math.min(value, text) + 0.05)).sort((a, b) => a - b);
    contrast[name] = Number(ratios[Math.floor(ratios.length * 0.05)].toFixed(2));
  }
  return {mean: Number(mean.toFixed(3)), contrast};
}, {data: png.toString('base64'), colors, rects, magenta: MAGENTA});

const mountWith = (tab, manifest, hostId, scheme) => tab.evaluate(async ({manifest, hostId, scheme}) => {
  const module = await import(`/effect/${manifest.entry}`);
  window.__handle = window.SF.Effects.mountEffect(document.getElementById(hostId), {manifest, module, scheme});
}, {manifest, hostId, scheme});

const defaults = (manifest) => Object.fromEntries(manifest.settings.map((setting) => [setting.key, setting.default]));

// The area of a scheme: the host takes .theme-<scheme> and that theme's surface.
async function areaOf({run, manifest, scheme}) {
  const {context, tab} = await run();
  await tab.evaluate((scheme) => {
    const host = document.getElementById('host');
    host.className = `theme-${scheme}`;
    host.style.background = 'var(--sf-surface-0)';
  }, scheme);
  await mountWith(tab, manifest, 'host', scheme);
  return {context, tab};
}

async function checkSchemes({manifest, run, check, wait}) {
  if (!Array.isArray(manifest.schemes)) return;
  const shot = (tab) => tab.locator('#host').screenshot();
  const polar = (scheme, mean) => (scheme === 'dark' ? mean < POLARITY : mean >= POLARITY);
  for (const scheme of manifest.schemes) {
    const {context, tab} = await areaOf({run, manifest, scheme});
    await wait(tab, 400);
    // A role resolved as text in the area would be: a probe element there, so
    // var() chains and light-dark() settle in the area's scheme.
    const colors = await tab.evaluate((roles) => {
      const host = document.getElementById('host');
      const style = getComputedStyle(host);
      const probe = document.createElement('span');
      host.append(probe);
      const resolved = Object.fromEntries(roles.filter((role) => style.getPropertyValue(role).trim()).map((role) => {
        probe.style.color = `var(${role})`;
        return [role, getComputedStyle(probe).color];
      }));
      probe.remove();
      return resolved;
    }, TEXT_ROLES);
    const frames = [];
    for (let index = 0; index < 5; index += 1) {
      frames.push(await measure(tab, await shot(tab), {colors}));
      await wait(tab, 450);
    }
    const means = frames.map((frame) => frame.mean);
    check(`scheme-${scheme}`, means.every((mean) => polar(scheme, mean)), {mean: means, threshold: POLARITY});
    const worst = Object.fromEntries(Object.keys(colors).map((role) => [role, Math.min(...frames.map((frame) => frame.contrast[role]))]));
    check(`contrast-${scheme}`, Object.keys(worst).length === TEXT_ROLES.length && Object.entries(worst).every(([role, ratio]) => ratio >= CONTRAST[role]), {p5: worst, needs: CONTRAST});
    await tab.evaluate(() => window.__handle.destroy());
    await context.close();
  }
  if (manifest.schemes.length !== 2) return;
  const [home, other] = manifest.schemes;
  const {context, tab} = await areaOf({run, manifest, scheme: home});
  await wait(tab, 400);
  const before = await measure(tab, await shot(tab));
  const kept = await tab.evaluate(({settings, other}) => {
    const host = document.getElementById('host');
    const first = host.firstElementChild;
    host.className = `theme-${other}`;
    window.__handle.update(settings, {scheme: other});
    return Boolean(first) && host.firstElementChild === first && window.__handle.scheme === other;
  }, {settings: defaults(manifest), other});
  await wait(tab, 500);
  const after = await measure(tab, await shot(tab));
  check('scheme-switch', kept && polar(other, after.mean), {kept, from: before.mean, to: after.mean});
  await tab.evaluate(() => window.__handle.destroy());
  await context.close();
}

// One scene behind a group of window cards, seen only through them.
async function checkWindows({manifest, run, check, wait}) {
  const {context, tab} = await run();
  const scheme = (manifest.schemes ?? ['dark'])[0];
  await tab.evaluate(({scheme, magenta}) => {
    document.getElementById('host').remove();
    document.body.style.background = `rgb(${magenta.join(',')})`;
    const card = '<div class="window" style="position:relative;flex:1;border-radius:12px"></div>';
    document.body.insertAdjacentHTML('beforeend', `<div id="group" class="theme-${scheme}" style="position:relative;display:flex;gap:24px;padding:24px;box-sizing:border-box;block-size:300px"><div id="windows-host" style="position:absolute;inset:0"></div>${card}${card}${card}</div>`);
  }, {scheme, magenta: MAGENTA});
  // Lays the group out at a width and rebuilds the mask: one opaque layer per window.
  const layout = (width) => tab.evaluate((width) => {
    const group = document.getElementById('group');
    group.style.inlineSize = `${width}px`;
    const box = group.getBoundingClientRect();
    const rects = [...group.querySelectorAll('.window')].map((card) => {
      const rect = card.getBoundingClientRect();
      return {x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height};
    });
    const host = document.getElementById('windows-host');
    for (const prefix of ['', '-webkit-']) {
      host.style.setProperty(`${prefix}mask-image`, rects.map(() => 'linear-gradient(#000, #000)').join(', '));
      host.style.setProperty(`${prefix}mask-size`, rects.map((rect) => `${rect.w}px ${rect.h}px`).join(', '));
      host.style.setProperty(`${prefix}mask-position`, rects.map((rect) => `${rect.x}px ${rect.y}px`).join(', '));
      host.style.setProperty(`${prefix}mask-repeat`, 'no-repeat');
    }
    return rects;
  }, width);
  const scene = () => tab.evaluate(() => {
    const host = document.getElementById('windows-host');
    const box = host.getBoundingClientRect();
    const child = host.firstElementChild?.getBoundingClientRect();
    return {nodes: host.children.length, spans: Boolean(child) && Math.abs(child.width - box.width) <= 1 && Math.abs(child.height - box.height) <= 1};
  });
  const shot = () => tab.locator('#group').screenshot();
  let rects = await layout(720);
  await mountWith(tab, manifest, 'windows-host', scheme);
  await wait(tab, 500);
  const wide = {...await measure(tab, await shot(), {rects}), ...await scene()};
  rects = await layout(480);
  await wait(tab, 500);
  const narrow = {...await measure(tab, await shot(), {rects}), ...await scene()};
  const holds = (state) => state.leaked === 0 && state.drawn > 0.5 && state.nodes > 0 && state.spans;
  check('windows', holds(wide) && holds(narrow), {wide, narrow});
  await tab.evaluate(() => window.__handle.destroy());
  await context.close();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [effectDirectory, outputRoot, flag] = process.argv.slice(2);
  if (!effectDirectory || !outputRoot || (flag !== undefined && flag !== '--sandbox')) {
    console.error('Usage: node scripts/effect-kit.mjs <effect directory> <built output root> [--sandbox]');
    process.exit(2);
  }
  const {ok, results} = await runEffectKit(effectDirectory, outputRoot, {sandbox: flag === '--sandbox'});
  for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.id}${result.detail ? ` ${JSON.stringify(result.detail)}` : ''}`);
  process.exit(ok ? 0 : 1);
}
