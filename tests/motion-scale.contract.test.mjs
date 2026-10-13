import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) out.push(...await walk(next));
    else out.push(next);
  }
  return out;
}
const files = (await walk(SRC)).filter((u) => u.pathname.endsWith('.scss'));
const name = (u) => u.pathname.slice(u.pathname.indexOf('/src/') + 5);

/* A scale that the most-used utility ignores is decoration. The transition
   utility sits on almost every control in this library, so it is the one place
   where an off-scale duration spreads everywhere at once. */
test('motion: the transition utility takes its duration and curve from the scale', async () => {
  const wrong = [];
  let checked = 0;
  for (const url of files.filter((u) => u.pathname.includes('/utility/transition-property/'))) {
    const source = await readFile(url, 'utf8');
    if (!/transition-duration:/.test(source)) continue; // index и файлы значений ничего не объявляют
    checked += 1;
    if (!/transition-duration:\s*var\(--sf-duration-/.test(source)) wrong.push(`${name(url)}: длительность не из шкалы`);
    if (!/transition-timing-function:\s*var\(--sf-ease-/.test(source)) wrong.push(`${name(url)}: кривая не из набора`);
  }
  assert.ok(wrong.length === 0, wrong.join('\n'));
  assert.equal(checked, 6, 'утилита объявляется на шести брейкпойнтах');
});

/* Everything else that moves says how long in a token too. Zero is exempt:
   that is how motion is switched off, not a duration. The two exceptions are
   named, so adding a third has to be a decision rather than a slip. */
const EXEMPT = new Set([
  'core/scss/_sf_css__loader.scss',              // бесконечный отскок 2.2s, шкала так далеко не идёт
  'smart/toggle/scss/styles_default.scss',       // компонент уезжает в мажорной версии
]);
test('motion: no new literal duration appears outside the named exceptions', async () => {
  const found = [];
  for (const url of files) {
    if (EXEMPT.has(name(url))) continue;
    const source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:transition|animation)(?:-duration)?:\s*([^;]+);/g)) {
      const value = match[1];
      if (/var\(--sf-/.test(value)) continue;
      const literal = value.match(/\b\d*\.?\d+m?s\b/);
      if (literal && !/^0m?s$/.test(literal[0])) found.push(`${name(url)}: ${literal[0]}`);
    }
  }
  assert.deepEqual(found, []);
});
