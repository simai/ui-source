#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [folder ...] [--json file]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// One row, one rung (owner decision C103, docs/foundation-composition-geometry.md
// §6; C178: every general rule has an automatic check in the pair build).
// Controls that stand in one row of a component stand on one rung of the
// ladder: a button beside a field, buttons in a row of buttons, a field and
// its action take one height.
//
// Every example of every Smart component (src/smart/<folder>/examples.json; a
// component without one: its defaults) is drawn from the candidate at a
// desktop width. The controls on the page -- buttons (an sf-button's own
// <button>), text fields and selects (their drawn box) -- are read through
// open shadow roots. Two controls stand in one row when they overlap
// vertically by more than half of the smaller and their nearest common
// ancestor lays them out side by side (a flex row or a grid). Such two must
// have one height (to the pixel).
//
// Not controls of the ladder: a help mark, tags, badges, chips, a choice
// (checkbox, radio, switch), menu items, options, tabs and a control drawn
// inside another (a field's own clear or step button).
//
// Every pair found today is listed in KNOWN with its owner component; a new
// pair fails, and a fixed one must leave the list. Exits 1 on failure.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {components, hostSpec, serveOutput, head, coreScript, repo} from '../../scripts/first-paint-lib.mjs';

const args = process.argv.slice(2);
const out = args[0] ? resolve(args[0]) : null;
if (!out || !existsSync(join(out, 'core'))) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt > 0 ? args[jsonAt + 1] : null;
const only = args.slice(1).filter((one, i, list) => !one.startsWith('--') && list[i - 1] !== '--json');
const CONCURRENCY = Number(process.env.RUNG_CONCURRENCY || 6);

// The pairs found on group build 4 (2026-11-14), each a defect of its owner
// component: «component: count». A count that changes fails.
const KNOWN = {
  // progress: the cancel link button is height-low (32) beside the size 1
  // download button (40).
  'file-download': 1,
  // file-preview/error and file-upload/error (the retry button 32 beside the
  // icon actions 40) left the list with owner decision C260 (sf-file-preview
  // 1.5.0): «Повторить» stands on the rung of its neighbours.
};

const pageScript = readFileSync(join(repo, 'scripts', 'instance-scope-page.js'), 'utf8');
const pages = new Map([['/instance-scope-page.js', pageScript]]);
const site = await serveOutput(out, {pages, fonts: 'as-shipped'});
const browser = await chromium.launch();

const examplesOf = (component) => {
  const file = join(component.dir, typeof component.manifest.examples === 'string' ? component.manifest.examples : 'examples.json');
  if (!existsSync(file)) return component.examples;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : data.examples;
  return Array.isArray(list) && list.length ? list : component.examples;
};

// Runs in the page: the pairs of one row with two heights.
function measure() {
  const parentOf = (node) => node.assignedSlot ?? node.parentElement ?? (node.parentNode instanceof ShadowRoot ? node.parentNode.host : null);
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document.getElementById('stage'));
  const visible = (el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 12) return false;
    for (let node = el; node; node = parentOf(node)) {
      const style = getComputedStyle(node);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  // A picture tile (sf-figure-media in a gallery grid or masonry) is content
  // drawn at its picture's height, not a control on the ladder.
  const NOT_LADDER = /(^|[-_\s])(help-mark|tag|tags|badge|badges|chip|chips|checkbox|radio|switch|toggle|menu-item|option|tab|tabs|kbd|figure)([-_\s]|$)/u;
  const outOfLadder = (el) => {
    for (let node = el; node && node.id !== 'stage'; node = parentOf(node)) {
      const name = `${node.localName} ${typeof node.className === 'string' ? node.className : ''}`;
      if (NOT_LADDER.test(name)) return true;
      const role = node.getAttribute?.('role');
      if (role && /^(menuitem|menuitemcheckbox|menuitemradio|option|tab|treeitem|row|gridcell|switch|checkbox|radio|slider)$/u.test(role)) return true;
    }
    return false;
  };
  const describe = (el) => {
    const own = typeof el.className === 'string' ? el.className.trim().split(/\s+/u).filter((one) => /^sf-/u.test(one)).slice(0, 2).join('.') : '';
    let host = el;
    while (host && !host.localName.includes('-')) host = parentOf(host);
    return `${host ? `${host.localName} ` : ''}${el.localName}${own ? `.${own}` : ''}`;
  };
  // A control's drawn box: the control itself, or for a field's <input> and
  // a bare button inside a field (a colour swatch, a clear action) the
  // nearest ancestor with a border, an outline ring or a fill, no taller than
  // a control: the field.
  const isDrawn = (node) => {
    const style = getComputedStyle(node);
    return parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0 || !/^(none|rgba\(\d+, \d+, \d+, 0\) 0px 0px( 0px)*)$/u.test(style.boxShadow)
      || !/^(rgba\(\d+, \d+, \d+, 0\)|transparent)$/u.test(style.backgroundColor);
  };
  const drawnBox = (el, levels, room) => {
    const own = el.getBoundingClientRect();
    for (let node = el, i = 0; node && i < levels; node = parentOf(node), i += 1) {
      if (getComputedStyle(node).display === 'contents') { i -= 1; continue; }
      if (node.getBoundingClientRect().height > own.height + room) break;
      if (isDrawn(node)) return node;
    }
    return el;
  };
  const controls = new Set();
  for (const el of all) {
    if (!visible(el) || outOfLadder(el)) continue;
    if (el.localName === 'input') {
      if (!/^(checkbox|radio|range|hidden|file|color)$/u.test(el.type)) controls.add(drawnBox(el, 5, 40));
    } else if (el.localName === 'select') controls.add(drawnBox(el, 3, 16));
    else if (el.localName === 'button' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'combobox') controls.add(drawnBox(el, 3, 16));
  }
  const list = [...controls].filter((el) => visible(el));
  const rect = new Map(list.map((el) => [el, el.getBoundingClientRect()]));
  const inside = (a, b) => {
    const ra = rect.get(a);
    const rb = rect.get(b);
    return ra.left >= rb.left - 0.5 && ra.right <= rb.right + 0.5 && ra.top >= rb.top - 0.5 && ra.bottom <= rb.bottom + 0.5;
  };
  // A control drawn inside another is part of it.
  const ladder = list.filter((a) => !list.some((b) => b !== a && inside(a, b) && !inside(b, a)));
  const chain = (el) => {
    const nodes = [];
    for (let node = el; node; node = parentOf(node)) nodes.push(node);
    return nodes;
  };
  const sideBySide = (node) => {
    const style = getComputedStyle(node);
    if (/flex/u.test(style.display)) return !/column/u.test(style.flexDirection);
    return /grid/u.test(style.display);
  };
  const pairs = [];
  for (let i = 0; i < ladder.length; i += 1) {
    for (let j = i + 1; j < ladder.length; j += 1) {
      const a = ladder[i];
      const b = ladder[j];
      const ra = rect.get(a);
      const rb = rect.get(b);
      const overlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (overlap <= Math.min(ra.height, rb.height) / 2) continue;
      if (Math.abs(ra.height - rb.height) < 1) continue;
      const up = new Set(chain(a));
      const common = chain(b).find((node) => up.has(node));
      if (!common || !sideBySide(common)) continue;
      pairs.push({a: describe(a), b: describe(b), heights: [Math.round(ra.height * 10) / 10, Math.round(rb.height * 10) / 10].sort((x, y) => x - y)});
    }
  }
  return {controls: ladder.length, pairs};
}

