#!/usr/bin/env node
// Usage: node tests/browser/first-paint-render.browser.mjs <build output root or a pair's distr/> [--report=<file>] [folder ...]
//
// The contract of the first-paint render tool the build ships
// (docs/developer/first-paint-render.md), run from the build's own copy
// (core/js/composition/first-paint-render.mjs), over the components Docara
// prints from settings (sf-badge, sf-tag, sf-tooltip, sf-avatar,
// sf-progress-bar, sf-reference-link, sf-button-copy, and sf-tabs with its
// panels since group build 20; or the folders named):
//
//   1. server == runtime: every example of examples.json, sent as a request
//      with its settings, answers its committed snapshot byte for byte, names
//      it, and lists its sheets;
//   2. the same bytes on every run: a second renderer answers every request
//      the same;
//   3. the cache: a renderer over a filled cache answers the same, from it,
//      and starts no browser;
//   4. settings outside the examples: each enum setting of each component set
//      in turn to each of its values, each boolean on and off (over the first
//      example), all printed or refused with a reason, never failed;
//   5. no first-paint shift: a Docara-shaped page of everything 1 and 4
//      printed, with the printed sheets in <head> and core.js loaded after
//      the page has painted, at 1440 and 390, light and dark, three cold loads
//      each: every element's box is where the printed markup put it, CLS 0,
//      nothing printed is left beside the drawn element, the console clean.
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {loadavg, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {ensureLocalPlaywright} from '../../scripts/playwright-local.mjs';
import {BOOT_CONFIG, describe, isDistribution, sameSnapshot, serveOutput} from '../../scripts/first-paint-lib.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const out = args.find((one) => !one.startsWith('--')) ? resolve(args.find((one) => !one.startsWith('--'))) : null;
if (!out) throw new Error('Build output root is required');
const reportFile = args.find((one) => one.startsWith('--report='))?.slice('--report='.length) ?? null;
const DOCARA = ['badge', 'tag', 'tooltip', 'avatar', 'progress-bar', 'reference-link', 'button-copy', 'tabs'];
const folders = args.filter((one) => !one.startsWith('--') && resolve(one) !== out);
const only = folders.length ? folders : DOCARA;
const concurrency = Number(process.env.FIRST_PAINT_CONCURRENCY || 2);
const smartSource = join(repo, 'src', 'smart');
const kitEntry = isDistribution(out) ? join(out, 'core', 'js', 'composition', 'first-paint-render.mjs') : join(out, 'core', 'core', 'js', 'composition', 'first-paint-render.mjs');
const playwright = join(repo, 'node_modules', 'playwright');
ensureLocalPlaywright(repo);

const report = {build: out, kit: kitEntry, load: [], examples: {}, matrix: {}, determinism: null, cache: null, shift: []};
const failures = [];
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').slice(0, 12).join('\n     ')}`);
  }
};
report.load.push(loadavg()[0]);

const committed = (folder, name) => readFileSync(join(smartSource, folder, 'static', 'default', `${name}.html`), 'utf8').replace(/^<!--[^\n]*-->\n/u, '').replace(/\n$/u, '');
const prefixOf = (folder, name) => `sf-${folder}-${name}`.replace(/[^a-z0-9-]/giu, '-');
const requestOf = (component, example) => ({
  id: `${component.folder}/${example.name}`,
  tag: component.tag,
  settings: example.settings ?? {},
  ...(example.attributes ? {attributes: example.attributes} : {}),
  ...(example.children !== undefined ? {children: example.children} : {}),
  ...(example.slots !== undefined ? {slots: example.slots} : {}),
  ...(example.markup !== undefined ? {markup: example.markup} : {}),
  ...(example['first-paint']?.now ? {now: example['first-paint'].now} : {}),
  prefix: prefixOf(component.folder, example.name),
});

const components = only.map((folder) => describe(smartSource, folder));
const exampleRequests = components.flatMap((component) => component.examples.filter((example) => !example.template || example.template === 'default').map((example) => ({component, example, request: requestOf(component, example)})));

