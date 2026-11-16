import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {applyBaseline, lintPaths, lintSource, lintStylesheet} from '../tools/lint-raw-values.mjs';
import {inventory} from '../scripts/dimension-inventory-lib.mjs';

// The self-test of tools/lint-raw-values.mjs (owner decisions C18 and C178:
// sizes come from the systems, every general rule has a check in the pair
// build). ui-pro, ui-doc and products run the tool over their own sheets; here
// it is shown what it finds, what it lets through, and that the Framework's
// own sources pass it: every px it finds in src is a length the C18 dimension
// policy reviewed, and every stacking number beyond -1..2 is listed below
// with its owner until a layer role replaces it (none is left: the C173
// layer roles, point 7, took the last six).
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tool = join(root, 'tools', 'lint-raw-values.mjs');
const rules = (findings) => findings.map((finding) => `${finding.rule} ${finding.text}`);

test('the lint finds raw px, hairlines and stacking numbers', () => {
  const sheet = [
    '.a { padding: 6px; margin-top: -3px; }',
    '.b { inline-size: calc(100% - 12.5px); }',
    '.c { border: 1px solid; outline-offset: 2px; }',
    '.d { z-index: 9; }',
    '.e { z-index: 1000 !important; }',
    '@media (min-width: 640px) { .f { color: red; } }',
  ].join('\n');
  assert.deepEqual(rules(lintStylesheet(sheet)), [
    'raw-px 6px', 'raw-px -3px', 'raw-px 12.5px', 'raw-hairline 1px', 'raw-hairline 2px',
    'raw-z-index z-index: 9', 'raw-z-index z-index: 1000 !important', 'raw-px 640px',
  ]);
  const [first] = lintStylesheet('\n\n  .a { gap: 8px; }');
  assert.deepEqual([first.line, first.column], [3, 13]);
});

test('the lint lets the systems through: tokens, zero, local stacking, comments, names and allowed lines', () => {
  const sheet = [
    '.a { padding: var(--sf-space-1\\/2); margin: 0px; inset: 0; }',
    '.b { z-index: 1; } .c { z-index: -1; } .d { z-index: 2; } .e { z-index: var(--sf-z-index-1); }',
    '/* a 12px comment */ .f { color: red; } // 16px note',
    '.g { --sf-a12px: 0; background: url(icon-24px.svg); }',
    '#x12px { color: red; }',
    '.h { top: 3px; } /* sf-raw-lint: allow the caret sits on the baseline */',
    '/* sf-raw-lint: allow a vendor value */',
    '.i { z-index: 99; }',
  ].join('\n');
  assert.deepEqual(rules(lintStylesheet(sheet)), []);
});

test('the lint reads <style> blocks of pages and only the rules asked for', () => {
  const page = '<template><p>12px of text</p></template>\n<style>\n.card { padding: 12px; z-index: 5; }\n</style>';
  assert.deepEqual(rules(lintSource(page, '.vue')), ['raw-px 12px', 'raw-z-index z-index: 5']);
  assert.equal(lintSource(page, '.vue')[0].line, 3);
  assert.deepEqual(rules(lintSource(page, '.vue', {rules: ['raw-z-index']})), ['raw-z-index z-index: 5']);
  assert.deepEqual(lintSource('const x = "12px";', '.js'), []);
});

test('a baseline takes the reviewed findings and reports the ones that left', () => {
  const findings = [
    {file: '/p/src/a.scss', rule: 'raw-z-index', text: 'z-index: 9'},
    {file: '/p/src/a.scss', rule: 'raw-px', text: '6px'},
  ];
  const result = applyBaseline(findings, [
    {file: 'src/a.scss', rule: 'raw-z-index', text: 'z-index: 9', owner: 'a'},
    {file: 'src/b.scss', rule: 'raw-px', text: '4px'},
  ]);
  assert.deepEqual(rules(result.findings), ['raw-px 6px']);
  assert.deepEqual(result.baselined.map((one) => one.owner), ['a']);
  assert.deepEqual(result.stale.map((one) => one.file), ['src/b.scss']);
});

test('the command exits 1 on findings and 0 on a clean folder, skipping the Framework distribution', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sf-raw-lint-'));
  try {
    mkdirSync(join(folder, 'distr'));
    writeFileSync(join(folder, 'distr', 'core.css'), '.x { padding: 7px; }');
    writeFileSync(join(folder, 'clean.css'), '.x { padding: var(--sf-space-1); }');
    const clean = spawnSync(process.execPath, [tool, folder], {encoding: 'utf8'});
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /raw values: clean \(1 file/u);
    writeFileSync(join(folder, 'own.scss'), '.y { z-index: 50; }');
    const dirty = spawnSync(process.execPath, [tool, '--json', folder], {encoding: 'utf8'});
    assert.equal(dirty.status, 1);
    assert.deepEqual(JSON.parse(dirty.stdout).findings.map((one) => one.text), ['z-index: 50']);
    assert.equal(spawnSync(process.execPath, [tool], {encoding: 'utf8'}).status, 2);
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});

// The stacking numbers in the sources that wait for a layer role. The six the
// C178 lint found (country-code 9, dropdown 10, range-slider 3, sf-popover 3,
// the loading screen 1000, the editor utility 100) now read the C173/C181 layer
// roles (--sf-layer--popover, --sf-layer--message, --sf-layer--window; C181 (3)), so none
// is left; a new one fails here.
export const STACKING_DEFERRED = [];

test('C178 C181 (3): the Framework sources write no stacking number beyond the listed ones', () => {
  const report = lintPaths(['src'].map((path) => join(root, path)), {rules: ['raw-z-index'], baseline: STACKING_DEFERRED});
  assert.deepEqual(report.findings.map((one) => `${one.file.slice(root.length + 1)}:${one.line} ${one.text}`), [],
    'use a layer token (--sf-z-index-N) or the layer stack; local stacking -1..2 is fine');
  assert.deepEqual(report.stale, [], 'a fixed stacking number leaves STACKING_DEFERRED');
});

test('C178: every px length the lint finds in the Framework sources is one the C18 dimension policy reviewed', () => {
  const policy = JSON.parse(readFileSync(join(root, 'src/core/contracts/dimension-policy.v1.json'), 'utf8'));
  const reviewed = new Set(inventory(join(root, 'src'), {policy}).findings
    .filter((finding) => !['unreviewed', 'policy-conflict'].includes(finding.status))
    .map((finding) => `${finding.file}:${finding.line}:${finding.text}`));
  const report = lintPaths([join(root, 'src')], {rules: ['raw-px', 'raw-hairline']});
  assert.ok(report.findings.length > 0, 'the sources do carry reviewed px (hairlines, runtime geometry)');
  const open = report.findings
    .map((one) => `${one.file.slice(root.length + 5)}:${one.line}:${one.text}`)
    .filter((key) => !reviewed.has(key));
  assert.deepEqual(open, [], 'a px the policy has not reviewed: use a token or list a reviewed exception');
});
