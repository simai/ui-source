#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--config=<file>] [folder ...]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Gate 24 of standard simai.smart-component 1.3.8 (§5.4, §7.3; gate 23 with
// it): the first paint holds still. Every committed snapshot of
// src/smart/<folder>/static/ (scripts/snapshot-first-paint.mjs) is printed on a
// page with the sheets its static/sheets.json lists, and the page is watched
// frame by frame through three phases:
//
//   1. the HTML and the sheets: the static markup or the skeleton is the
//      first frame (Core is in <head>; the components' scripts are held back
//      SCRIPT_DELAY ms);
//   2. the code: the element adopts its printed markup;
//   3. the data: a skeleton's late settings are set (presentation.skeleton.late)
//      and it turns into content; a component fed through a host port is
//      handed the fake port its example declares (example.port,
//      scripts/first-paint-lib.mjs portOf) and draws its answers.
//
// At the desktop and the phone width, the element's box is the same in the
// three phases (±0.5 px), the text below it never moves, no layout shift is
// recorded once the sheets are in (CLS 0), no static markup is left beside
// the element once it has drawn, and no frame shows it without a box when its
// settled box has one. Frames are measured once the first paint's sheets
// and fonts are in; phase 1 is the last frame before the code, and a shift
// before the code -- nothing but the page's fonts can move it then -- is
// reported as fontShift, not counted.
//
// The composed first paint of an assembly (§7.3; an assembly of
// src/smart, or a test assembly of Framework parts under
// tests/fixtures/first-paint/) is gated the same way, part by part: each
// part's box is the same in the three phases, a part printed as a skeleton
// turning into content when the example's late data is set on the assembly,
// and every printed part host is adopted: the live part is the element the
// page printed, never one drawn anew beside or instead of it (stand 24 F2: a
// printed sf-button whose role had moved to its <button> was drawn again).
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {components, assemblies, serveOutput, head, coreScript, staticDir, assemblyModule, givesLateData, portOf, FAKE_PORT} from '../../scripts/first-paint-lib.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const only = process.argv.slice(3).filter((one) => !one.startsWith('--'));
const SCRIPT_DELAY = Number(process.env.SCRIPT_DELAY || 400);
const WIDTHS = [1280, 390];
const TOLERANCE = 0.5;
const concurrency = Number(process.env.FIRST_PAINT_CONCURRENCY || 6);

