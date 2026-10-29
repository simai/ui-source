// The shared Smart runtime (core/js/runtime.js, core/js/smart-base.js beside
// core.js): its contract is current, its modules hold no live bindings, Core
// publishes the modules it runs for the runtime to take, and a bundle's ABI is
// checked when it asks for a module.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildContract, exportsOf, COMPONENT_MANIFEST_DROP, COMPONENT_MANIFEST_KEYS} from '../scripts/shared-runtime-contract.mjs';
import {readdirSync, existsSync} from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('src/core/contracts/shared-runtime.v1.json'));

test('the shared runtime contract is current (node scripts/shared-runtime-contract.mjs --write)', () => {
  assert.deepEqual(contract, buildContract());
});

test('no shared runtime module exports a live binding (export let / var / *)', () => {
  // The runtime hands a bundle a frozen copy of each module's namespace
  // (asModule): a `let` the module reassigns later would stay at its first
  // value in every bundle.
  for (const [id, module] of Object.entries(contract.modules)) {
    if (!module.exports) continue;
    const text = read(`src/${module.source}`);
    assert.doesNotMatch(text, /^export\s+(let|var)\b/mu, `${id} (${module.source}) exports a let/var`);
    assert.doesNotMatch(text, /^export\s+\*/mu, `${id} (${module.source}) re-exports *`);
    assert.doesNotThrow(() => exportsOf(text, module.source));
  }
  assert.throws(() => exportsOf('export let late = 1;\n'), /live binding/u);
  assert.throws(() => exportsOf("export * from './x.js';\n"), /export \*/u);
});

test('the element layer is shared, not carried by every Smart bundle', () => {
  for (const id of ['element-manifest', 'aliases', 'alias-table', 'host-port', 'deprecations', 'page-actions', 'layer-stack', 'open-surface-mark', 'instance-path', 'smart-base', 'page-language', 'position', 'lit']) {
    assert.ok(contract.modules[id], `the runtime hands out ${id}`);
  }
});

test('Core publishes the modules it runs; the runtime hands those out and still stands alone', () => {
  assert.deepEqual(contract.core_hosted, ['alias-table', 'aliases', 'deprecations', 'layer-stack', 'page-language', 'position']);
  assert.match(read('src/core/js/index.js'), /^import '\.\/core-modules\.js';$/mu);
  const runtime = read('src/core/js/runtime.js');
  assert.match(runtime, /globalThis\.SF\?\.__internal\?\.coreModules\?\.\[id\] \?\? RUNTIME_MODULES\[id\]/u, 'Core\'s instance first, the runtime\'s own copy without Core');
  assert.match(runtime, /get: \(\) => sharedModule\(id\)/u, 'read when a bundle asks, not when the runtime ran');
  const entry = read('src/core/smart-base.js');
  assert.match(entry, /SHARED_MODULES as RUNTIME_MODULES/u);
  // A page, a test or a probe includes smart-base.js alone (no Core, or a Core
  // that failed): the runtime must not wait for Core.
  assert.doesNotMatch(entry, /coreModule\(|core-module-wait/u);
});

test('a bundle built for another runtime ABI is refused, loudly', () => {
  assert.equal(contract.abi, Number(read('src/core/js/runtime.js').match(/RUNTIME_ABI = (\d+)/u)[1]));
  const index = read('src/core/js/index.js');
  assert.match(index, /SF\.runtimeModule = \(id, abi\) =>/u);
  assert.match(index, /abi !== have/u);
  assert.match(index, /console\.error\(error\)/u);
  const entry = read('src/core/smart-base.js');
  assert.match(entry, /SF\.__internal\.runtimeAbi = RUNTIME_ABI;/u);
  assert.match(entry, /checkRuntimeAbi\(id, abi, RUNTIME_ABI\)/u);
});

test('Core preloads the runtime for a page with a Smart part, and loads it once even when the page includes it by hand', () => {
  const index = read('src/core/js/index.js');
  assert.match(index, /if \(runtimeScript\(\)\) return;/u);
  assert.match(index, /link\.rel = 'preload';\n\s+link\.as = 'script';/u, 'a page with a Smart part preloads the runtime with Core');
  assert.doesNotMatch(index, /smartPartWaiting\(\)\) SF\.loadRuntime\(\)/u, 'preloaded, not run early: the first paint must be seen');
});