// Each enum setting in turn to each value, each boolean on and off, over the first example.
const matrixRequests = components.flatMap((component) => {
  const base = component.examples[0];
  const list = [];
  for (const [name, member] of Object.entries(component.manifest.settings ?? {})) {
    const values = member.type === 'enum' && Array.isArray(member.values) ? member.values : member.type === 'boolean' ? [true, false] : [];
    for (const value of values) {
      const id = `${component.folder}/matrix-${name}-${String(value) || 'empty'}`.replace(/[^a-z0-9/-]/giu, '-');
      list.push({component, request: {id, tag: component.tag, settings: {...(base.settings ?? {}), [name]: value}, ...(base.attributes ? {attributes: base.attributes} : {}), prefix: id.replace(/\//gu, '-')}});
    }
  }
  return list;
});

const kit = await import(pathToFileURL(kitEntry).href).catch((error) => {
  console.log(`FAIL 0. the build ships the render tool at ${kitEntry}\n     ${error.message}`);
  process.exit(1);
});
console.log(`ok   0. the build ships the render tool (${kit.SCHEMA})`);

const cache = mkdtempSync(join(tmpdir(), 'sf-render-cache-'));
const first = await kit.createRenderer({distr: out, playwright, concurrency});
let firstAnswers = [];
let matrixAnswers = [];
try {
  const started = Date.now();
  firstAnswers = await first.renderMany(exampleRequests.map((one) => one.request));
  report.examplesMs = Date.now() - started;
  const startedMatrix = Date.now();
  matrixAnswers = await first.renderMany(matrixRequests.map((one) => one.request));
  report.matrixMs = Date.now() - startedMatrix;
} finally {
  await first.close();
}

await check(`1. server == runtime: ${exampleRequests.length} examples of ${components.length} components answer their committed snapshot byte for byte`, async () => {
  const bad = [];
  exampleRequests.forEach(({component, example}, at) => {
    const answer = firstAnswers[at];
    const id = `${component.folder}/${example.name}`;
    const row = {status: answer.status};
    if (answer.status !== 'printed') {
      bad.push(`${id}: ${answer.status} ${answer.reason}: ${answer.detail}`);
      report.examples[id] = row;
      return;
    }
    const body = committed(component.folder, example.name);
    row.exact = answer.html === body;
    row.same = sameSnapshot(answer.html, body);
    row.snapshot = answer.snapshot;
    // The answer names every sheet the committed snapshot of this example
    // needs, and none the component's committed first paint does not name
    // (the answer adds the component-wide list: never too few).
    const kept = JSON.parse(readFileSync(join(smartSource, component.folder, 'static', 'sheets.json'), 'utf8'));
    const listed = kept.examples[example.name] ?? [];
    const allowed = new Set([...(kept.sheets ?? []), ...listed]);
    const missing = listed.filter((sheet) => !answer.sheets.includes(sheet));
    const extra = answer.sheets.filter((sheet) => !allowed.has(sheet));
    row.sheets = !missing.length && !extra.length;
    if (!row.exact) bad.push(`${id}: not byte for byte the snapshot${row.same ? ' (the same with attributes in name order)' : ''}`);
    if (row.snapshot !== `smart/${component.folder}/static/default/${example.name}.html`) bad.push(`${id}: names ${row.snapshot}`);
    if (!row.sheets) bad.push(`${id}: sheets missing ${missing.join(', ') || 'none'}, not in the committed list ${extra.join(', ') || 'none'}`);
    report.examples[id] = row;
  });
  assert.deepEqual(bad, []);
});

await check('2. the same bytes on every run (a second renderer, every example and every matrix request)', async () => {
  const second = await kit.createRenderer({distr: out, playwright, concurrency, cache});
  try {
    const again = await second.renderMany([...exampleRequests, ...matrixRequests].map((one) => one.request));
    const before = [...firstAnswers, ...matrixAnswers];
    const differ = again.map((one, at) => (JSON.stringify(one) === JSON.stringify(before[at]) ? null : one.id)).filter(Boolean);
    report.determinism = {requests: again.length, differ};
    assert.deepEqual(differ, []);
  } finally {
    await second.close();
  }
});

await check('3. a filled cache answers the same and starts no browser', async () => {
  const third = await kit.createRenderer({distr: out, playwright, concurrency, cache});
  try {
    const started = Date.now();
    const answers = await third.renderMany([...exampleRequests, ...matrixRequests].map((one) => one.request));
    const before = [...firstAnswers, ...matrixAnswers];
    const printed = before.filter((one) => one.status === 'printed').length;
    report.cache = {ms: Date.now() - started, cached: third.stats.cached, printed, origin: third.origin};
    assert.equal(third.stats.cached, printed);
    assert.equal(third.origin, null, 'no server, no browser');
    assert.equal(JSON.stringify(answers), JSON.stringify(before));
  } finally {
    await third.close();
    rmSync(cache, {recursive: true, force: true});
  }
});

await check(`4. settings outside the examples: ${matrixRequests.length} requests printed or refused with a reason, none failed`, async () => {
  const counts = {};
  const bad = [];
  matrixRequests.forEach(({component, request}, at) => {
    const answer = matrixAnswers[at];
    const one = counts[component.folder] ??= {printed: 0, refused: 0, failed: 0, unknown: 0, reasons: {}};
    one[answer.status] += 1;
    if (answer.status !== 'printed') one.reasons[`${answer.reason}: ${request.id}`] = answer.detail;
    if (answer.status === 'failed' || answer.status === 'unknown') bad.push(`${request.id}: ${answer.status} ${answer.detail}`);
  });
  report.matrix = counts;
  assert.deepEqual(bad, []);
});

// ---------- 5. no first-paint shift over printed markup ----------
const {chromium} = await import('playwright');
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
const printedPage = (answers, theme) => {
  const sheets = [...new Set(answers.flatMap((one) => one.sheets))].sort();
  const boot = {...BOOT_CONFIG};
  return `<!doctype html>
<html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>printed</title><link rel="icon" href="data:,">
${sheets.map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('\n')}
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG=${JSON.stringify(boot)};</script>
<script src="/distr/core/lang/ru.js"></script>
</head><body style="margin:0"><main id="stage" style="display:flex;flex-direction:column;gap:12px;padding:16px">
${answers.map((one) => `<div class="row" data-id="${one.id}">${one.html}</div>`).join('\n')}
</main></body></html>`;
};

// In the page: each printed host's own box (its first drawn child: the host is display: contents).
const BOXES = () => [...document.querySelectorAll('#stage > .row')].map((row) => {
  const host = row.firstElementChild;
  const child = [...(host?.children ?? [])].find((el) => el.localName !== 'script' && getComputedStyle(el).display !== 'none');
  const box = (child ?? host)?.getBoundingClientRect();
  return {id: row.dataset.id, box: box ? [box.x, box.y, box.width, box.height].map((n) => Math.round(n * 10) / 10) : null};
});

await check('5. no first-paint shift: the drawn element stays where its printed markup was (1440, 390; light, dark; 3 cold loads)', async () => {
  const answers = [...firstAnswers, ...matrixAnswers].filter((one) => one.status === 'printed');
  const pages = new Map();
  for (const theme of ['theme-light', 'theme-dark']) pages.set(`/printed-${theme}`, printedPage(answers, theme));
  const site = await serveOutput(out, {pages});
  const bad = [];
  try {
    for (const width of [1440, 390]) {
      for (const theme of ['theme-light', 'theme-dark']) {
        for (let round = 1; round <= 3; round += 1) {
          const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
          const page = await context.newPage();
          const consoleLines = [];
          page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) consoleLines.push(message.text()); });
          page.on('pageerror', (error) => consoleLines.push(error.message));
          try {
            await page.goto(`${site.origin}/printed-${theme}`, {waitUntil: 'load'});
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(() => {
              window.__shift = 0;
              new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value; }).observe({type: 'layout-shift', buffered: false});
            });
            const before = await page.evaluate(BOXES);
            await page.evaluate(() => new Promise((settle) => {
              const script = document.createElement('script');
              script.src = '/distr/core/js/core.js';
              script.onload = settle;
              document.body.append(script);
            }));
            await page.waitForFunction(() => [...document.querySelectorAll('#stage > .row')].every((row) => {
              const host = row.firstElementChild;
              return host && customElements.get(host.localName) && (!('isRendered' in host) || host.isRendered === true);
            }), null, {timeout: 30000});
            await page.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(settle, 500)))));
            const after = await page.evaluate(BOXES);
            const state = await page.evaluate(() => ({
              shift: window.__shift,
              left: [...document.querySelectorAll('#stage > .row')].filter((row) => row.firstElementChild?.querySelector('[data-sf-static]')).map((row) => row.dataset.id),
            }));
            const moved = before.map((one, at) => {
              const two = after[at];
              if (!one.box || !two.box) return `${one.id}: no box`;
              return one.box.some((value, k) => Math.abs(value - two.box[k]) > 0.5) ? `${one.id}: ${one.box.join(',')} -> ${two.box.join(',')}` : null;
            }).filter(Boolean);
            const row = {width, theme, round, elements: before.length, moved: moved.length, shift: Math.round(state.shift * 10000) / 10000, left: state.left.length, console: consoleLines.length};
            report.shift.push(row);
            if (moved.length) bad.push(`${width} ${theme} #${round}: moved ${moved.slice(0, 6).join('; ')}${moved.length > 6 ? ` (+${moved.length - 6})` : ''}`);
            if (state.shift > 0) bad.push(`${width} ${theme} #${round}: CLS ${state.shift}`);
            if (state.left.length) bad.push(`${width} ${theme} #${round}: printed markup left in ${state.left.slice(0, 6).join(', ')}`);
            if (consoleLines.length) bad.push(`${width} ${theme} #${round}: console ${consoleLines.slice(0, 3).join(' | ')}`);
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await site.close();
  }
  assert.deepEqual(bad, []);
});

await browser.close();
report.load.push(loadavg()[0]);
if (reportFile) writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({examples: exampleRequests.length, exact: Object.values(report.examples).filter((one) => one.exact).length, matrix: matrixRequests.length, examplesMs: report.examplesMs, matrixMs: report.matrixMs, cache: report.cache, determinism: report.determinism && {requests: report.determinism.requests, differ: report.determinism.differ.length}, shiftLoads: report.shift.length, load: report.load, failures}));
process.exit(failures.length ? 1 : 0);
