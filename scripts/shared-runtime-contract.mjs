#!/usr/bin/env node
// The shared Smart runtime's contract: core/contracts/shared-runtime.v1.json.
//
//   node scripts/shared-runtime-contract.mjs --write   rewrite it from the sources
//   node scripts/shared-runtime-contract.mjs --check   fail when it is not current
//
// It lists what a Smart or package bundle built against this source may ask
// the page's runtime for (SF.runtimeModule): the runtime's ABI
// (core/js/runtime.js RUNTIME_ABI), every module id with its source and, for a
// Core module, the names it exports; and the modules Core itself publishes for
// the runtime to take (core/js/core-modules.js). ui-builder reads it to build
// the bundles (the ABI they ask with) and to write a package receipt; a
// package receipt is checked against the release's copy of it.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The top-level keys of a Smart component.json the runtime reads off the
// element's manifest: elementFromManifest and readManifest (core/js/
// element-manifest.js), an assembly's interface of a part (core/js/assembly/
// definition.mjs normaliseInterface, through the class's sfInterface), the
// host port (core/js/host-port.js), the first-paint tools
// (scripts/first-paint-page.js) and the elements' own code (drawer and modal
// read css-variables). A Smart bundle embeds these and nothing else of its
// component.json (ui-builder libs/componentManifestEmbed.js); x-registry,
// x-rule, x-decisions, relations, aliases, examples and the docs' words stay
// in the source. tests/shared-runtime.contract.test.mjs reads the code for
// every key it takes off a manifest and fails on one that is not here.
export const COMPONENT_MANIFEST_KEYS = Object.freeze([
  'id', 'tag', 'version', 'kind',
  'settings', 'values', 'events', 'actions', 'form', 'presentation', 'host-states',
  'port', 'layer', 'implements', 'traits', 'words',
  'css-variables',
]);

// What a bundle drops inside those keys (standard 1.4 moved the docs' words
// into component.json): a key named here, at least two levels under a kept
// key -- inside a named entry (settings.<name>.summary,
// events.<verb>.carries.<field>.summary, actions.<name>.x-returns), never a
// name itself (settings.description, a setting, stays) -- is dropped with
// all it holds. The runtime reads none of them: under the kept keys it reads
// type, values, default, default-from, optional, carries and the names it
// holds, x-native, cancelable, dom, aliases, with and its names, emits,
// timeout, retry, waits, concurrency, of and its names, form.value/submits/
// disabled, host-states, presentation.skeleton.late and the names of
// css-variables (element-manifest.js, host-port.js, the
// assembly's link, definition and core, first-paint-page.js, the elements'
// index.js). tests/shared-runtime.contract.test.mjs fails on code that reads
// one of these keys and on a component.json that uses one as a member's name.
export const COMPONENT_MANIFEST_DROP = Object.freeze([
  '$comment', 'description', 'examples', 'summary',
  'x-detail', 'x-markup', 'x-note', 'x-outcomes', 'x-returns', 'x-shape', 'x-summary',
]);
const CONTRACT = 'src/core/contracts/shared-runtime.v1.json';
const read = (file) => readFileSync(path.join(root, file), 'utf8');

// The names a module exports, read off its text. The runtime's modules use
// plain declarations; a form this does not read (export *, export let/var: a
// live binding the runtime's namespace copy would freeze) is an error.
export function exportsOf(text, where = 'module') {
  const names = new Set();
  const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
  for (const match of code.matchAll(/^export\s+(.*)$/gmu)) {
    const line = match[1];
    let m;
    if ((m = line.match(/^(?:async\s+)?function\*?\s+([\w$]+)/u)) || (m = line.match(/^class\s+([\w$]+)/u)) || (m = line.match(/^const\s+([\w$]+)/u))) names.add(m[1]);
    else if (/^default\b/u.test(line)) names.add('default');
    else if (/^(let|var)\b/u.test(line)) throw new Error(`${where}: "export ${line.split(/\s+/u).slice(0, 2).join(' ')}" is a live binding; a shared runtime module exports const, function or class`);
    else if (/^\*/u.test(line)) throw new Error(`${where}: "export *" cannot be listed; name the exports`);
    else if (line.startsWith('{')) {
      const close = code.indexOf('}', match.index);
      const list = code.slice(code.indexOf('{', match.index) + 1, close);
      for (const part of list.split(',').map((one) => one.trim()).filter(Boolean)) names.add(part.split(/\s+as\s+/u).pop().trim());
    } else throw new Error(`${where}: cannot read "export ${line.slice(0, 40)}"`);
  }
  return [...names].sort();
}

const resolveSource = (from, request) => {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), request)).replace(/\.m?js$/u, '');
  for (const file of [`${base}.js`, `${base}.mjs`]) {
    try { read(file); return file; } catch {}
  }
  throw new Error(`${from}: cannot find ${request}`);
};

export function buildContract() {
  const runtimeFile = 'src/core/js/runtime.js';
  const runtime = read(runtimeFile);
  const abi = Number(runtime.match(/^export const RUNTIME_ABI = (\d+);$/mu)?.[1]);
  if (!Number.isInteger(abi) || abi < 1) throw new Error(`${runtimeFile}: no "export const RUNTIME_ABI = <n>;"`);
  const imports = new Map([...runtime.matchAll(/^import \* as ([\w$]+) from "([^"]+)";$/gmu)].map((m) => [m[1], m[2]]));
  const modules = {};
  for (const [, id, binding] of runtime.matchAll(/^\s+"([^"]+)": asModule\(([\w$]+)\),$/gmu)) {
    const request = imports.get(binding);
    if (!request) throw new Error(`${runtimeFile}: "${id}" names ${binding}, which is not imported`);
    if (!request.startsWith('.')) { modules[id] = {source: request, exports: null}; continue; }
    const file = resolveSource(runtimeFile, request);
    modules[id] = {source: file.replace(/^src\//u, ''), exports: exportsOf(read(file), file)};
  }
  const hostFile = 'src/core/js/core-modules.js';
  const coreHosted = [...read(hostFile).matchAll(/^\s+'([^']+)': asModule\(/gmu)].map((m) => m[1]).sort();
  for (const id of coreHosted) if (!modules[id]) throw new Error(`${hostFile}: Core publishes "${id}", which the runtime does not hand out`);
  return {
    schema: 'simai.framework.shared-runtime',
    version: 1,
    abi,
    script: 'core/js/smart-base.js',
    core_hosted: coreHosted,
    component_manifest_keys: [...COMPONENT_MANIFEST_KEYS],
    component_manifest_drop: [...COMPONENT_MANIFEST_DROP],
    modules: Object.fromEntries(Object.entries(modules).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = `${JSON.stringify(buildContract(), null, 2)}\n`;
  if (process.argv.includes('--write')) { writeFileSync(path.join(root, CONTRACT), text); console.log(`${CONTRACT} written`); }
  else if (read(CONTRACT) !== text) { console.error(`${CONTRACT} is not current: node scripts/shared-runtime-contract.mjs --write`); process.exit(1); }
  else console.log(`${CONTRACT} is current`);
}
