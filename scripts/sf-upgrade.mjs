#!/usr/bin/env node
// Usage: node scripts/sf-upgrade.mjs <project-dir> [--apply] [--json] [--since YYYY-MM-DD] [--journal path]
//
// Upgrades a product written against an older Framework by reading the change
// journal (contracts/changes/journal.json), not a changelog: every record says
// what changed, what to write instead and whether the rewrite is mechanical.
//
// Without --apply it only reports. With --apply it rewrites what is mechanical
// (an attribute, a value, an event name, a class, a token, a utility) and leaves
// the rest as a list of manual items, each with its record's instruction and a
// before/after example: that list is the brief for a person or an AI. --since
// limits the run to records deprecated on or after a date, e.g. the date of the
// pair the product was last upgraded to. Removed records (tombstones) are read
// too: a product can be upgraded across names the Framework no longer knows.
//
// A component that moved to a component package keeps its name; what a product
// must add is the package declaration. Such an item's `to` names it
// (`SF_BOOT_CONFIG.packages.<name>`), and the item is reported only in a project
// that declares no such package anywhere: `packages: {<name>: ...}`,
// `packages.<name> = ...`, `'packages' => ['<name>' => ...]` or
// `SF.RuleLoader.registerPackage('<name>', ...)`.
//
// A component can move more than once -- the four Larena components went to
// package `pro` and then to `larena` when SIMAI Framework Pro was dropped -- and
// only the last move is what a project owes. The earlier record stays in the
// journal as history; it is not reported, or a project already on `larena`
// would be told to declare `pro`.
//
// A format named with its version (`rewrite: "rename-format"`, owner decision
// 2026-10-11: names carry no version) moves to two fields, `"schema":
// "simai.<name>"` and `"schema_version": <major>`. That is mechanical where the
// label is a declaration: in a JSON file that keeps the standard layout, every
// object's "schema" (the file is parsed, changed and written back in the same
// layout, schema_version right after schema), and in a script a literal
// `schema: '...'` or `'schema' => '...'` when the file names schema_version
// nowhere else. A comparison against the label, a JSON file in another layout
// and an item the journal marks `held` (the Framework itself keeps that format
// in its older form for now) are reported and left.
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {resolve, join, extname, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const project = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--since' && args[args.indexOf(arg) - 1] !== '--journal');
if (!project) {
  console.error('Usage: node scripts/sf-upgrade.mjs <project-dir> [--apply] [--json] [--since YYYY-MM-DD] [--journal path]');
  process.exit(2);
}
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const apply = args.includes('--apply');
const asJson = args.includes('--json');
const since = option('--since');
const here = dirname(fileURLToPath(import.meta.url));
const journal = JSON.parse(readFileSync(option('--journal') || resolve(here, '..', 'contracts', 'changes', 'journal.json'), 'utf8'));

const EXTENSIONS = new Set(['.html', '.htm', '.php', '.twig', '.vue', '.js', '.mjs', '.ts', '.jsx', '.tsx', '.css', '.scss', '.md', '.json']);
// A project's copies of the Framework itself -- a distribution, a package
// build's overlay, a site build, the pinned standards -- are the Framework's
// bytes, often pinned by digest; they change by taking another pair, never by
// an edit.
const SKIP = new Set(['node_modules', 'vendor', '.git', 'dist', 'distr', 'build', 'build_production', 'storage', '.artifacts', '.overlay', '.package-build', '.probe-output']);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('build_')) continue;
    if (name === 'pinned' && dir.endsWith('standards')) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (EXTENSIONS.has(extname(name)) || name.endsWith('.blade.php')) files.push(path);
  }
};
walk(resolve(project));

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const PACKAGE_TARGET = /^SF_BOOT_CONFIG\.packages\.([a-z][a-z0-9-]*)$/u;
const declaredPackages = new Map();
// Whether any project file declares the component package `name`.
const declaresPackage = (name) => {
  if (!declaredPackages.has(name)) {
    // The package's key followed by its object: {base: ...} or ['base' => ...].
    const key = `['"]?${escape(name)}['"]?\\s*(?::|=>|=)\\s*[\\[{]`;
    const pattern = new RegExp(`\\bpackages['"]?\\s*(?::|=>|=)\\s*[\\[{][^;]{0,400}?${key}|\\bpackages\\.${key}|registerPackage\\(\\s*['"]${escape(name)}['"]`, 'u');
    declaredPackages.set(name, files.some((file) => pattern.test(readFileSync(file, 'utf8'))));
  }
  return declaredPackages.get(name);
};
// One rule per item: a pattern that finds the old form and, where the rewrite is
// mechanical, the replacement for one match.
// The package each moved component lives in now: the target of the last record
// that moves it, in journal order.
const currentPackage = new Map();
for (const record of journal.records) {
  if (record.kind !== 'component') continue;
  for (const item of record.items) {
    const moved = PACKAGE_TARGET.exec(item.to || '');
    if (moved && item.component) currentPackage.set(item.component, moved[1]);
  }
}

