import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import test from 'node:test';

// A Smart sheet the Loader never asks for is a dead sheet (audit 2026-11-11,
// control evidence 2026-11-11-dead-smart-sheets). The Loader links a Smart
// unit's css/<folder>.css only when its rule says css: true
// (styleSheetsOfRule in core/js/loader.js); the build fills that sheet with
// whatever the bundle imports. sf-tabs imported js/templates/default.css with
// no css in its rule, so every rule there was dead on every page, and the
// fixes written into it (TB-04) never reached one. sf-avatar-group copied
// the avatars class sheet the same way.

const repo = resolve(new URL('..', import.meta.url).pathname);
const smart = join(repo, 'src', 'smart');
const IMPORT = /^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gmu;
const USE = /^\s*@(?:use|forward|import)\s+['"]([^'"]+)['"]/gmu;

// Old distribution paths that forward to a renamed unit (journal path-smart-*):
// the Loader forwards their rule name and never fetches them; their sheet is
// kept for a page that links the old css path itself, until the dated removal.
const PATH_FORWARDS = new Set(['color', 'icon-button', 'icon-buttons', 'inputs', 'tags']);

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (name === 'static' || name === 'node_modules') return [];
  return statSync(path).isDirectory() ? files(path) : [path];
});

function resolveImport(from, spec, exts) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const one of [base, ...exts.map((ext) => base + ext)]) if (existsSync(one) && statSync(one).isFile()) return one;
  return null;
}

function scssResolve(from, spec) {
  const dir = dirname(from);
  const name = spec.split('/').pop();
  const head = spec.includes('/') ? spec.slice(0, spec.lastIndexOf('/') + 1) : '';
  for (const one of [`${head}${name}.scss`, `${head}_${name}.scss`, `${head}${name}`, `${head}_${name}`]) {
    const path = resolve(dir, one);
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

// Every sheet a unit's bundle carries: the CSS and SCSS its JS imports, and
// what those SCSS files use, followed from index.js.
function sheetsOf(folder) {
  const entry = join(smart, folder, 'index.js');
  const seen = new Set();
  const sheets = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    if (/\.(s?css)$/u.test(file)) {
      sheets.add(file);
      if (file.endsWith('.scss')) for (const [, spec] of text.matchAll(USE)) {
        const next = scssResolve(file, spec);
        if (next) walk(next);
      }
      return;
    }
    for (const [, spec] of text.matchAll(IMPORT)) {
      const next = resolveImport(file, spec, ['.js', '.mjs', '/index.js']);
      if (next && /\.(m?js|s?css)$/u.test(next)) walk(next);
    }
  };
  if (existsSync(entry)) walk(entry);
  return sheets;
}

const folders = readdirSync(smart).filter((name) => name !== 'helpers' && statSync(join(smart, name)).isDirectory());

test('Every Smart unit whose bundle carries a sheet asks the Loader for it (css: true)', () => {
  const dead = [];
  for (const folder of folders) {
    if (PATH_FORWARDS.has(folder)) continue;
    const sheets = sheetsOf(folder);
    if (sheets.size === 0) continue;
    const rule = existsSync(join(smart, folder, 'rule.js')) ? readFileSync(join(smart, folder, 'rule.js'), 'utf8') : '';
    if (!/^\s*css: true,/mu.test(rule)) {
      dead.push(`${folder}: ${[...sheets].map((one) => relative(repo, one)).join(', ')}`);
    }
  }
  assert.deepEqual(dead, [], 'sheets in a bundle whose rule has no css: true never reach a page; move the rules to the class sheet');
});

test('Every sheet under src/smart is in some bundle', () => {
  const carried = new Set(folders.flatMap((folder) => [...sheetsOf(folder)]));
  const orphans = files(smart).filter((one) => /\.(s?css)$/u.test(one) && !carried.has(one)).map((one) => relative(repo, one));
  assert.deepEqual(orphans, [], 'a sheet no bundle imports is dead source');
});

test('The path forwards stay forwards (no element, no rule of their own)', () => {
  for (const folder of PATH_FORWARDS) {
    assert.equal(existsSync(join(smart, folder, 'component.json')), false, `${folder} became a unit; drop it from PATH_FORWARDS`);
    assert.equal(existsSync(join(smart, folder, 'rule.js')), false, `${folder} has a rule of its own`);
  }
});
