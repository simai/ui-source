import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const contract = JSON.parse(read('contracts/template-context.json'));

const block = (source, open) => {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}' && --depth === 0) return source.slice(open + 1, index);
  }
  return '';
};
const declaredProps = (source) => {
  const match = source.match(/static get props\(\)\s*\{\s*return\s*\{|static props\s*=\s*\{/u);
  if (!match) return [];
  const body = block(source, match.index + match[0].length - 1);
  const keys = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    if (depth === 0) {
      const key = line.match(/^\s*["']?([A-Za-z_$][\w$]*)["']?\s*:/u);
      if (key) keys.push(key[1]);
    }
    depth += (line.match(/[{[(]/gu) || []).length - (line.match(/[}\])]/gu) || []).length;
  }
  return keys;
};
// A component may take its accessors from a mixin it imports (the inherited
// value seam in src/smart/helpers/inherited-value.js gives inputs, textarea,
// dropdown and switch their inheritedValue getter): a getter defined there is
// defined on the component, so the mixins it imports are read alongside it.
const importedHelpers = (path, source) => [...source.matchAll(/from\s+["'](\.\.\/helpers\/[^"']+?)(?:\.js)?["']/gu)]
  .map(([, spec]) => resolve(root, path, '..', `${spec}.js`))
  .filter((file) => existsSync(file))
  .map((file) => readFileSync(file, 'utf8'));
// A component made from its component.json (core element-manifest.js) has an
// accessor for every setting and value the manifest declares (standard 1.3.8 §4).
const manifestMembers = (name, source) => {
  const file = resolve(root, 'src/smart', name, 'component.json');
  if (!/elementFromManifest\(manifest/u.test(source) || !existsSync(file)) return new Set();
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  return new Set([...Object.keys(manifest.settings || {}), ...Object.keys(manifest.values || {})]
    .map((member) => member.replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase())));
};
const escape = (name) => name.replace(/\$/gu, '\\$');
const defines = (source, key) =>
  new RegExp(`^\\s+(?:static\\s+)?(?:async\\s+)?(?:get\\s+|set\\s+)?${escape(key)}\\s*\\([^)]*\\)\\s*\\{`, 'mu').test(source)
  || new RegExp(`^\\s+${escape(key)}\\s*=`, 'mu').test(source)
  || new RegExp(`\\bthis\\.${escape(key)}\\s*=(?!=)`, 'u').test(source);

/* A declared prop is not an accessor: static props makes the base read the
   attribute through getProp(), and nothing is put on the instance. A component
   that reads this.<prop> where it defines no getter gets undefined whatever
   the attribute says. Found by this rule on its first run: sf-table read
   this.contextMenuColumns, so context-menu-columns did nothing; and a record
   picker shipped once with both port intents naming a null record. Known
   defects are exempt in contracts/template-context.json with their owner. */
test('a component reads a declared prop through a getter or getProp, never off this bare', () => {
  const base = read('src/core/js/smart-base.js');
  const allowed = new Set((contract.undefined_reads || []).map(({component, prop}) => `${component}.${prop}`));
  const offenders = [];
  const used = new Set();
  let checked = 0;
  for (const name of readdirSync(resolve(root, 'src/smart'))) {
    const path = `src/smart/${name}/index.js`;
    if (!existsSync(resolve(root, path))) continue;
    const source = read(path);
    const mixins = importedHelpers(path, source);
    const generated = manifestMembers(name, source);
    for (const key of declaredProps(source)) {
      if (generated.has(key) || defines(source, key) || defines(base, key) || mixins.some((mixin) => defines(mixin, key))) continue;
      checked += 1;
      const bare = new RegExp(`\\bthis\\??\\.${escape(key)}\\b(?!\\s*=(?!=))`, 'u').test(source)
        || new RegExp(`\\{[^}]*\\b${escape(key)}\\b[^}]*\\}\\s*=\\s*this\\b`, 'u').test(source);
      if (bare && allowed.has(`${name}.${key}`)) used.add(`${name}.${key}`);
      else if (bare) offenders.push(`${path}: this.${key}`);
    }
  }
  assert.ok(checked > 100, `only ${checked} props without a getter were checked; the parser is not finding them`);
  for (const id of allowed) assert.ok(used.has(id), `${id}: exempt but no longer read bare; remove the exemption`);
  assert.deepEqual(offenders, [], 'read it with this.getProp(key), or define a getter');
});