function rulesFor(record) {
  const rules = [];
  // A class or a token is matched by its name alone, whatever component the item
  // names: two items with the same `from` (tightness-low on sf-button and on
  // sf-icon-button) made two identical rules, and every use was reported twice.
  const names = new Set();
  for (const item of record.items) {
    if (record.kind === 'class' || record.kind === 'token') {
      const key = `${item.from}\u0000${item.to ?? ''}`;
      if (names.has(key)) continue;
      names.add(key);
    }
    const moved = record.kind === 'component' && PACKAGE_TARGET.exec(item.to || '');
    if (moved && item.component && currentPackage.get(item.component) !== moved[1]) continue;
    if (moved && declaresPackage(moved[1])) continue;
    const tag = item.component && item.component.startsWith('sf-') ? item.component : null;
    if (item.match) {
      rules.push({item, mechanical: false, pattern: new RegExp(item.match, 'gu')});
      continue;
    }
    const mechanical = record.rewrite !== 'manual' && record.rewrite !== 'none' && item.to && !item.to.includes(' ') && !item.to.includes(',');
    if (record.kind === 'attribute' && tag) {
      // The whole opening tag, so a tag that already carries the new name is
      // seen: there the canonical name wins at runtime, and the legacy one is
      // simply dropped rather than renamed into a duplicate attribute.
      const legacy = new RegExp(`\\s${escape(item.from)}(=("[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s/>])`, 'u');
      // An attribute retired with nothing in its place (`to: null`) has no
      // canonical name to look for.
      const canonical = item.to ? new RegExp(`\\s${escape(item.to)}(=|[\\s/>])`, 'u') : null;
      rules.push({item, mechanical, pattern: new RegExp(`<${escape(tag)}\\b[^>]*?\\s${escape(item.from)}(?:=|[\\s/>])[^>]*>`, 'gu'),
        replace: (whole) => (canonical?.test(whole) ? whole.replace(legacy, '') : whole.replace(new RegExp(`(\\s)${escape(item.from)}(?=[=\\s/>])`, 'u'), `$1${item.to}`))});
    } else if (record.kind === 'attribute') {
      rules.push({item, mechanical, pattern: new RegExp(`(\\s)${escape(item.from)}(=)`, 'gu'), replace: (match, space, eq) => `${space}${item.to}${eq}`});
    } else if (record.kind === 'value') {
      const attribute = escape(item.attribute || '[a-z-]+');
      const scope = tag ? `<${escape(tag)}\\b[^>]*?\\s` : '<sf-[a-z-]+\\b[^>]*?\\s';
      rules.push({item, mechanical, pattern: new RegExp(`(${scope}${attribute}=["'])${escape(item.from)}(["'])`, 'gu'), replace: (match, head, tail) => `${head}${item.to}${tail}`});
    } else if (record.kind === 'event') {
      rules.push({item, mechanical, pattern: new RegExp(`(['"\`])${escape(item.from)}(['"\`])`, 'gu'), replace: (match, open, close) => `${open}${item.to}${close}`});
    } else if (record.kind === 'class' || record.kind === 'token') {
      rules.push({item, mechanical, pattern: new RegExp(`(?<![\\w-])${escape(item.from)}(?![\\w-])`, 'gu'), replace: () => item.to});
    } else if (record.kind === 'utility' && item.from.includes('*')) {
      const [before] = item.from.split('*');
      const [after] = (item.to || '').split('*');
      rules.push({item, mechanical: mechanical || Boolean(item.to), pattern: new RegExp(`(?<![\\w-])${escape(before)}([\\w/.-]+)`, 'gu'), replace: (match, rest) => `${after}${rest}`});
    } else if (record.kind === 'component' || record.kind === 'option' || record.kind === 'utility') {
      const word = item.from.split(' ')[0];
      rules.push({item, mechanical: false, pattern: new RegExp(`(?<![\\w-])${escape(word)}(?![\\w-])`, 'gu')});
    }
  }
  return rules;
}

const VERSIONED = /^(.+)\.v([0-9]+)$/u;
const JSON_LAYOUTS = [2, 4, '\t'];

// A JSON text's layout when it is what JSON.stringify writes, or null.
function jsonLayout(source, value) {
  const tail = source.endsWith('\n') ? '\n' : '';
  return JSON_LAYOUTS.find((indent) => JSON.stringify(value, null, indent) + tail === source) ?? null;
}

// Every object whose "schema" is one of `labels` ({label: {name, version}}),
// in place: schema becomes the name and schema_version follows it. Returns the
// number moved, or -1 when an object already says another schema_version.
function moveSchemas(value, labels) {
  let moved = 0;
  let conflict = false;
  const visit = (node) => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    const label = typeof node.schema === 'string' ? labels[node.schema] : null;
    if (label && node.schema_version !== undefined && node.schema_version !== label.version) conflict = true;
    for (const [key, child] of Object.entries(node)) {
      if (label && key === 'schema_version') continue;
      if (label && key === 'schema') {
        out.schema = label.name;
        out.schema_version = label.version;
        moved += 1;
        continue;
      }
      out[key] = visit(child);
    }
    return out;
  };
  const next = visit(value);
  return conflict ? {moved: -1, value} : {moved, value: next};
}