// Installed before the document parses: a record per frame of the element's
// box and of the text below it, the layout shifts, the moment the sheets and
// the fonts were in, and when the element was defined and drew.
const WATCH = `(() => {
  const fp = window.__fp = {frames: [], shifts: [], sheetsAt: null, definedAt: null, drawnAt: null, dataAt: null};
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) fp.shifts.push({t: Math.round(entry.startTime), value: entry.value,
        sources: (entry.sources || []).map((one) => one.node ? (one.node.nodeName + '.' + String(one.node.className || '').split(' ')[0]) : '?')});
    }).observe({type: 'layout-shift', buffered: true});
  } catch {}
  const union = (a, b) => {
    const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
    return {left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top};
  };
  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).display !== 'contents') return {left: r.left, top: r.top, width: r.width, height: r.height};
    let all = null;
    for (const child of el.children) {
      if (child.localName === 'script' || getComputedStyle(child).position === 'fixed') continue;
      const one = boxOf(child);
      if (!one || (!one.width && !one.height)) continue;
      all = all ? union(all, one) : one;
    }
    return all || {left: r.left, top: r.top, width: 0, height: 0};
  };
  window.__fpBox = () => {
    const host = document.querySelector('#stage ' + window.__fpTag);
    return host ? boxOf(host) : null;
  };
  const sheetsIn = () => [...document.querySelectorAll('link[rel=stylesheet]')].every((link) => link.sheet);
  const round = (n) => Math.round(n * 10) / 10;
  const tick = () => {
    const host = document.querySelector('#stage ' + window.__fpTag);
    if (host && document.body) {
      // The sheets, then the fonts the page's text is set in -- every face its
      // characters need (a Cyrillic range of Inter is fetched only once text
      // asks for it), as a page preloads them -- then every font in use.
      if (fp.sheetsAt === null && !fp.waiting && sheetsIn()) {
        fp.waiting = true;
        const text = document.body.innerText;
        const fonts = new Set([...document.querySelectorAll('#stage *, #after')].map((el) => {
          const style = getComputedStyle(el);
          return style.fontStyle + ' ' + style.fontWeight + ' 16px ' + style.fontFamily;
        }));
        // Every face the sheets declare, too (but the icon font Core replaces
        // with its subset): a face that comes in later sets text again, and
        // the gate measures the element taking over, not the fonts arriving.
        const faces = [...document.fonts].filter((face) => !/Material Symbols/u.test(face.family)).map((face) => face.load());
        Promise.allSettled([...faces, ...[...fonts].map((font) => document.fonts.load(font, text))])
          .then(() => document.fonts.ready)
          .then(() => requestAnimationFrame(() => { fp.sheetsAt = performance.now(); }));
      }
      if (fp.definedAt === null && host.matches(':defined')) fp.definedAt = performance.now();
      // Drawn: defined and drawn, or keeping its printed skeleton for its data;
      // an assembly when every part is.
      // A closed overlay draws nothing until it opens: started is drawn.
      const drawn = (el) => el.matches(':defined') && ((window.__fpOverlay && el.hasAttribute('data-sf-started')) || !('isRendered' in el) || el.isRendered || el.sfAwaitingData?.() === true);
      const parts = window.__fpRoles ? [...host.querySelectorAll('[data-sf-role]')] : [];
      if (fp.drawnAt === null && drawn(host) && parts.every(drawn) && (!window.__fpRoles || parts.length)) fp.drawnAt = performance.now();
      if (fp.sheetsAt !== null) {
        const box = window.__fpBox();
        const after = document.getElementById('after');
        fp.frames.push({t: Math.round(performance.now()), defined: host.matches(':defined'),
          box: box && [box.left, box.top, box.width, box.height].map(round),
          after: after ? round(after.getBoundingClientRect().top) : null,
          statics: host.querySelectorAll(':scope > [data-sf-static]').length,
          parts: Object.fromEntries(parts.map((part) => { const one = boxOf(part); return [part.getAttribute('data-sf-role'), [one.left, one.top, one.width, one.height].map(round)]; })),
          drawn: fp.drawnAt !== null});
      }
    }
    if (performance.now() < 15000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const pages = new Map([['/first-paint-watch.js', WATCH]]);
// Core is in <head>, as a page prints it; the components' code is what comes
// late, so it is what is held back.
const site = await serveOutput(out, {pages, delay: (path) => (/\.m?js$/u.test(path) && path.startsWith('/distr/') && !path.startsWith('/distr/core/') ? SCRIPT_DELAY : 0)});
const browser = await chromium.launch();

const strip = (html) => html.replace(/<!--[\s\S]*?-->\n?/gu, '').trim();
// The example's own surroundings (markup around the element, a parent), with
// the printed host in the element's place.
function placed(example, tag, host) {
  if (example.markup && new RegExp(`<${tag}[\\s>]`, 'u').test(example.markup)) {
    // Each element of the markup in turn takes its printed host (the file
    // holds them in order, one per line).
    const printed = host.split(new RegExp(`\\n(?=<${tag}[\\s>])`, 'u'));
    let markup = example.markup;
    let from = 0;
    for (const one of printed) {
      const start = markup.indexOf(`<${tag}`, from);
      const end = markup.indexOf(`</${tag}>`, start);
      if (start < 0 || end < 0) break;
      markup = `${markup.slice(0, start)}${one}${markup.slice(end + tag.length + 3)}`;
      from = start + one.length;
    }
    return markup;
  }
  // The page around the element: the element comes after it, in its parent.
  const before = example.markup ?? '';
  if (example.parent) {
    const at = example.parent.lastIndexOf('</');
    return `${before}${example.parent.slice(0, at)}${host}${example.parent.slice(at)}`;
  }
  return `${before}${host}`;
}

const box4 = (box) => (box ? box.map((n) => n.toFixed(1)).join(' ') : 'none');
const same = (a, b) => Boolean(a && b) && a.every((n, i) => Math.abs(n - b[i]) <= TOLERANCE);

async function measure({component, example, file, kind, width, sheets, layout = null}) {
  const assembly = kind === 'assembly';
  const id = `${component.folder}/${layout ? `${layout}/` : ''}${example.name}${kind === 'skeleton' ? ' (skeleton)' : ''} @${width}`;
  const path = `/gate/${component.folder}/${layout ?? ''}/${example.name}/${kind}/${width}`;
  const html = strip(readFileSync(file, 'utf8'));
  pages.set(path, `${head({title: id, sheets: ['/distr/core/css/core.css', ...sheets.map((one) => `/distr/${one}`)], extra: `<script>window.__fpTag=${JSON.stringify(component.tag)};window.__fpRoles=${assembly};window.__fpOverlay=${Boolean(component.overlay)};</script><script src="/first-paint-watch.js"></script>${coreScript}`})}<body>
