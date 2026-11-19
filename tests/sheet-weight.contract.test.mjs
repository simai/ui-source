// Sheet weight (2026-11-19): scripts/check-sheet-weight.mjs fails a build whose
// layered rules still carry the copies no browser that reads @layer applies.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-sheet-weight.mjs');
const {deadCopies, blocks} = await import(script);

test('layered copies are found, one family each', () => {
  const css = '@layer sf.reset, sf.components;@layer sf.components{'
    + '.a:not(.does-not-exist) .b{color:red}'
    + '_:-ms-input-placeholder, html:not([dir="rtl"]) .c{margin-left:1px}'
    + '@supports not (margin-inline-start: initial){html:not([dir="rtl"]) .c{margin-left:1px}}'
    + '.d{padding:1px;padding:var(--p, 1px)}}';
  const dead = deadCopies(css);
  assert.equal(dead.is, 1);
  assert.equal(dead.ie, 1);
  assert.equal(dead.supports, 1);
  assert.equal(dead.var, 1);
});

test('what a browser applies is not a copy', () => {
  const css = '@layer sf.components{'
    + '.a:is(.b, .c){color:red}'
    + '@supports not (float: inline-start){html:not([dir="rtl"]) .f{float:left}}'
    + '@supports not selector(::-webkit-scrollbar){.s{scrollbar-width:thin}}'
    + '.i::-ms-input-placeholder{color:red}'
    + '.w{width:100%;width:stretch}'
    + '.v{padding:var(--p);padding:1px}'
    + '.k{--x:1px;--x:var(--y)}'
    + '.m{margin:1px!important;margin:var(--m)}}'
    // Outside a layer the legacy copies are for the browsers that read no layer.
    + '_:-ms-input-placeholder, html:not([dir="rtl"]) .o{margin-left:1px}'
    + '.o{margin:1px;margin:var(--m)}';
  assert.deepEqual(deadCopies(css), {is: 0, ie: 0, supports: 0, var: 0, examples: []});
});

test('blocks read statements, strings and nested layers', () => {
  const found = blocks('@layer a, b;@layer a{@media (width > 1px){.x[title="{;}"]{content:"}";color:red}}}');
  assert.deepEqual(found.map((one) => one.prelude), ['@layer a', '@media (width > 1px)', '.x[title="{;}"]']);
  assert.deepEqual(found[2].parents, ['@layer a', '@media (width > 1px)']);
  assert.match(found[2].body, /color:red/u);
});

test('the script fails a folder with copies and passes a clean one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-weight-'));
  try {
    fs.writeFileSync(path.join(dir, 'clean.css'), '@layer sf.components{.a:is(.b,.c){padding-inline-start:1px}}');
    let run = spawnSync(process.execPath, [script, dir], {encoding: 'utf8'});
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /1 sheets, \d+ bytes, 0 with dead copies/u);
    fs.writeFileSync(path.join(dir, 'old.css'), '@layer sf.components{_:-ms-input-placeholder, html:not([dir="rtl"]) .a{padding-left:1px}}');
    run = spawnSync(process.execPath, [script, dir], {encoding: 'utf8'});
    assert.equal(run.status, 1);
    assert.match(run.stdout, /dead copies in old\.css: is 0, ie 1/u);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
