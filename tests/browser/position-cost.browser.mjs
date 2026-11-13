#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// SF.Position follows a scroll without measuring the document (datepicker
// audit P1/P2, 2026-11-11). Each run used to resolve its token lengths with a
// probe span (a document-wide restyle) and reset max-height to read the panel
// back, once per scroll event: 800 px of scrolling with a panel open cost about
// 2 s of style recalculation on a docs page. Now:
// - no probe span is added while the page scrolls;
// - the panel is placed at most once per frame;
// - where a scroll leaves it is exactly where a full fit puts it (flip
//   included: the panel near the bottom flips above, then back below);
// - a resize still resolves the lengths again.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const assets = ['core/core/css/core.css', 'core/core/js/core.js'].map((path) => join(out, path));
const absent = assets.filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const origin = 'http://probe.test';
const filler = Array.from({length: 600}, (_, index) => `<p class="row"><span>row ${index}</span></p>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/core/core/css/core.css">
<style>
  body{margin:0} .row{margin:0;block-size:20px} main:has(.row:hover){outline:0}
  #field{display:block;inline-size:200px;block-size:40px;margin-inline-start:100px;background:#ddd}
  #panel{inline-size:240px;block-size:300px;background:#fff;border:1px solid #888;overflow:auto}
</style>
<script>window.sfPath='/core/';window.SF_BOOT_CONFIG={icons:{enabled:false},preloader:{enabled:false},theme:false};</script>
</head><body><main>${filler.slice(0, filler.length / 2)}<div id="field"></div><div id="panel"><div style="block-size:280px"></div></div>${filler.slice(filler.length / 2)}</main>
<script src="/core/core/js/core.js"></script></body></html>`;

const browser = await chromium.launch();
const failures = [];
const check = (ok, name, detail) => { if (!ok) failures.push({name, detail}); };
try {
  const page = await browser.newPage({viewport: {width: 800, height: 600}});
  await page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
    const file = join(out, path);
    if (!existsSync(file)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript', body: readFileSync(file)});
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => globalThis.SF?.Position?.anchor);
  await page.evaluate(() => {
    const field = document.getElementById('field');
    field.scrollIntoView({block: 'center', behavior: 'instant'});
    window.__runs = 0;
    window.__probes = 0;
    new MutationObserver((list) => {
      for (const record of list) for (const node of record.addedNodes) if (node.nodeName === 'SPAN' && node.style?.visibility === 'hidden') window.__probes += 1;
    }).observe(document.documentElement, {childList: true, subtree: true});
    window.__anchor = SF.Position.anchor(field, document.getElementById('panel'), {
      offset: 'var(--sf-space-1\\/4)', padding: 'var(--sf-space-1\\/2)', topLayer: false,
      onPosition: () => { window.__runs += 1; },
    });
  });
  await page.waitForTimeout(300);
  const place = () => page.evaluate(() => {
    const field = document.getElementById('field').getBoundingClientRect();
    const panel = document.getElementById('panel');
    const box = panel.getBoundingClientRect();
    return {side: panel.dataset.sfSide, dx: Math.round((box.left - field.left) * 100) / 100, gapBelow: Math.round((box.top - field.bottom) * 100) / 100, gapAbove: Math.round((field.top - box.bottom) * 100) / 100, maxHeight: panel.style.maxHeight};
  });
  const opened = await place();
  check(opened.side === 'block-end', 'opens below', opened);

  // Scroll the page in steps, the field moving towards the bottom (the panel flips above) and back.
  const scroll = async (deltas) => {
    await page.evaluate(() => { window.__runs = 0; window.__probes = 0; window.__frames = 0; window.__count = true; const tick = () => { if (!window.__count) return; window.__frames += 1; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.mouse.move(600, 300);
    for (const delta of deltas) { await page.mouse.wheel(0, delta); await page.waitForTimeout(16); }
    await page.waitForTimeout(400);
    return page.evaluate(() => { window.__count = false; return {runs: window.__runs, probes: window.__probes, frames: window.__frames}; });
  };
  const up = await scroll(Array(10).fill(-20));
  const afterUp = await place();
  await page.evaluate(() => window.__anchor.update());
  const fullUp = await place();
  check(up.probes === 0, 'no probe span while scrolling', up);
  check(up.runs > 0 && up.runs <= up.frames, 'placed at most once per frame', up);
  check(JSON.stringify(afterUp) === JSON.stringify(fullUp), 'a scroll leaves the panel where a full fit puts it (field low: flipped)', {afterUp, fullUp});
  check(afterUp.side === 'block-start', 'flips above near the bottom', afterUp);
  const down = await scroll(Array(10).fill(20));
  const afterDown = await place();
  await page.evaluate(() => window.__anchor.update());
  const fullDown = await place();
  check(down.probes === 0, 'no probe span scrolling back', down);
  check(JSON.stringify(afterDown) === JSON.stringify(fullDown), 'scrolling back: the same place as a full fit (below again)', {afterDown, fullDown});
  check(afterDown.side === 'block-end', 'back below', afterDown);

  // A resize resolves the lengths again: the probes come back once.
  await page.evaluate(() => { window.__probes = 0; });
  await page.setViewportSize({width: 700, height: 600});
  await page.waitForTimeout(300);
  const resized = await page.evaluate(() => window.__probes);
  check(resized > 0 && resized <= 4, 'a resize resolves the token lengths again', {probes: resized});
  check(!errors.length, 'no page errors', errors);
  await page.evaluate(() => window.__anchor.stop());
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 1));
  process.exit(1);
}
console.log('POSITION_COST ok');
