import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {SCHEMA, USAGE, sheetLinks, snapshotIndex} from '../tools/first-paint/print.mjs';
import {isDistribution, outputMounts} from '../scripts/first-paint-lib.mjs';

// tools/first-paint/print.mjs without a browser: what it reads, how it names
// what it reads, and that its page documents it (docs/developer/first-paint-print.md).
// tests/browser/first-paint-print.browser.mjs draws three components with it.
const root = new URL('..', import.meta.url).pathname;
const doc = readFileSync(join(root, 'docs', 'developer', 'first-paint-print.md'), 'utf8');

const scratch = (build) => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-first-paint-print-'));
  build(dir);
  return dir;
};
const write = (file, text) => {
  mkdirSync(join(file, '..'), {recursive: true});
  writeFileSync(file, text);
};

test('1. a distribution and a build output are both served under /distr/', () => {
  const distr = scratch((dir) => {
    write(join(dir, 'core', 'js', 'core.js'), '');
    mkdirSync(join(dir, 'smart'));
  });
  const output = scratch((dir) => write(join(dir, 'core', 'core', 'js', 'core.js'), ''));
  try {
    assert.equal(isDistribution(distr), true);
    assert.equal(isDistribution(output), false);
    assert.deepEqual(outputMounts(distr).map(([prefix, path]) => [prefix, path.slice(distr.length)]), [
      ['/distr/core/', '/core'], ['/distr/rule/', '/rule'], ['/distr/component/', '/component'],
      ['/distr/utility/', '/utility'], ['/distr/smart/', '/smart'],
    ]);
    assert.deepEqual(outputMounts(output).map(([prefix, path]) => [prefix, path.slice(output.length)]), [
      ['/distr/core/', '/core/core'], ['/distr/rule/', '/core/rule'], ['/distr/component/', '/component/component'],
      ['/distr/utility/', '/utility/utility'], ['/distr/smart/', '/smart/smart'],
    ]);
  } finally {
    rmSync(distr, {recursive: true, force: true});
    rmSync(output, {recursive: true, force: true});
  }
});

test('2. the committed snapshots are known by their markup, the header and skeletons left out', () => {
  const distr = scratch((dir) => {
    write(join(dir, 'core', 'js', 'core.js'), '');
    write(join(dir, 'smart', 'badge', 'static', 'default', 'reference.html'), '<!-- sf-badge, example «reference»: the static markup -->\n<sf-badge text="A">\n<span data-sf-static>A</span>\n</sf-badge>\n');
    write(join(dir, 'smart', 'badge', 'static', 'default', 'reference.skeleton.html'), '<!-- skeleton -->\n<sf-badge></sf-badge>\n');
    write(join(dir, 'smart', 'badge', 'static', 'sheets.json'), '{}');
  });
  try {
    const index = snapshotIndex(distr);
    assert.deepEqual([...index.entries()], [['<sf-badge text="A">\n<span data-sf-static>A</span>\n</sf-badge>', 'smart/badge/static/default/reference.html']]);
  } finally {
    rmSync(distr, {recursive: true, force: true});
  }
});

test('3. sheet links are under the site\'s URL of distr/, in the given order', () => {
  assert.deepEqual(sheetLinks(['core/css/core.css', 'component/badges/css/badges.min.css'], '/assets/ui'), [
    '<link rel="stylesheet" href="/assets/ui/core/css/core.css">',
    '<link rel="stylesheet" href="/assets/ui/component/badges/css/badges.min.css">',
  ]);
  assert.deepEqual(sheetLinks(['core/css/core.css'], 'https://cdn.example/ui/distr/'), ['<link rel="stylesheet" href="https://cdn.example/ui/distr/core/css/core.css">']);
});

test('4. the page documents the command line, the module and the output', () => {
  for (const flag of [...USAGE.matchAll(/--([a-z-]+)/gu)].map((match) => match[1])) {
    assert.ok(doc.includes(`--${flag}`), `docs: --${flag}`);
  }
  for (const name of ['createPrinter', 'printFirstPaint', 'sheetLinks', 'snapshotIndex', SCHEMA]) assert.ok(doc.includes(name), `docs: ${name}`);
  for (const field of ['"elements"', '"status"', '"printed"', '"unknown"', '"failed"', '"sheets"', '"snapshot"', '"nested"', '"notes"', 'text-shown-twice', '"source"', '"summary"']) {
    assert.ok(doc.includes(field), `docs: ${field}`);
  }
});

test('5. the tool reuses the snapshot machinery, never a copy of it', () => {
  const tool = readFileSync(join(root, 'tools', 'first-paint', 'print.mjs'), 'utf8');
  const snapshot = readFileSync(join(root, 'scripts', 'snapshot-first-paint.mjs'), 'utf8');
  assert.match(tool, /from '\.\.\/\.\.\/scripts\/first-paint-lib\.mjs'/u);
  assert.match(tool, /scripts', 'first-paint-page\.js'/u, 'the same page serializer');
  // The snapshot draws an example through first-paint-lib.mjs drawExample
  // (group build 19: shared with tools/first-paint/render.mjs), which takes
  // the first paint with the same steps as this tool.
  const lib = readFileSync(join(root, 'scripts', 'first-paint-lib.mjs'), 'utf8');
  const draw = lib.slice(lib.indexOf('export async function drawExample('), lib.indexOf('/** The assemblies, each with'));
  assert.match(snapshot, /drawExample\(\{/u, 'the snapshot draws through drawExample');
  for (const shared of ['serializeSettled', 'settleSheets', 'watchRequests', 'PAGE_CONTEXT']) {
    assert.ok(tool.includes(shared) && draw.includes(shared), `${shared}: both take the first paint the same way`);
  }
  assert.doesNotMatch(tool, /__sfFirstPaintSerialize\(/u, 'serialized through serializeSettled');
});
