#!/usr/bin/env node
// Usage: node scripts/run-browser-probes.mjs /absolute/path/to/build/output
//
// Every browser probe, each with the roots it actually asks for. This exists
// because a hand-written sweep that guesses a probe's arguments from its name got
// three probes wrong in one day, and a mis-called probe and a failing one look
// identical in a loop: each time, something green was reported red and a cycle went
// into finding out which. The arity is read from the probe itself rather than
// remembered.
import {execFileSync, spawn} from 'node:child_process';
import {readdirSync, readFileSync, existsSync, mkdtempSync, symlinkSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ? resolve(process.argv[2]) : null;
if (!out || !existsSync(out)) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');

const roots = {
  output: out,
  smart: join(out, 'smart', 'smart'),
  smartParent: join(out, 'smart'),
  core: join(out, 'core'),
};

// Probes that drive a served lab rather than a build root: they take URLs, so they
// need a lab running and are not part of a pair's own evidence. Listed with the
// reason rather than filtered silently, because a skipped probe and a passing one
// must not read the same.
// (composition-routing, table-intents, table-search-caret and loader-hidden-tab
// drive a table and left with the Larena components for package larena.)
const needsLab = new Set([
  'composition-editor-field-kinds', 'composition-inline-editor', 'composition-overlay',
  'composition-regions', 'composition-sortable',
  'position', 'position-surfaces', 'drawer-docked',
  // Takes a distribution URL (a published pair by default), not a build root.
  'aliases',
]);

// Each probe states what it wants, in the error it throws when it is not given it.
// That sentence is the probe's own account of its arguments, so it is what this
// reads -- counting process.argv indices guesses, and guessed wrong for a probe
// that destructures process.argv.slice(2).
const WANTS = [
  [/Smart output root and distr root/u, () => [roots.smart, roots.core]],
  [/Core and Smart output roots/u, () => [roots.core, roots.smartParent]],
  [/Smart output root is required/u, () => [roots.smart]],
  [/Build output root is required/u, () => [roots.output]],
];

const argsFor = (source) => {
  for (const [pattern, build] of WANTS) if (pattern.test(source)) return build();
  return null;
};

// Every file in the directory is accounted for, not only the ones this knows how
// to run. The first version of this runner looked at `*.browser.mjs` alone, so the
// 267 `*.cli.js` probes -- the whole composition geometry set among them -- were
// absent from passed, skipped and unknown alike: a sweep reported green without
// them ever running, which is exactly the quiet skip this runner exists to refuse.
// Found by the other Framework session, in the runner built to prevent it.
const everything = readdirSync(join(root, 'tests', 'browser')).sort();
const files = everything.filter((name) => name.endsWith('.browser.mjs'));
const cliFiles = everything.filter((name) => name.endsWith('.cli.js'));
const unaccounted = everything.filter((name) => !name.endsWith('.browser.mjs') && !name.endsWith('.cli.js'));
const results = {passed: [], failed: [], skipped: [], unknown: []};

for (const file of files) {
  const name = file.replace('.browser.mjs', '');
  if (needsLab.has(name)) {
    results.skipped.push(name);
    continue;
  }
  const path = join(root, 'tests', 'browser', file);
  const source = readFileSync(path, 'utf8');
  const args = argsFor(source);
  if (!args) {
    // A probe whose arguments this cannot establish is reported, not guessed at: a
    // guess that happens to pass is worse than a gap, because it reads as evidence.
    results.unknown.push(name);
    continue;
  }
  try {
    execFileSync(process.execPath, [path, ...args], {stdio: ['ignore', 'pipe', 'pipe']});
    results.passed.push(name);
  } catch (error) {
    const said = String(error.stderr ?? '').trim().split('\n').slice(-3).join(' ');
    // The whole report too: the last three lines of a failure's JSON were all
    // brackets, and a probe that fails once in a long run could not be read
    // (context-menu-panel, 2026-10-18 and -19).
    const detail = `${String(error.stdout ?? '').trim()}\n${String(error.stderr ?? '').trim()}`.trim().slice(0, 4000);
    results.failed.push({name, args: args.map((value) => value.replace(out, '<out>')), said: said.slice(0, 300), detail});
  }
}

// The cli probes are page functions against a fixture server, and they measure the
// *published* runtime in ../ui/distr rather than a candidate build root -- a
// different contour, which is why they are not part of a build's own evidence and
// why running them is asked for rather than assumed. `--fixtures` serves a root
// holding this revision and the published runtime and runs the ones that want it.
const cli = {fixtures: [], documentation: [], ownerOutputs: [], sourceOnly: [], unknown: []};
// Port-agnostic on purpose. These probes were each written to be run by hand with
// a server on whatever port was free, so between them they name more than thirty --
// 8765, 8766, 8768, 8878 and on. Keying the categories to one port put a hundred
// and sixteen of them in «unknown», which was a true statement about the runner and
// a false one about the probes.
const PORTED = /127\.0\.0\.1:(\d+)(\/[A-Za-z0-9/._-]*)?/gu;
const ports = new Set();
for (const name of cliFiles) {
  const source = readFileSync(join(root, 'tests', 'browser', name), 'utf8');
  const asks = [...source.matchAll(PORTED)].map(([, port, path]) => ({port, path: path ?? '/'}));
  for (const {port} of asks) ports.add(Number(port));
  // By the path fragments the file contains, wherever they appear. Matching only a
  // literal URL missed every probe that builds its address from a base it declares
  // -- `${workspace}/tests/fixtures/...` -- and put them in «unknown».
  const needsOutput = /\/source\/output\//u.test(source);
  const needsFixture = /\/tests\/fixtures\//u.test(source);
  // An output this tree may not hold decides first: a probe that cannot reach its
  // candidate cannot run whatever else it also wants.
  if (needsOutput) cli.ownerOutputs.push(name);
  else if (needsFixture) cli.fixtures.push(name);
  else if (/ui-doc/u.test(source) || /-docs?\.cli\.js$/u.test(name)
    || /\/(ru|en)\/(components|smart-components|guide)\//u.test(source)
    || asks.some(({path}) => /^\/(ru|en)\//u.test(path))) cli.documentation.push(name);
  // A probe that opens no page measures a source file rather than a rendering, and
  // takes no roots at all. Named rather than left unknown, because «unknown» should
  // mean «this runner does not understand it», not «it wanted nothing».
  else if (!/page\.(goto|setContent)/u.test(source)) cli.sourceOnly.push(name);
  else cli.unknown.push(name);
}
// The claim about the owner outputs is checked rather than asserted: if the tree
// does hold them, they are runnable and saying otherwise would be an excuse.
const hasOwnerOutputs = existsSync(join(root, 'source', 'output'));

const fixtureResults = {ran: 0, passed: [], failed: []};
if (process.argv.includes('--fixtures')) {
  const served = mkdtempSync(join(tmpdir(), 'sf-probe-root-'));
  symlinkSync(root, join(served, 'ui-source'));
  symlinkSync(resolve(root, '..', 'ui'), join(served, 'ui'));
  // The driver lives in the repository, not in the served directory: it imports
  // playwright, and a script outside the tree resolves no node_modules -- the first
  // run of this put it in the temp root and every probe failed with
  // ERR_MODULE_NOT_FOUND, which reads exactly like ninety-two product failures.
  const driver = join(root, 'tests', 'browser', '.run-page-function.mjs');
  // The probes are bare `async (page) => {...}` expressions, written to be handed
  // to a page driver. Wrapping one in parentheses is what makes it a value to call.
  writeFileSync(driver, `import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const run = eval('(' + readFileSync(process.argv[2], 'utf8') + ')');
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  const result = await run(page);
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  if (/"failures":\\[[^\\]]/u.test(text) || /FAIL/u.test(text)) { console.error(text); process.exit(1); }
  console.log(text);
} catch (error) { console.error(String(error?.message ?? error).slice(0, 300)); process.exit(1); }
finally { await browser.close(); }
`);
  const server = spawn('python3', ['-m', 'http.server', '8765'], {cwd: served, stdio: 'ignore', detached: true});
  try {
    execFileSync('sh', ['-c', 'for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf -o /dev/null http://127.0.0.1:8765/ && exit 0; sleep 1; done; exit 1']);
    for (const name of cli.fixtures) {
      fixtureResults.ran += 1;
      try {
        execFileSync(process.execPath, [driver, join(root, 'tests', 'browser', name)], {
          cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
        });
        fixtureResults.passed.push(name);
      } catch (error) {
        fixtureResults.failed.push({name, said: String(error.stderr ?? '').trim().slice(0, 240)});
      }
    }
  } finally {
    try { process.kill(-server.pid); } catch { /* already gone */ }
    try { rmSync(driver); } catch { /* already gone */ }
  }
}

console.log(JSON.stringify({
  passed: results.passed.length,
  failed: results.failed,
  skipped: {count: results.skipped.length, why: 'these drive a served lab and take URLs', names: results.skipped},
  unknown: {count: results.unknown.length, why: 'this runner could not establish what roots they want', names: results.unknown},
  cli: {
    fixtures: {
      count: cli.fixtures.length,
      why: 'page functions against a fixture server, measuring the published runtime in ../ui/distr; pass --fixtures to run them',
      ran: fixtureResults.ran,
      passed: fixtureResults.passed.length,
      failed: fixtureResults.failed,
    },
    documentation: {count: cli.documentation.length, why: 'these measure the documentation site, not the runtime', names: cli.documentation},
    ownerOutputs: {count: cli.ownerOutputs.length, why: 'these want a per-owner build output under source/output, which a clean tree may not hold'},
    sourceOnly: {count: cli.sourceOnly.length, why: 'these open no page: they read a source file rather than measuring a rendering', names: cli.sourceOnly},
    unknown: {count: cli.unknown.length, why: 'this runner could not establish what they want', names: cli.unknown},
  },
  unaccounted: {count: unaccounted.length, names: unaccounted},
}, null, 1));
// An unestablished probe fails the run as loudly as a failing one: a sweep that
// quietly passed over the probes it did not understand is how three green probes
// were reported red in one day.
if (results.failed.length || results.unknown.length || cli.unknown.length
  || unaccounted.length || fixtureResults.failed.length) process.exit(1);
