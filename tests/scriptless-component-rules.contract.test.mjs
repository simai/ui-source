import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// A component rule with `js: true` makes the Loader fetch the component's
// script whenever its class appears on the page after the first paint, or the
// component is asked for by name (SF.Loader.ensurePlugin, SF.createAsync of a
// Smart tag that relates to it). A script that only imports its own comment
// file builds to a wrapper that does nothing, and to a minified twin of 0 bytes.
// Fetching it costs a request for nothing, and where a host drops the empty
// twin (the Docara projection on ui.simai.io, 2026-11-11) a 404 and a second
// request for the readable file. Such a component says `js: false`, as
// avatars, card and fourteen others already do.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const components = join(root, 'src/component');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

// The code a component's script entry (its index.js) runs: its own statements, plus whatever
// the relative modules it imports run. Bare `import './x'` lines, imported sheets and an
// empty `export {};` are not code.
function scriptCode(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return '';
  seen.add(file);
  let code = stripComments(readFileSync(file, 'utf8'));
  let imported = '';
  code = code.replace(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"];?\s*$/gm, (line, spec) => {
    const base = resolve(dirname(file), spec);
    const target = [base, `${base}.js`, join(base, 'index.js')].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (target && /\.js$/.test(target)) imported += scriptCode(target, seen);
    return '';
  });
  code = code.replace(/^\s*export\s*\{\s*\}\s*;?\s*$/gm, '');
  return code.trim() + imported;
}

const rules = readdirSync(components, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && existsSync(join(components, entry.name, 'rule.js')))
  .map((entry) => ({
    name: entry.name,
    rule: readFileSync(join(components, entry.name, 'rule.js'), 'utf8'),
    entry: join(components, entry.name, 'index.js'),
  }));

test('the component rules are read', () => {
  assert.ok(rules.length > 40, `only ${rules.length} component rules found`);
});

test('a component rule asks for a script only when the script does something', () => {
  const scriptless = rules
    .filter(({rule}) => /\bjs:\s*true\b/.test(rule))
    .filter(({entry}) => scriptCode(entry) === '')
    .map(({name}) => name);
  assert.deepEqual(scriptless, [], `js: true, but the script does nothing: ${scriptless.join(', ')}`);
});

test('pagination, step and tags fetch their sheet alone', () => {
  for (const name of ['pagination', 'step', 'tags']) {
    const {rule} = rules.find((entry) => entry.name === name);
    assert.match(rule, /\bcss:\s*true\b/, name);
    assert.match(rule, /\bjs:\s*false\b/, name);
  }
});
