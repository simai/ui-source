import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {lintPaths, lintSource, lintStylesheet} from '../tools/lint-kbd-styles.mjs';

// The self-test of tools/lint-kbd-styles.mjs: a product never styles a key
// (owner decision 2026-11-07, docs review R030, rule C04). ui-pro and ui-doc
// run the tool over their own sheets; here it is shown what it finds, what it
// lets through, and that the Framework's own hosts pass it.
const tool = fileURLToPath(new URL('../tools/lint-kbd-styles.mjs', import.meta.url));
const rules = (findings) => findings.map((finding) => `${finding.rule} ${finding.selector}`);

test('the lint finds a product styling keys: the element, the component classes, a key class of its own, an internal variable', () => {
  const sheet = [
    '.toolbar kbd { color: red; }',
    ':where(.menu) :where(kbd) { padding: 0; }',
    'kbd::before { content: ""; }',
    '.sf-kbd--group { gap: 8px; }',
    '.row .sf-kbd { border: 0; }',
    '.sf-kbd-join { display: none; }',
    '.sf-admin-nav-kbd { font-size: 12px; }',
    '.palette { --sf-kbd--size: 20px; }',
    '.nav { &-kbd { color: blue; } }',
  ].join('\n');
  assert.deepEqual(rules(lintStylesheet(sheet)), [
    'kbd-element .toolbar kbd',
    'kbd-element :where(.menu) :where(kbd)',
    'kbd-element kbd::before',
    'kbd-class .sf-kbd--group',
    'kbd-class .row .sf-kbd',
    'kbd-class .sf-kbd-join',
    'kbd-like-class .sf-admin-nav-kbd',
    'kbd-internal --sf-kbd--size',
    'kbd-like-class &-kbd',
  ]);
  const [first] = lintStylesheet('\n\n  .toolbar kbd { color: red; }');
  assert.deepEqual([first.line, first.column], [3, 3]);
});

test('the lint lets through what is not styling a key', () => {
  const sheet = [
    '/* kbd { color: red } in a comment */',
    '.docs { --sf-kbd-size: 1.5em; --sf-kbd-plain-color: var(--sf-on-surface); }',
    'kbd code { font: inherit; }',
    'code:where(:not(kbd code, pre code)) { padding: 0; }',
    '.toolbar:has(kbd) { gap: 4px; }',
    '@media (forced-colors: active) { .x { color: CanvasText; } }',
    '.keyboard { display: grid; }',
    '/* sf-kbd-lint: allow the legacy palette until 2026-12-01 */',
    '.legacy kbd { color: red; }',
    '.legacy-2 kbd { color: red; } /* sf-kbd-lint: allow */',
  ].join('\n');
  assert.deepEqual(rules(lintStylesheet(sheet)), []);
});

test('the lint reads <style> blocks of pages with their page lines, and skips other files', () => {
  const page = '<!doctype html>\n<html><head>\n<style>\n.hero kbd { color: red; }\n</style></head>\n<body><kbd>K</kbd></body></html>';
  const findings = lintSource(page, '.html');
  assert.deepEqual(rules(findings), ['kbd-element .hero kbd']);
  assert.equal(findings[0].line, 4);
  assert.deepEqual(lintSource('kbd { color: red }', '.js'), []);
});

test('the lint walks folders, skips node_modules and the Framework distribution, and exits 1 on a finding', () => {
  const root = mkdtempSync(join(tmpdir(), 'kbd-lint-'));
  try {
    for (const folder of ['src', 'node_modules/pkg', 'public/distr/component/kbd/css']) mkdirSync(join(root, folder), {recursive: true});
    writeFileSync(join(root, 'src/app.scss'), '.search { kbd { color: red; } }\n');
    writeFileSync(join(root, 'src/clean.css'), '.search { --sf-kbd-gap: 0.5em; }\n');
    writeFileSync(join(root, 'node_modules/pkg/x.css'), 'kbd { color: red; }\n');
    writeFileSync(join(root, 'public/distr/component/kbd/css/kbd.css'), ':where(kbd) { color: red; }\n');
    const report = lintPaths([root]);
    assert.equal(report.files, 2);
    assert.deepEqual(report.findings.map((finding) => finding.file.slice(root.length + 1)), ['src/app.scss']);
    const run = spawnSync(process.execPath, [tool, '--json', root], {encoding: 'utf8'});
    assert.equal(run.status, 1, run.stderr);
    assert.equal(JSON.parse(run.stdout).findings.length, 1);
    const clean = spawnSync(process.execPath, [tool, '--ignore', '/src/app.scss', root], {encoding: 'utf8'});
    assert.equal(clean.status, 0, clean.stdout);
    assert.equal(spawnSync(process.execPath, [tool], {encoding: 'utf8'}).status, 2);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('the Framework\'s own hosts pass the lint: only the kbd component styles a key', () => {
  const report = lintPaths([fileURLToPath(new URL('../src', import.meta.url))], {ignore: ['/src/component/kbd/']});
  assert.ok(report.files > 100, `${report.files} files read`);
  assert.deepEqual(report.findings.map((finding) => `${finding.file}:${finding.line} ${finding.selector}`), []);
});
