import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {DESKTOP} from '../scripts/generate-density.mjs';

// Every width has exactly one defined ladder (docs precheck S-03, 2026-11-10;
// owner decisions C01, C22, C36): the phone ladder below the desktop
// breakpoint, the desktop ladder -- normal or compact -- at and above it. The
// ladder files, the density projection and every core rule that follows the
// ladder switch at the one breakpoint of the adaptive-sizing contract, written
// as min-width: <bp> or its exact complement width < <bp>. A max-width a
// fraction below the breakpoint (59.98rem, 59.99rem) leaves a band of
// fractional widths -- browser zoom, a fractional device ratio -- where
// neither side holds.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'src/core/contracts/adaptive-sizing.v1.json'), 'utf8'));
const BREAKPOINT = `${contract.modes.desktop.minWidthPx / contract.meta.nominalRootPx}rem`;

const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? files(path) : /\.(s?css)$/u.test(name) ? [path] : [];
});

test('the density switches at the ladder breakpoint of the contract', () => {
  assert.equal(DESKTOP, BREAKPOINT);
  assert.equal(BREAKPOINT, '60rem');
  const density = readFileSync(join(root, 'src/core/scss/_sf_css__density.scss'), 'utf8');
  assert.deepEqual([...density.matchAll(/@media ([^{]+)\{/gu)].map(([, query]) => query.trim()), [`(min-width: ${BREAKPOINT})`]);
});

test('every width query of the core ladder is the breakpoint or its exact complement', () => {
  const allowed = new Set([`(min-width: ${BREAKPOINT})`, `(width < ${BREAKPOINT})`]);
  const offenders = [];
  for (const file of [...files('src/core/figma_variables'), ...files('src/core/scss')]) {
    const source = readFileSync(join(root, file), 'utf8').replace(/\/\/.*$/gmu, '');
    for (const [, query] of source.matchAll(/@media ([^{]+)\{/gu)) {
      // Width conditions written with a literal length: the breakpoint mixins
      // (map.get of the breakpoint array) are the utilities' own ladder.
      for (const condition of query.match(/\((?:min-|max-)?width[^)]*\)/gu) ?? []) {
        if (/map\.get|\$/u.test(condition)) continue;
        if (!allowed.has(condition)) offenders.push(`${relative(root, join(root, file))}: ${condition}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('no width query anywhere stops a fraction short of the breakpoint', () => {
  const offenders = [];
  for (const file of [...files('src/core'), ...files('src/component'), ...files('src/smart')]) {
    const source = readFileSync(join(root, file), 'utf8');
    if (/max-width:\s*59\.9\d*rem/u.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