<main id="stage">${assembly ? html : placed(example, component.tag, html)}</main>
${assembly ? `<script>window.__fpPrinted = [...document.querySelectorAll('#stage [data-sf-role]')];</script>` : ''}
<p id="after">Текст под элементом</p>
${assembly ? assemblyModule(component) : ''}
</body></html>`);
  const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const problems = [];
  try {
    await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.__fp?.drawnAt !== null, null, {timeout: 20000}).catch(() => problems.push('the element never drew'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const port = assembly ? null : portOf(component, example);
    if (kind === 'skeleton' || (assembly && example.late) || port) {
      // Phase 3: the data arrives -- the late settings, as the host sets them,
      // or the example's port, as the host hands it over.
      const late = assembly ? example.late : kind === 'skeleton' && givesLateData(component, example)
        ? Object.fromEntries(component.late.filter((name) => name in (example.settings ?? {})).map((name) => [name, example.settings[name]])) : {};
      const outcome = await page.evaluate(({tag, late, port, fake}) => {
        const host = document.querySelector(`#stage ${tag}`);
        window.__fp.dataAt = performance.now();
        const camel = (name) => name.replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());
        for (const [name, value] of Object.entries(late)) host[camel(name)] = value;
        if (!port) return null;
        // eslint-disable-next-line no-eval
        window.__fpPort = (0, eval)(fake)(port);
        return host.connectPort(window.__fpPort);
      }, {tag: component.tag, late, port, fake: FAKE_PORT});
      if (port && outcome?.outcome !== 'applied') problems.push(`the example's port was not taken: ${JSON.stringify(outcome)}`);
      await page.waitForTimeout(500 + (port?.delay ?? 0));
      if (port && !(await page.evaluate(() => window.__fpPort.calls.length))) problems.push('the element never asked the example\'s port');
    }
    await page.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle))));
    const fp = await page.evaluate(() => window.__fp);
    if (assembly) {
      // Every printed part is adopted: the live part host is the printed one.
      const anew = await page.evaluate((tag) => {
        const printed = window.__fpPrinted ?? [];
        const roles = new Set(printed.map((one) => one.getAttribute('data-sf-role')));
        const live = [...document.querySelectorAll(`#stage ${tag} [data-sf-role]`)];
        return live.filter((one) => roles.has(one.getAttribute('data-sf-role')) && !printed.includes(one))
          .map((one) => `${one.getAttribute('data-sf-role')} (${one.localName})`);
      }, component.tag);
      if (anew.length) problems.push(`printed part(s) drawn anew, not adopted: ${anew.join(', ')}`);
    }
    const frames = fp.frames;
    // Phase 1 is the first paint as it stands when the code arrives: the last
    // frame before it. What moved before that, with no code on the page, was
    // the page's fonts coming in (reported as fontShift).
    const before = frames.filter((frame) => !frame.defined);
    const first = before.at(-1) ?? null;
    const settled = frames.at(-1) ?? null;
    const drawn = [...frames].reverse().find((frame) => frame.drawn && (fp.dataAt === null || frame.t < fp.dataAt)) ?? null;
    const phases = {p1: first?.box ?? null, p2: drawn?.box ?? null, p3: settled?.box ?? null};
    if (!first) problems.push('no frame before the code: the first paint was not seen (scripts arrived before the sheets?)');
    if (!drawn) problems.push('no frame with the element drawn before the data');
    if (first && drawn && !same(first.box, drawn.box)) problems.push(`box moved when the code adopted: ${box4(first.box)} -> ${box4(drawn.box)}`);
    if (drawn && settled && !same(drawn.box, settled.box)) problems.push(`box moved when the data arrived: ${box4(drawn.box)} -> ${box4(settled.box)}`);
    const parts = {};
    if (assembly && first && drawn && settled) {
      // Every part placed: its box in the printed layout, once adopted, once its data came.
      for (const role of Object.keys(settled.parts)) {
        const seen = [first.parts[role], drawn.parts[role], settled.parts[role]];
        parts[role] = seen.map(box4);
        if (!same(seen[0], seen[1])) problems.push(`part ${role} moved when the code adopted: ${box4(seen[0])} -> ${box4(seen[1])}`);
        if (!same(seen[1], seen[2])) problems.push(`part ${role} moved when the data arrived: ${box4(seen[1])} -> ${box4(seen[2])}`);
      }
    }
    const afters = [...new Set(frames.slice(Math.max(0, frames.indexOf(first))).map((frame) => frame.after))];
    if (afters.length > 1) problems.push(`the text below moved: ${afters.join(' -> ')}`);
    // A shift before any code arrived is the page's fonts arriving (a text
    // set again in its web font or the icon subset): reported, not counted
    // against the first paint. Every shift from the code's arrival on counts.
    const after = (shift) => fp.sheetsAt !== null && shift.t >= fp.sheetsAt;
    const beforeCode = (shift) => fp.definedAt === null || shift.t < fp.definedAt - 20;
    // Before the code nothing of the page's scripts touched the element: any
    // shift then is the fonts'.
    const still = Boolean(first);
    // So is a shift of text alone (glyphs set again when a font or the icon
    // subset arrives) while no box moved in any frame.
    const steady = still && frames.slice(frames.indexOf(first)).every((frame) => same(frame.box, first.box) && frame.after === first.after);
    const textOnly = (shift) => shift.sources.every((one) => one === '#text.' || one.startsWith('I.sf-icon'));
    const fonts = fp.shifts.filter((shift) => after(shift) && still && (beforeCode(shift) || (steady && textOnly(shift))));
    const shifts = fp.shifts.filter((shift) => after(shift) && !fonts.includes(shift));
    const fontShift = Math.round(fonts.reduce((sum, shift) => sum + shift.value, 0) * 10000) / 10000;
    const cls = Math.round(shifts.reduce((sum, shift) => sum + shift.value, 0) * 10000) / 10000;
    if (cls > 0) problems.push(`layout shift ${cls} (${[...new Set(shifts.flatMap((shift) => shift.sources))].slice(0, 4).join(', ')})`);
    if (settled && settled.statics) problems.push(`${settled.statics} static node(s) left beside the drawn element`);
    if (settled?.box && (settled.box[2] || settled.box[3])) {
      const empty = frames.filter((frame) => !frame.box || (!frame.box[2] && !frame.box[3]));
      if (empty.length) problems.push(`${empty.length} frame(s) without the element's box`);
    }
    if (errors.length) problems.push(`page errors: ${errors.slice(0, 2).join('; ')}`);
    return {id, folder: component.folder, example: example.name, kind, width, phases: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, box4(v)])), ...(assembly ? {parts} : {}), cls, ...(fontShift ? {fontShift} : {}), frames: frames.length, problems,
      ...(process.env.FIRST_PAINT_FRAMES ? {trace: {sheetsAt: fp.sheetsAt, definedAt: fp.definedAt, drawnAt: fp.drawnAt, dataAt: fp.dataAt, shifts: fp.shifts, frames}} : {})};
  } finally {
    await context.close();
    pages.delete(path);
  }
}

