import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';

/* A loader rule may declare relations: groups to load along with it. A relation
   that names a group which no longer exists does not fail anywhere at build
   time. It fails in the reader's browser: the loader asks for a stylesheet that
   is not there, the request comes back 404 and the console prints a warning on
   every page that uses the class. gradient-type pointed at gradient-color-ext
   for two and a half years after that group was deleted. */
const SRC = new URL('../src/', import.meta.url);

async function rules(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) out.push(...await rules(next, base));
    else if (entry.name === 'rule.js') out.push(next);
  }
  return out;
}

test('loader: every related group a rule names exists as a rule', async () => {
  const files = await rules(SRC);
  const declared = new Set();
  const sources = [];
  for (const url of files) {
    const source = await readFile(url, 'utf8');
    sources.push([url, source]);
    // Две записи: SF.RuleLoader['name'] и SF.RuleLoader.name.
    for (const match of source.matchAll(/SF\.RuleLoader(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z_$][\w$]*))\s*=/g)) declared.add(match[1] || match[2]);
  }
  const dangling = [];
  for (const [url, source] of sources) {
    for (const block of source.matchAll(/relation:\s*\[([^\]]*)\]/g)) {
      for (const name of block[1].matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
        if (!declared.has(name[1])) dangling.push(`${url.pathname.slice(url.pathname.indexOf('/src/') + 5)} -> ${name[1]}`);
      }
    }
  }
  assert.ok(declared.size > 100, `правил найдено подозрительно мало: ${declared.size}`);
  assert.deepEqual(dangling, []);
});
