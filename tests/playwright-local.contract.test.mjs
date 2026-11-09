import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {ensureLocalPlaywright} from '../scripts/playwright-local.mjs';

// The browser probes import playwright from this repository's own
// node_modules, a pinned devDependency, never from a copy above it.
const root = resolve(import.meta.dirname, '..');

test('playwright is a pinned devDependency with a locked entry', () => {
  const declared = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies?.playwright;
  assert.match(declared ?? '', /^\d+\.\d+\.\d+$/u, 'an exact version, not a range');
  const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
  assert.ok(lock.includes(`\nplaywright@${declared}:\n  version "${declared}"`), 'yarn.lock holds the declared version');
  assert.ok(lock.includes(`\nplaywright-core@${declared}:\n`), 'yarn.lock holds its core at the same version');
});

test('the probe runners resolve playwright through the local check', () => {
  for (const script of ['scripts/run-browser-probes.mjs', 'scripts/snapshot-first-paint.mjs']) {
    const source = readFileSync(join(root, script), 'utf8');
    assert.match(source, /ensureLocalPlaywright\(/u, script);
    assert.doesNotMatch(source, /\/Users\/[^/]+\/node_modules/u, `${script} names no shared node_modules`);
  }
});

// A main checkout and a worktree of it, in a temporary folder, with a stand-in
// playwright package: the check reads only package.json files.
function checkout(installed) {
  const base = mkdtempSync(join(tmpdir(), 'playwright-local-'));
  const main = join(base, 'main');
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {stdio: 'ignore'});
  mkdirSync(main);
  git(main, 'init', '-q');
  writeFileSync(join(main, 'package.json'), JSON.stringify({private: true, devDependencies: {playwright: '9.9.9'}}));
  writeFileSync(join(main, '.gitignore'), 'node_modules\n');
  git(main, 'add', '-A');
  git(main, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'fixture');
  if (installed) {
    mkdirSync(join(main, 'node_modules', 'playwright'), {recursive: true});
    writeFileSync(join(main, 'node_modules', 'playwright', 'package.json'), JSON.stringify({name: 'playwright', version: installed}));
  }
  const worktree = join(base, 'worktree');
  git(main, 'worktree', 'add', '-q', '--detach', worktree);
  return {base, main, worktree};
}

test('a worktree without node_modules borrows the main checkout\'s', (t) => {
  const {base, main, worktree} = checkout('9.9.9');
  t.after(() => rmSync(base, {recursive: true, force: true}));
  const found = ensureLocalPlaywright(worktree);
  assert.equal(found.version, '9.9.9');
  assert.ok(lstatSync(join(worktree, 'node_modules')).isSymbolicLink());
  assert.equal(realpathSync(join(worktree, 'node_modules')), realpathSync(join(main, 'node_modules')));
});

test('a missing or different playwright stops the run with what to do', (t) => {
  const missing = checkout(null);
  const other = checkout('9.9.8');
  t.after(() => {
    rmSync(missing.base, {recursive: true, force: true});
    rmSync(other.base, {recursive: true, force: true});
  });
  assert.throws(() => ensureLocalPlaywright(missing.worktree), /is not installed in .*yarn install --frozen-lockfile/u);
  assert.equal(existsSync(join(missing.worktree, 'node_modules')), false, 'nothing is linked when the main checkout has no playwright');
  assert.throws(() => ensureLocalPlaywright(other.worktree), /playwright 9\.9\.8 is installed, package\.json declares 9\.9\.9/u);
});