test('a Smart bundle embeds every key of its component.json the runtime reads', () => {
  // What the code takes off a component manifest, read where it is taken:
  // `manifest.<key>`, `manifest['<key>']`, `manifest?.<key>` in the runtime and
  // the elements, `source.<key>` in the assembly's interface of a part.
  const files = ['src/core/js/element-manifest.js', 'src/core/js/host-port.js', 'src/core/js/composition/manifest-host.mjs', 'scripts/first-paint-page.js'];
  for (const folder of readdirSync(new URL('../src/smart/', import.meta.url))) {
    for (const file of [`src/smart/${folder}/index.js`]) if (existsSync(new URL(`../${file}`, import.meta.url))) files.push(file);
  }
  const read_ = new Set();
  const take = (text, name) => {
    for (const m of text.matchAll(new RegExp(`\\b${name}\\??\\.([A-Za-z_$][\\w$]*)`, 'gu'))) read_.add(m[1]);
    for (const m of text.matchAll(new RegExp(`\\b${name}\\??\\.?\\[['"]([^'"]+)['"]\\]`, 'gu'))) read_.add(m[1]);
  };
  for (const file of files) take(read(file).replace(/^\s*\/\/.*$/gmu, ''), 'manifest');
  const definition = read('src/core/js/assembly/definition.mjs');
  const normalise = definition.slice(definition.indexOf('export function normaliseInterface'), definition.indexOf('export const interfaces'));
  take(normalise, 'source');
  for (const part of definition.match(/const PARTS = \[([^\]]*)\]/u)[1].matchAll(/'([^']+)'/gu)) read_.add(part[1]);
  const keys = new Set();
  for (const folder of readdirSync(new URL('../src/smart/', import.meta.url))) {
    const file = `src/smart/${folder}/component.json`;
    if (existsSync(new URL(`../${file}`, import.meta.url))) for (const key of Object.keys(JSON.parse(read(file)))) keys.add(key);
  }
  // Only the names that are keys of some component.json are a manifest's reads
  // (manifest.js, a file name in a comment, is not).
  const missing = [...read_].filter((key) => keys.has(key) && !COMPONENT_MANIFEST_KEYS.includes(key));
  assert.deepEqual(missing, [], 'add them to COMPONENT_MANIFEST_KEYS (scripts/shared-runtime-contract.mjs) and rewrite the contract');
  assert.deepEqual(contract.component_manifest_keys, [...COMPONENT_MANIFEST_KEYS]);
  for (const kept of ['$comment', 'x-registry', 'x-rule', 'x-decisions', 'relations', 'aliases', 'examples']) {
    assert.ok(!COMPONENT_MANIFEST_KEYS.includes(kept), `${kept} is the build's and the docs', not the runtime's`);
  }
});

// The runtime code a Smart bundle runs, and what reads the manifest it embeds:
// Core's modules, the runtime entry, every file of every Smart element (not
// its generated meta.mjs, which is data) and the first-paint tools.
const runtimeFiles = () => {
  const files = ['src/core/smart-base.js', 'scripts/first-paint-page.js'];
  const walk = (folder) => {
    for (const entry of readdirSync(new URL(`../${folder}/`, import.meta.url), {withFileTypes: true})) {
      const file = `${folder}/${entry.name}`;
      if (entry.isDirectory()) { if (!['tests', 'test', 'node_modules', 'docs', 'static'].includes(entry.name)) walk(file); }
      else if (/\.(m?js)$/u.test(entry.name) && entry.name !== 'meta.mjs' && !/\.test\./u.test(entry.name)) files.push(file);
    }
  };
  walk('src/core/js');
  walk('src/smart');
  return files;
};

// Reads of a dropped key that are not reads of a component manifest, each
// with what it reads instead. A new one is a question for the contract.
const NOT_A_MANIFEST = [
  // An element's own setting `description` (sf-avatar), through itself or its template's context.
  {file: 'src/smart/avatar/index.js', read: 'this.description'},
  {file: 'src/smart/avatar/js/templates/label.js', read: 'context.description'},
  {file: 'src/smart/avatar/js/templates/card.js', read: 'context.description'},
  // A fragment descriptor's ports (simai.composition fragments), not a component.json.
  {file: 'src/core/js/composition/fragments.mjs', read: 'port.summary'},
  // A component's smart.manifest.json with `composition.declarative` (the
  // composition type of a Smart component): a source file the build reads,
  // never the embedded manifest, which keeps no `composition`.
  {file: 'src/core/js/composition/index.mjs', read: 'name].summary'},
];

