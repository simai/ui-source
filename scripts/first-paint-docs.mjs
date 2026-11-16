#!/usr/bin/env node
// The data of a Smart component page's «Первая отрисовка» section (owner
// decision C252, 2026-11-16): one file for every Smart component,
// src/core/contracts/first-paint-docs.v1.json, that ships in the pair
// (distr/core/contracts/first-paint-docs.v1.json) beside the snapshots it
// names (distr/smart/<folder>/static/), so a documentation site renders the
// section from the pair it pins and never from data of its own. One file, not
// one per component: a measurement taken again moves no component's version.
// Per component:
//
//   - the snapshot of each example (static/<template>/<example>.html; the
//     sheets it is printed with are static/sheets.json's, beside it): the
//     first paint a page prints, shown beside the drawn component;
//   - whether the component needs a skeleton for late data (its late settings,
//     component.json presentation.skeleton.late) and, per example, the
//     skeleton snapshot (<example>.skeleton.html) or null;
//   - the box at 1440 and at 390 (width x height, px), printed and drawn, and
//     the bare tag's box before its code against the drawn one (gate 24b), read
//     from a gate 24 report (tests/browser/first-paint-gate.browser.mjs with
//     FIRST_PAINT_REPORT=<file>);
//   - before the code: what core holds for the bare tag (a component in
//     tests/fixtures/first-paint/box-from-attributes.json holds its box from
//     its attributes; the others are held by the host -- printing the snapshot
//     or sizing the element, C253).
//
// It replaces the «До прихода кода» row the docs generated from the manifest's
// presentation.skeleton (shape, while_loading), which said «no skeleton» for
// components that print five or eleven (first-paint status R222).
//
// Usage:
//   node scripts/first-paint-docs.mjs [--report=<gate report.json>]
//       writes the file; boxes from the report, else the boxes the file has
//   node scripts/first-paint-docs.mjs --check
//       fails when the file is missing or a component's snapshots, skeletons,
//       sheets or late settings differ from the repository (boxes and
//       versions are measurements of a build and are not compared)
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {components, repo} from './first-paint-lib.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const reportFile = args.find((one) => one.startsWith('--report='))?.slice('--report='.length);
const OUT = join(repo, 'src/core/contracts/first-paint-docs.v1.json');
const WIDTHS = [1440, 390];
const SCHEMA = 'simai.first-paint-docs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const covered = readJson(join(repo, 'tests/fixtures/first-paint/box-from-attributes.json')).components ?? {};
const report = reportFile ? readJson(reportFile) : null;
const size = (box) => {
  const numbers = typeof box === 'string' ? box.split(' ').map(Number) : box;
  return Array.isArray(numbers) && numbers.length === 4 && numbers.every(Number.isFinite) ? [numbers[2], numbers[3]] : null;
};
// The report's measurements of one example: printed (static, skeleton) and
// bare, by width; the first load of a bare tag measured several times.
function measured(folder, example) {
  const out = {};
  for (const one of report?.results ?? []) {
    if (one.folder !== folder || one.example !== example || !WIDTHS.includes(one.width)) continue;
    const at = (out[one.width] ??= {});
    if (one.kind === 'static') at.printed = size(one.phases?.p3);
    if (one.kind === 'skeleton') at.skeleton = size(one.phases?.p1);
    if (one.kind === 'bare' && (one.load ?? 1) === 1) at.bare = {held: size(one.held), drawn: size(one.drawn), holds: Boolean(one.holds)};
  }
  return out;
}

const failed = [];
const before = existsSync(OUT) ? readJson(OUT) : null;
const all = {};
for (const component of components()) {
  const dir = join(component.dir, 'static');
  const sheetsFile = join(dir, 'sheets.json');
  if (!existsSync(sheetsFile)) {
    failed.push(`${component.folder}: no static/sheets.json (no snapshots)`);
    continue;
  }
  const previous = before?.components?.[component.folder] ?? null;
  const late = component.late;
  const templates = readdirSync(dir, {withFileTypes: true}).filter((one) => one.isDirectory()).map((one) => one.name).sort();
  const examples = [];
  for (const example of component.examples) {
    const template = templates.find((one) => existsSync(join(dir, one, `${example.name}.html`)));
    if (!template) continue;
    const snapshot = `${template}/${example.name}.html`;
    const skeleton = existsSync(join(dir, template, `${example.name}.skeleton.html`)) ? `${template}/${example.name}.skeleton.html` : null;
    const fresh = report ? measured(component.folder, example.name) : null;
    const kept = previous?.examples?.find((one) => one.name === example.name)?.box ?? null;
    examples.push({
      name: example.name,
      title: example.title ?? example.name,
      snapshot,
      skeleton,
      box: fresh && Object.keys(fresh).length ? Object.fromEntries(WIDTHS.map((width) => [String(width), fresh[width] ?? null])) : kept,
    });
  }
  all[component.folder] = {
    id: component.manifest.id,
    tag: component.tag,
    version: component.manifest.version,
    skeleton: {
      needed: late.length > 0,
      late,
      snapshots: examples.filter((one) => one.skeleton).length,
    },
    before_code: covered[component.folder]
      ? {held_by: 'core', holds: covered[component.folder].holds, reads: covered[component.folder].reads}
      : {held_by: 'host', how: 'print the snapshot with its sheets, or size the element (--sf-skeleton-block-size)'},
    examples,
  };
}
const body = {
  $comment: 'Generated by scripts/first-paint-docs.mjs from src/smart/<folder>/static/ and a gate 24 report; do not edit, run it again. The data of the docs section «Первая отрисовка» of every Smart component page (owner decision C252); snapshot and skeleton paths are relative to distr/smart/<folder>/static/, boxes are [width, height] in px at the widths named.',
  schema: SCHEMA,
  schema_version: 1,
  widths: WIDTHS,
  components: all,
};
const text = `${JSON.stringify(body, null, 2)}\n`;
const rel = relative(repo, OUT);
let state;
if (check) {
  // Boxes and versions are not compared: the structure is.
  const strip = (one) => JSON.stringify(Object.fromEntries(Object.entries(one?.components ?? {}).map(([folder, entry]) => [folder, {...entry, version: null, examples: entry.examples.map(({box, ...rest}) => rest)}])));
  if (!before) failed.push(`${rel}: missing (run node scripts/first-paint-docs.mjs)`);
  else if (strip(before) !== strip(body)) {
    const stale = Object.keys({...all, ...before.components}).filter((folder) => strip({components: {[folder]: before.components[folder] ?? {examples: []}}}) !== strip({components: {[folder]: all[folder] ?? {examples: []}}}));
    failed.push(`${rel}: stale for ${stale.join(', ')} (run node scripts/first-paint-docs.mjs)`);
  }
  state = failed.length ? 'stale' : 'current';
} else {
  state = before && readFileSync(OUT, 'utf8') === text ? 'unchanged' : 'written';
  if (state === 'written') writeFileSync(OUT, text);
}
console.log(JSON.stringify({mode: check ? 'check' : 'write', file: rel, state, components: Object.keys(all).length, report: reportFile ?? null, failed}, null, 2));
if (failed.length) process.exit(1);
