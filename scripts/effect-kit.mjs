#!/usr/bin/env node
// Usage: node scripts/effect-kit.mjs <effect directory> <built output root>
//
// The conformance kit of simai.effect 1.0.0: what a product runs on an effect
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
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

export async function runEffectKit(effectDirectory, outputRoot) {
  const effectRoot = resolve(effectDirectory);
  const out = resolve(outputRoot);
  const manifest = JSON.parse(readFileSync(join(effectRoot, 'effect.json'), 'utf8'));
  const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>effect kit</title>
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'effect-kit', pluginListVersion: 'effect-kit', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
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
  } finally {
    await browser.close();
    server.close();
  }
  return {ok: results.every((result) => result.ok), results};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [effectDirectory, outputRoot] = process.argv.slice(2);
  if (!effectDirectory || !outputRoot) {
    console.error('Usage: node scripts/effect-kit.mjs <effect directory> <built output root>');
    process.exit(2);
  }
  const {ok, results} = await runEffectKit(effectDirectory, outputRoot);
  for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.id}${result.detail ? ` ${JSON.stringify(result.detail)}` : ''}`);
  process.exit(ok ? 0 : 1);
}