async function probe(component, example) {
  const id = `${component.folder}/${example.name}`;
  const path = `/rung/${id}`;
  const spec = {...hostSpec(component, {...example, settings: example.settings ?? {}}), script: example.script ?? []};
  pages.set(path, `${head({title: id, extra: '<script src="/instance-scope-page.js"></script>'})}<body>
<main id="stage"></main>
<script>window.__sfScopeProbe.build(${JSON.stringify(spec).replace(/</g, '\\u003c')});</script>
${coreScript}
</body></html>`);
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  await context.route((url) => !url.href.startsWith(site.origin), (route) => route.abort());
  const page = await context.newPage();
  try {
    await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
    const drawn = await page.waitForFunction(() => window.__sfScopeProbe.drawn(), null, {timeout: 20000}).then(() => true, () => false);
    if (!drawn) return {id, folder: component.folder, problem: 'it never drew', controls: 0, pairs: []};
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.waitForTimeout(150);
    return {id, folder: component.folder, ...(await page.evaluate(measure))};
  } catch (error) {
    return {id, folder: component.folder, problem: String(error?.message ?? error).split('\n')[0].slice(0, 200), controls: 0, pairs: []};
  } finally {
    await context.close();
    pages.delete(path);
  }
}

const jobs = [];
for (const component of components(undefined, only)) for (const example of examplesOf(component)) jobs.push([component, example]);
const results = [];
let next = 0;
await Promise.all(Array.from({length: Math.min(CONCURRENCY, jobs.length)}, async () => {
  while (next < jobs.length) {
    const [component, example] = jobs[next++];
    results.push(await probe(component, example));
  }
}));
await browser.close();
await site.close();
results.sort((a, b) => a.id.localeCompare(b.id));

const byFolder = {};
for (const one of results) if (one.pairs.length) byFolder[one.folder] = (byFolder[one.folder] ?? 0) + one.pairs.length;
const checked = only.length ? new Set(results.map((one) => one.folder)) : null;
const failures = [];
for (const [folder, count] of Object.entries(byFolder)) {
  if (KNOWN[folder] !== count) failures.push(`${folder}: ${count} pairs of two heights in one row (listed ${KNOWN[folder] ?? 0})`);
}
for (const [folder, count] of Object.entries(KNOWN)) {
  if (checked && !checked.has(folder)) continue;
  if (!byFolder[folder]) failures.push(`${folder}: listed ${count}, found none -- it left the list`);
}
const report = {
  gate: 'C103 one row, one rung (C178)',
  examples: results.length,
  controls: results.reduce((sum, one) => sum + one.controls, 0),
  pairs: results.reduce((sum, one) => sum + one.pairs.length, 0),
  byFolder,
  failures,
  problems: results.filter((one) => one.problem).map(({id, problem}) => `${id}: ${problem}`),
  found: results.filter((one) => one.pairs.length).map(({id, pairs}) => ({id, pairs})),
};
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({...report, found: report.found.slice(0, 40)}, null, 2));
process.exit(failures.length ? 1 : 0);