const jobs = [];
for (const component of components(undefined, only)) {
  const dir = staticDir(component);
  const sheetsFile = join(component.dir, 'static', 'sheets.json');
  if (!existsSync(dir) || !existsSync(sheetsFile)) {
    jobs.push({missing: component.folder});
    continue;
  }
  const sheets = JSON.parse(readFileSync(sheetsFile, 'utf8'));
  for (const example of component.examples) {
    const html = join(dir, `${example.name}.html`);
    const skeleton = join(dir, `${example.name}.skeleton.html`);
    const exampleSheets = sheets.examples?.[example.name] ?? sheets.sheets;
    if (existsSync(html)) for (const width of WIDTHS) jobs.push({component, example, file: html, kind: 'static', width, sheets: exampleSheets});
    if (existsSync(skeleton)) for (const width of WIDTHS) jobs.push({component, example, file: skeleton, kind: 'skeleton', width, sheets: exampleSheets});
  }
}

for (const assembly of assemblies(only)) {
  const sheetsFile = join(assembly.dir, 'static', 'sheets.json');
  const sheets = existsSync(sheetsFile) ? JSON.parse(readFileSync(sheetsFile, 'utf8')) : null;
  for (const layout of Object.keys(assembly.layouts)) {
    for (const example of assembly.examples) {
      const file = join(assembly.dir, 'static', layout, `${example.name}.html`);
      if (!existsSync(file) || !sheets) { jobs.push({missing: `${assembly.folder}/${layout}/${example.name}`}); continue; }
      const exampleSheets = sheets.examples?.[layout === 'default' ? example.name : `${layout}/${example.name}`] ?? sheets.sheets;
      for (const width of WIDTHS) jobs.push({component: assembly, example, file, kind: 'assembly', layout, width, sheets: exampleSheets});
    }
  }
}