// The findings of a rename-format record in one file, and the file rewritten
// where that is mechanical.
function formatFindings(record, file, source) {
  const findings = [];
  const labels = {};
  for (const item of record.items) {
    const versioned = VERSIONED.exec(item.from);
    if (versioned && !item.held) labels[item.from] = {name: versioned[1], version: Number(versioned[2])};
  }
  const declaration = (label) => new RegExp(`((?:\\bschema|["']schema["'])\\s*(?::|=>)\\s*)(["'])${escape(label)}\\2`, 'gu');
  let next = source;
  let jsonMoves = false;
  if (extname(file) === '.json') {
    try {
      const value = JSON.parse(source);
      const layout = jsonLayout(source, value);
      if (layout !== null) {
        const result = moveSchemas(value, labels);
        if (result.moved > 0) {
          jsonMoves = true;
          next = JSON.stringify(result.value, null, layout) + (source.endsWith('\n') ? '\n' : '');
        }
      }
    } catch {
      // Not JSON after all: every label stays a finding for a person.
    }
  }
  // A file that carries a format the Framework holds is pinned as a whole --
  // a port conformance kit is pinned by digest beside what it checks -- so
  // nothing in it moves.
  const holds = record.items.some((item) => item.held && source.includes(item.from));
  if (holds) jsonMoves = false;
  const scriptMoves = !holds && extname(file) !== '.json' && !/schema_version/u.test(source);
  for (const item of record.items) {
    const pattern = new RegExp(item.match || `["']${escape(item.from)}["']`, 'gu');
    const declared = new Set([...source.matchAll(declaration(item.from))].map((match) => match.index + match[1].length));
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      const mechanical = Boolean(labels[item.from]) && declared.has(match.index) && (jsonMoves || scriptMoves);
      findings.push({file: relative(resolve(project), file), line, record: record.id, stage: record.stage, from: item.from, to: item.to ?? null, mechanical, held: item.held || null});
    }
    if (scriptMoves && labels[item.from]) {
      const {name, version} = labels[item.from];
      next = next.replace(declaration(item.from), (whole, head, quote) => (/=>\s*$/u.test(head)
        ? `${head}${quote}${name}${quote}, ${quote}schema_version${quote} => ${version}`
        : `${head}${quote}${name}${quote}, schema_version: ${version}`));
    }
  }
  return {findings, source: next};
}

const records = journal.records.filter((record) => !since || record.deprecated_on >= since);
const report = [];
for (const file of files) {
  let source = readFileSync(file, 'utf8');
  let changed = false;
  for (const record of records) {
    if (record.kind === 'format' && record.rewrite === 'rename-format') {
      const result = formatFindings(record, file, source);
      report.push(...result.findings);
      if (apply && result.source !== source && result.findings.some((row) => row.mechanical)) { source = result.source; changed = true; }
      continue;
    }
    for (const rule of rulesFor(record)) {
      for (const match of source.matchAll(rule.pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        report.push({file: relative(resolve(project), file), line, record: record.id, stage: record.stage, from: rule.item.from, to: rule.item.to ?? null, mechanical: rule.mechanical});
      }
      if (apply && rule.mechanical && rule.replace) {
        const next = source.replace(rule.pattern, rule.replace);
        if (next !== source) { source = next; changed = true; }
      }
    }
  }
  if (changed) writeFileSync(file, source);
}

const manual = [...new Set(report.filter((row) => !row.mechanical).map((row) => row.record))]
  .map((id) => journal.records.find((record) => record.id === id))
  .map((record) => ({id: record.id, summary: record.summary, manual: record.manual || null, examples: record.examples || null,
    places: report.filter((row) => row.record === record.id && !row.mechanical).map((row) => `${row.file}:${row.line} ${row.from}${row.held ? ` (held: ${row.held})` : ''}`)}));
const summary = {project: resolve(project), files: files.length, findings: report.length, mechanical: report.filter((row) => row.mechanical).length,
  applied: apply, manual: manual.length};
if (asJson) {
  console.log(JSON.stringify({summary, findings: report, manual}, null, 1));
} else {
  console.log(`${summary.findings} legacy uses in ${summary.files} files: ${summary.mechanical} mechanical${apply ? ' (rewritten)' : ' (run with --apply to rewrite)'}, ${report.length - summary.mechanical} for a person or an AI.`);
  for (const row of report) console.log(`  ${row.mechanical ? (apply ? 'fixed ' : 'auto  ') : 'manual'} ${row.file}:${row.line}  ${row.from} → ${row.to ?? '—'}  [${row.record}]${row.held ? ` held: ${row.held}` : ''}`);
  for (const entry of manual) {
    console.log(`\n${entry.id}: ${entry.summary}`);
    if (entry.manual) console.log(`  do: ${entry.manual}`);
    if (entry.examples) console.log(`  before: ${entry.examples.before}\n  after:  ${entry.examples.after}`);
  }
}
process.exitCode = report.some((row) => !row.mechanical || !apply) && report.length ? 1 : 0;
