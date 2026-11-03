import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import test from 'node:test';

// Dated tag aliases (rename plan R0, ui-control RENAME-PLAN-2026-11-03): a Smart
// component renamed to a new tag keeps the old one until its sweep day. The
// runtime half is core/js/tag-aliases.js (the Smart base defines the old tag as
// a subclass); the browser half, on a build, is tests/browser/tag-aliases.browser.mjs.
// Here: the helpers on fakes, and for every `tag` row of every component, a
// journal record, the policy's dates, a definition, the rule, the manifest,
// sheet coverage, and no source that still names the old tag as a tag.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));
const {readAliasTable, readTagAliases} = await import('../src/core/js/alias-table.js');
const {tagAliasRows, tableSource, TABLE} = await import('../scripts/tag-alias-table.mjs');
const {renameSheet, renameProse, renameScript, renameSelectorCalls, removeAfter} = await import('../scripts/rename-smart-tag.mjs');
const journal = readJson('contracts/changes/journal.json');
const policy = readJson('contracts/lifecycle-policy.json');
const forwards = readJson('src/core/contracts/smart-rule-forwards.v1.json').forwards;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const word = (tag) => new RegExp(`(?<![\\w.#$@%/-])${escape(tag)}(?![\\w-])`, 'gu');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'output'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(root, full));
  }
  return out;
}
const sources = walk(resolve(root, 'src'));

// Every `tag` row of every component, with its folder.
const components = readdirSync(resolve(root, 'src/smart'))
  .filter((name) => existsSync(resolve(root, `src/smart/${name}/component.json`)))
  .map((folder) => ({folder, component: readJson(`src/smart/${folder}/component.json`)}));
const rows = components.flatMap(({folder, component}) => (component.aliases?.rows ?? [])
  .filter((row) => row.kind === 'tag')
  .map((row) => ({...row, folder, component})));

// The alias machinery names an old tag on purpose: the runtime, the table, the
// forwarding folder of a moved path, the journal and this test's companions.
const machinery = (file, row) => [
  'src/core/js/tag-aliases.js', 'src/core/js/tag-aliases.generated.js', 'src/core/js/alias-table.js',
  `src/smart/${row.from.replace(/^sf-/u, '')}/index.js`,
].includes(file) || file.endsWith('/aliases.json') || file.endsWith('/component.json');

test('tag rows: the Smart base defines them, the element alias shim leaves them', () => {
  const table = {component: 'sf-new-name', aliases: [
    {from: 'sf-old-name', to: 'sf-new-name', kind: 'tag', since: '2026-11-03', remove_after: '2027-01-01'},
    {from: 'title', to: 'heading', kind: 'setting', since: '2026-11-03', remove_after: '2027-01-01'},
    {from: 'sf-other', to: 'sf-third', kind: 'tag', since: '2026-11-03', remove_after: '2027-01-01'},
    {from: 'Bad', to: 'sf-new-name', kind: 'tag', since: '2026-11-03', remove_after: '2027-01-01'},
    {from: 'sf-older', to: 'sf-new-name', kind: 'tag', since: '2026-11-03', remove_after: '2026-11-01'},
  ]};
  const element = readAliasTable(table, {tag: 'sf-new-name'});
  assert.deepEqual(element.rows.map((row) => row.kind), ['setting'], 'a tag row is not an element alias');
  assert.deepEqual(element.refused, [], 'and is not refused there either');
  const tags = readTagAliases(table);
  assert.deepEqual(tags.rows.map((row) => row.from), ['sf-old-name']);
  assert.deepEqual(tags.refused.map((row) => row.reason), ['not-this-tag', 'bad-old-tag', 'remove-after-before-since']);
});