const results = [];
const missing = jobs.filter((job) => job.missing).map((job) => job.missing);
const queue = jobs.filter((job) => !job.missing);
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    try {
      results.push(await measure(job));
    } catch (error) {
      results.push({id: `${job.component.folder}/${job.example.name} ${job.kind} @${job.width}`, folder: job.component.folder, problems: [String(error.message ?? error).slice(0, 300)]});
    }
  }
}
try {
  await Promise.all(Array.from({length: concurrency}, worker));
} finally {
  await browser.close();
  await site.close();
}

results.sort((a, b) => a.id.localeCompare(b.id));
// Measurements that fail for a reason outside the first paint, each with
// that reason (tests/fixtures/first-paint/gate-known.json): reported, not counted. An entry
// that no longer fails is reported too, to be taken out.
const knownFile = new URL('../fixtures/first-paint/gate-known.json', import.meta.url);
const known = existsSync(knownFile) ? JSON.parse(readFileSync(knownFile, 'utf8')).known ?? {} : {};
const keyOf = (one) => one.id.replace(/ @\d+$/u, '');
const failing = results.filter((one) => one.problems.length);
const failed = failing.filter((one) => !known[keyOf(one)]);
const excused = failing.filter((one) => known[keyOf(one)]);
const cleared = Object.keys(known).filter((key) => !failing.some((one) => keyOf(one) === key) && results.some((one) => keyOf(one) === key));
const report = {
  gate: 'first paint (standard simai.smart-component 1.3.8 gate 24)',
  widths: WIDTHS,
  scriptDelayMs: SCRIPT_DELAY,
  measured: results.length,
  components: new Set(results.map((one) => one.folder)).size,
  passed: results.length - failing.length,
  cls: Math.max(0, ...results.map((one) => one.cls ?? 0)),
  missingSnapshots: missing,
  known: excused.map(({id, problems}) => ({id, problems, reason: known[keyOf({id})]})),
  knownNowPassing: cleared,
  failed: failed.map(({id, phases, problems}) => ({id, phases, problems})),
};
if (process.env.FIRST_PAINT_REPORT) writeFileSync(process.env.FIRST_PAINT_REPORT, `${JSON.stringify({...report, results}, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed.length || missing.length) {
  console.error(`first paint: ${failed.length} of ${results.length} measurement(s) failed, ${missing.length} component(s) without snapshots`);
  process.exit(1);
}