/** The dropped keys a text reads: `x.<key>`, `x?.<key>`, `x['<key>']`, `x?.['<key>']`. */
export function droppedReads(text, drop = COMPONENT_MANIFEST_DROP) {
  const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*(\/\/|\*).*$/gmu, '');
  const found = [];
  const names = drop.map((key) => key.replace(/\$/gu, '\\$'));
  const dotted = drop.filter((key) => /^[A-Za-z_$][\w$]*$/u.test(key)).map((key) => key.replace(/\$/gu, '\\$'));
  if (dotted.length) {
    for (const m of code.matchAll(new RegExp(`([\\w$\\]\\)]+)\\??\\.(${dotted.join('|')})\\b(?![\\w$-])`, 'gu'))) found.push(`${m[1]}.${m[2]}`);
  }
  for (const m of code.matchAll(new RegExp(`([\\w$\\]\\)]+)\\??\\.?\\[\\s*['"](${names.join('|')})['"]\\s*\\]`, 'gu'))) found.push(`${m[1]}.${m[2]}`);
  return found;
}

test('no runtime code reads a key a Smart bundle drops from its component.json', () => {
  const reads = [];
  for (const file of runtimeFiles()) {
    for (const read_ of droppedReads(read(file))) {
      if (NOT_A_MANIFEST.some((known) => known.file === file && known.read === read_)) continue;
      reads.push(`${file}: ${read_}`);
    }
  }
  assert.deepEqual(reads, [], 'the runtime reads a dropped key: take it off COMPONENT_MANIFEST_DROP (scripts/shared-runtime-contract.mjs) and rewrite the contract');
  // The scan is not empty: it sees every form of a read.
  assert.deepEqual(droppedReads("a.summary; b?.summary; c['x-outcomes']; d?.['$comment']; e.summaryText; f['x-outcomes-old'];\n  // g.summary\n/* h.summary */\n"),
    ['a.summary', 'b.summary', 'c.x-outcomes', 'd.$comment']);
  assert.ok(runtimeFiles().includes('src/core/js/element-manifest.js') && runtimeFiles().includes('src/core/js/assembly/link.mjs') && runtimeFiles().includes('src/smart/pagination/index.js'));
});

test('a component.json never names a member with a key a Smart bundle drops', () => {
  assert.deepEqual(contract.component_manifest_drop, [...COMPONENT_MANIFEST_DROP]);
  for (const kept of ['type', 'values', 'default', 'default-from', 'optional', 'carries', 'x-native', 'shared', 'cancelable', 'dom', 'aliases', 'with', 'emits', 'of', 'timeout', 'retry', 'waits', 'concurrency', 'late', 'skeleton', 'value', 'submits', 'disabled']) {
    assert.ok(!COMPONENT_MANIFEST_DROP.includes(kept), `${kept} is read by the runtime`);
  }
  // A map of typed members (carries, with, of, x-detail: every entry a type
  // word or a declaration with a type) holds names; a dropped key there would
  // drop a member the runtime checks a payload against.
  const manifests = [];
  for (const folder of readdirSync(new URL('../src/smart/', import.meta.url))) {
    const file = `src/smart/${folder}/component.json`;
    if (existsSync(new URL(`../${file}`, import.meta.url))) manifests.push([file, JSON.parse(read(file))]);
  }
  const types = new Set(['native']);
  const collect = (node) => {
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') types.add(node.type);
    Object.values(node).forEach(collect);
  };
  manifests.forEach(([, manifest]) => collect(manifest));
  const typed = (value) => (typeof value === 'string' && types.has(value)) || (value && typeof value === 'object' && !Array.isArray(value) && typeof value.type === 'string');
  const named = [];
  const walk = (node, where, depth) => {
    if (Array.isArray(node)) { node.forEach((one, index) => walk(one, `${where}[${index}]`, depth + 1)); return; }
    if (!node || typeof node !== 'object') return;
    const entries = Object.entries(node);
    const membersMap = depth >= 1 && entries.length && entries.every(([, value]) => typed(value));
    for (const [key, value] of entries) {
      if (membersMap && COMPONENT_MANIFEST_DROP.includes(key)) named.push(`${where}.${key}`);
      walk(value, `${where}.${key}`, depth + 1);
    }
  };
  for (const [file, manifest] of manifests) for (const key of COMPONENT_MANIFEST_KEYS) if (key in manifest) walk(manifest[key], `${file} ${key}`, 0);
  assert.deepEqual(named, [], 'a member is named like a dropped key: rename it or take the key off COMPONENT_MANIFEST_DROP');
  assert.ok(types.has('number') && types.has('enum'), 'the type words are read');
});