test('tag helpers: both names, one selector, the definition and one note per page', async () => {
  const defined = new Map();
  const warnings = [];
  const saved = {customElements: globalThis.customElements, console: globalThis.console, document: globalThis.document};
  globalThis.customElements = {get: (name) => defined.get(name), define: (name, Class) => defined.set(name, Class)};
  globalThis.console = {...saved.console, warn: (text) => warnings.push(text)};
  globalThis.document = {documentElement: {dataset: {}}};
  try {
    const tags = await import('../src/core/js/tag-aliases.js');
    const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
    clearDeprecations();
    class Base { connectedCallback() { this.connected = (this.connected ?? 0) + 1; } }
    class Element extends Base {}
    Element.aliases = {component: 'sf-test-new', aliases: [{from: 'sf-test-old', to: 'sf-test-new', kind: 'tag', since: '2026-11-03', remove_after: '2099-01-01'}]};
    const queued = [];
    const rowsDefined = tags.defineTagAliases(Element, 'sf-test-new', {define: (name, Class) => { queued.push(name); defined.set(name, Class); }});
    assert.deepEqual(rowsDefined.map((row) => row.from), ['sf-test-old']);
    assert.deepEqual(queued, ['sf-test-old'], 'the old tag goes through the definition queue it is given');
    const Alias = defined.get('sf-test-old');
    assert.ok(Alias.prototype instanceof Element, 'a subclass of the new tag\'s class');
    assert.equal(Alias.sfTagAliasOf, 'sf-test-new');
    assert.deepEqual(tags.tagNames('sf-test-new'), ['sf-test-new', 'sf-test-old']);
    assert.equal(tags.tagSelector('sf-test-new'), ':is(sf-test-new, sf-test-old)');
    assert.equal(tags.tagSelector('sf-unrenamed'), 'sf-unrenamed');
    assert.equal(tags.canonicalTag('SF-TEST-OLD'), 'sf-test-new');
    assert.ok(tags.isTag({localName: 'sf-test-old'}, 'sf-test-new'));
    assert.ok(!tags.isTag({localName: 'sf-test-other'}, 'sf-test-new'));
    assert.deepEqual(tags.defineTagAliases(Element, 'sf-test-new', {define: () => assert.fail('defined twice')}), [], 'a defined old tag is left');
    const one = new Alias();
    const two = new Alias();
    one.connectedCallback();
    two.connectedCallback();
    assert.equal(one.connected, 1, 'the class\'s own connectedCallback runs');
    assert.equal(warnings.length, 1, `one console note per page: ${JSON.stringify(warnings)}`);
    assert.match(warnings[0], /<sf-test-old> is now <sf-test-new>; the old tag works until 2099-01-01/u);
    const note = listDeprecations().find((entry) => entry.kind === 'tag' && entry.from === 'sf-test-old');
    assert.equal(note?.to, 'sf-test-new');
    assert.equal(note?.count, 2, 'each element is counted in SF.deprecations');
    assert.equal(note?.remove_after, '2099-01-01');
    assert.equal(typeof globalThis.SF.tags.selector, 'function', 'SF.tags for scripts that are not bundles');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('the static tag table is what the aliases.json files say', () => {
  assert.equal(read(TABLE), tableSource(tagAliasRows()), 'run node scripts/tag-alias-table.mjs --write');
});

test('the rename script: markup, sheets and selectors move; classes, properties and other names stay', () => {
  assert.equal(renameProse('<sf-a x="1"></sf-a> `sf-a` class="sf-a sf-a--big" sf-a-icon --sf-a-color .sf-a', 'sf-a', 'sf-b-a'),
    '<sf-b-a x="1"></sf-b-a> `sf-b-a` class="sf-a sf-a--big" sf-a-icon --sf-a-color .sf-a');
  assert.equal(renameSheet('.x > sf-a > .sf-a, sf-a:hover { --sf-a-c: 1; } /* sf-a draws */ a::after { content: "sf-a"; }', 'sf-a', 'sf-b-a'),
    '.x > :is(sf-b-a, sf-a) > .sf-a, :is(sf-b-a, sf-a):hover { --sf-a-c: 1; } /* sf-b-a draws */ a::after { content: "sf-a"; }');
  assert.equal(renameScript("x.className = 'sf-a flex';\nhtml`<sf-a></sf-a>`;\nA.define('sf-a');\n// sf-a here", 'sf-a', 'sf-b-a', {comments: true}),
    "x.className = 'sf-a flex';\nhtml`<sf-b-a></sf-b-a>`;\nA.define('sf-b-a');\n// sf-b-a here");
  assert.equal(renameSelectorCalls("q.querySelector('#i button sf-a'); e.classList.contains('sf-a'); q.closest(\".sf-a\")", 'sf-a', 'sf-b-a'),
    "q.querySelector('#i button sf-b-a'); e.classList.contains('sf-a'); q.closest(\".sf-a\")");
  assert.equal(removeAfter('2026-11-03'), '2027-01-01');
});

for (const row of rows) {
  const {from, to, folder, component} = row;
  const where = `${from} -> ${to}`;

  test(`${where}: a dated row, a journal record and the policy's day`, () => {
    assert.equal(component.tag, to, `${where}: the row renames its own component`);
    assert.match(row.since, /^\d{4}-\d{2}-\d{2}$/u);
    assert.equal(row.remove_after, removeAfter(row.since, policy), `${where}: remove_after follows the policy`);
    const record = journal.records.find((entry) => entry.kind === 'tag' && entry.items.some((item) => item.from === from && item.to === to));
    assert.ok(record, `${where}: no kind "tag" record in contracts/changes/journal.json`);
    assert.equal(record.rewrite, 'rename-tag');
    assert.equal(record.deprecated_on, row.since, `${record.id}: deprecated_on is the row's since`);
    assert.equal(record.extended_to || record.remove_after, row.remove_after, `${record.id}: the same day as the row`);
    if (record.stage === 'compat') assert.ok(existsSync(resolve(root, `src/smart/${folder}/aliases.json`)));
    // The events whose name carried the tag keep their old names too.
    const aliases = readJson(`src/smart/${folder}/aliases.json`).aliases;
    const manifest = readJson(`src/smart/${folder}/smart.manifest.json`);
    for (const name of Object.keys(manifest.events ?? {}).filter((event) => event.startsWith(`${to}-`) && !manifest.events[event].alias_of)) {
      const old = `${from}-${name.slice(to.length + 1)}`;
      assert.ok(aliases.some((alias) => alias.kind === 'event' && alias.from === old && alias.to === name), `${where}: event ${name} has no alias ${old}`);
    }
  });

  test(`${where}: defined, loaded and declared under both names`, () => {
    const index = read(`src/smart/${folder}/index.js`);
    assert.match(index, new RegExp(`\\.define\\(\\s*['"]${escape(to)}['"]\\s*\\)`, 'u'), `${where}: index.js defines the new tag`);
    assert.match(read('src/core/js/smart-base.js'), /defineTagAliases\(this, resolvedTagName, \{ define: queueDefinition \}\)/u, 'the Smart base defines the old tags with the new one');
    const tags = {};
    new Function('SF', read(`src/smart/${folder}/rule.js`))({RuleLoader: tags});
    const rule = Object.values(tags)[0];
    assert.equal(rule.tags[0], to, 'the rule names the new tag first');
    assert.ok(rule.tags.includes(from), `${where}: the rule maps the old tag to the same bundle`);
    const aliases = readJson(`src/smart/${folder}/aliases.json`);
    assert.ok(readTagAliases(aliases).rows.some((alias) => alias.from === from), `${where}: aliases.json carries the row`);
    const manifest = readJson(`src/smart/${folder}/smart.manifest.json`);
    assert.equal(manifest.custom_element, to);
    assert.ok(manifest.compatibility.aliases.includes(`<${from}>`), `${where}: the manifest lists the old tag`);
    assert.ok(manifest.compatibility.deprecations.some((entry) => entry.path === `<${from}>` && entry.replacement === `<${to}>`));
    assert.ok(read(TABLE).includes(`from: '${from}', to: '${to}'`), `${where}: the static table carries it`);
    // A folder that moved keeps its old path as a forward.
    const oldFolder = from.replace(/^sf-/u, '');
    if (oldFolder !== folder && existsSync(resolve(root, `src/smart/${oldFolder}/index.js`))) {
      assert.equal(forwards[`cl-${oldFolder}`]?.to, `cl-${folder}`, `${where}: cl-${oldFolder} forwards to cl-${folder}`);
      assert.ok(journal.records.some((entry) => entry.id === forwards[`cl-${oldFolder}`].journal), `${where}: the forward has its record`);
    }
  });

  test(`${where}: every sheet selector naming the tag names the old one beside it`, () => {
    const group = `:is(${to}, ${from})`;
    const bare = [];
    for (const file of sources.filter((name) => /\.s?css$/u.test(name))) {
      const text = read(file);
      if (!text.includes(to) && !text.includes(from)) continue;
      // Comments and strings are not selectors.
      const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/gu, (match) => match.replace(/[^\n]/gu, ' '));
      const masked = code.split(group).join(' '.repeat(group.length));
      for (const tag of [to, from]) {
        for (const match of masked.matchAll(word(tag))) bare.push(`${file}:${lineOf(text, match.index)} ${tag}`);
      }
    }
    assert.deepEqual(bare, [], `write ${group} (scripts/rename-smart-tag.mjs does)`);
  });

  test(`${where}: no source names the old tag as a tag`, () => {
    const found = [];
    const markup = new RegExp(`</?${escape(from)}(?![\\w-])`, 'gu');
    const definition = new RegExp(`\\.define\\(\\s*['"\`]${escape(from)}['"\`]`, 'gu');
    const call = /(?:querySelector(?:All)?|closest|matches|createElement)\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/gu;
    const comparison = new RegExp(`(?:localName|tagName)[^;\\n]{0,40}(?:===|!==|==|!=)\\s*['"\`]${escape(from)}['"\`]`, 'giu');
    for (const file of [...sources, ...walk(resolve(root, 'tests'))]) {
      if (machinery(file, row) || /tag-aliases\.(?:contract|browser)/u.test(file)) continue;
      if (!/\.(?:m?js|cjs|html|md|json)$/u.test(file)) continue;
      const text = read(file);
      if (!text.includes(from)) continue;
      for (const pattern of [markup, definition, comparison]) {
        for (const match of text.matchAll(pattern)) found.push(`${file}:${lineOf(text, match.index)} ${match[0]}`);
      }
      for (const match of text.matchAll(call)) {
        if (word(from).test(match[2])) found.push(`${file}:${lineOf(text, match.index)} ${match[0]}`);
      }
    }
    assert.deepEqual(found, [], `name ${to}; a lookup that must find old markup asks tagSelector('${to}') / isTag()`);
  });

  test(`${where}: the Framework's code finds the element through the helper`, () => {
    const found = [];
    const call = /(?:querySelector(?:All)?|closest|matches)\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/gu;
    const comparison = new RegExp(`(?:localName|tagName)[^;\\n]{0,40}(?:===|!==|==|!=)\\s*['"\`]${escape(to)}['"\`]`, 'giu');
    for (const file of sources.filter((name) => /\.m?js$/u.test(name) && !machinery(name, row))) {
      const text = read(file);
      if (!text.includes(to)) continue;
      for (const match of text.matchAll(comparison)) found.push(`${file}:${lineOf(text, match.index)} ${match[0]}`);
      for (const match of text.matchAll(call)) {
        if (word(to).test(match[2])) found.push(`${file}:${lineOf(text, match.index)} ${match[0]}`);
      }
    }
    assert.deepEqual(found, [], `while ${from} lives, ask tagSelector('${to}') or isTag(element, '${to}') from the Smart base`);
  });
}

test('SF.tags is documented, and the Smart base hands the helpers to every bundle', () => {
  const api = readJson('src/core/contracts/public-js-api.json');
  assert.ok(api.globals.some((entry) => entry.name === 'SF.tags' && entry.status === 'public'));
  const runtime = readJson('src/core/contracts/shared-runtime.v1.json');
  for (const name of ['tagNames', 'tagSelector', 'isTag', 'canonicalTag']) assert.ok(runtime.modules['smart-base'].exports.includes(name), name);
  const schema = readJson('contracts/schema/change-journal.v1.schema.json').$defs.record.properties;
  assert.ok(schema.kind.enum.includes('tag') && schema.rewrite.enum.includes('rename-tag'));
});
