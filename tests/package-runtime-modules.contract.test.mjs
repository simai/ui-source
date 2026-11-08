// Package modules of the shared runtime (core/js/package-modules.js,
// core.runtime 1.38.0): a component package's shared core registers its
// modules as `<package>/<module>` and its components ask for them through
// SF.runtimeModule. One registry on the shared global, never one per copy; no
// package module shadows a Core one; one ABI per package.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const MODULE = '../src/core/js/package-modules.js';
// Two copies of the module, as two bundles carry two: the query makes Node
// evaluate the file a second time, with module scope of its own.
const one = await import(`${MODULE}?copy=1`);
const two = await import(`${MODULE}?copy=2`);

const quiet = (run) => {
  const error = console.error;
  console.error = () => {};
  try {
    return run();
  } finally {
    console.error = error;
  }
};
const page = () => ({});

test('two copies of the module share one registry on the shared global', async () => {
  assert.notEqual(one.registerPackageModules, two.registerPackageModules, 'two module instances');
  const root = page();
  const scale = {linearScale: () => 'linear'};
  assert.deepEqual(one.registerPackageModules('demo', 1, {scale}, {root}), ['demo/scale']);
  const got = await two.packageModule('demo/scale', 1, {root});
  assert.equal(got.linearScale(), 'linear');
  assert.equal(got.__esModule, true, 'webpack reads a default import off an ES module');
  assert.ok(Object.isFrozen(got));
  assert.equal(one.packageRegistry(root), two.packageRegistry(root));
  assert.equal(Object.keys(root).length, 0, 'the registry is not enumerable on the global');
});

test('a component that asks before its core has run waits for it', async () => {
  const root = page();
  const asked = two.packageModule('late/data', 2, {root});
  let settled = false;
  asked.then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(settled, false);
  one.registerPackageModules('late', 2, {data: {readSeries: () => 3}}, {root});
  assert.equal((await asked).readSeries(), 3);
});

test('a bundle built for another ABI of the package is refused, loudly', async () => {
  const root = page();
  one.registerPackageModules('abi', 1, {x: {v: 1}}, {root});
  const errors = [];
  const error = console.error;
  console.error = (value) => errors.push(value);
  try {
    await assert.rejects(two.packageModule('abi/x', 2, {root}), /built for ABI 2 of package "abi".*ABI 1/u);
  } finally {
    console.error = error;
  }
  assert.equal(errors.length, 1, 'said on the console');
  // Asked without an ABI (a bundle from a builder before ABIs): answered.
  assert.equal((await two.packageModule('abi/x', undefined, {root})).v, 1);
  await quiet(() => assert.rejects(two.packageModule('abi/missing', 1, {root}), /has no shared module "missing"/u));
});

test('a second registration with another ABI is refused; the same ABI keeps the first instance', () => {
  const root = page();
  const first = {v: 'first'};
  one.registerPackageModules('twice', 1, {m: first}, {root});
  quiet(() => assert.throws(() => two.registerPackageModules('twice', 2, {m: {v: 'other'}}, {root}), /already registered with ABI 1; a copy with ABI 2 is refused/u));
  assert.deepEqual(two.registerPackageModules('twice', 1, {m: {v: 'second'}, n: {v: 'new'}}, {root}), ['twice/n']);
  assert.equal(one.packageRegistry(root).packages.twice.modules.m.v, 'first', 'one instance per page');
});

test('a package module never shadows a Core one', () => {
  const root = page();
  const coreIds = ['lit', 'lit/directive.js', 'smart-base'];
  quiet(() => {
    assert.throws(() => one.registerPackageModules('lit', 1, {'directive.js': {}}, {root, coreIds}), /named after a namespace of the runtime's own modules/u);
    assert.throws(() => one.registerPackageModules('lit', 1, {other: {}}, {root}), /named after a namespace/u, 'the namespace is reserved even for a new name');
    assert.throws(() => one.registerPackageModules('Chart', 1, {x: {}}, {root}), /is not a package name/u);
    assert.throws(() => one.registerPackageModules('chart', 0, {x: {}}, {root}), /without an ABI/u);
    assert.throws(() => one.registerPackageModules('chart', 1, {'../x': {}}, {root}), /is not a module name/u);
  });
  assert.equal(one.packageRegistry(root).packages.chart, undefined, 'nothing of a refused registration is kept');
  // Core ids are never read as package ids, so they never reach the registry.
  for (const id of ['lit', 'lit/directive.js', 'lit/directives/ref.js', 'smart-base', 'page-language']) {
    assert.equal(one.packageModuleId(id), null, id);
  }
  assert.deepEqual(one.packageModuleId('chart/scale'), {name: 'chart', module: 'scale'});
  assert.deepEqual(one.packageModuleId('chart/geo/projection'), {name: 'chart', module: 'geo/projection'});
});

test('the reserved namespaces are the runtime\'s own slash ids, and the contract says so', () => {
  const runtime = read('src/core/js/runtime.js');
  const slashIds = [...runtime.matchAll(/^\s+"([^"]+)": asModule\(/gmu)].map((m) => m[1]).filter((id) => id.includes('/'));
  assert.ok(slashIds.length > 0);
  for (const id of slashIds) assert.ok(one.RESERVED_NAMESPACES.includes(id.split('/')[0]), id);
  const contract = JSON.parse(read('src/core/contracts/shared-runtime.v1.json'));
  assert.deepEqual(contract.package_modules.reserved_namespaces, [...one.RESERVED_NAMESPACES].sort());
  assert.equal(contract.package_modules.id, '<package>/<module>');
});

test('Core and the runtime script both answer package ids from the registry and install the registration', () => {
  const index = read('src/core/js/index.js');
  assert.match(index, /import \{installPackageRegistration, packageModule, packageModuleId\} from '\.\/package-modules\.js';/u);
  assert.match(index, /SF\.runtimeModule = \(id, abi\) => \(packageModuleId\(id\) \? packageModule\(id, abi\) : coreLookup\(id, abi\)\);/u);
  assert.match(index, /installPackageRegistration\(SF\.runtimeModule, /u);
  const entry = read('src/core/smart-base.js');
  assert.match(entry, /SF\.runtimeModule = \(id, abi\) => \(packageModuleId\(id\) \? packageModule\(id, abi\) : coreLookup\(id, abi\)\);/u);
  assert.match(entry, /installPackageRegistration\(SF\.runtimeModule, \(\) => Object\.keys\(RUNTIME_MODULES\)\)/u);
  // No package is named in the Framework's runtime.
  for (const file of ['src/core/js/package-modules.js', 'src/core/js/index.js', 'src/core/smart-base.js']) {
    assert.doesNotMatch(read(file).replace(/^\s*\/\/.*$/gmu, ''), /['"`]chart\//u, file);
  }
  // The state is on the global, not in module scope.
  const source = read('src/core/js/package-modules.js');
  assert.doesNotMatch(source, /^(?:let|const) \w+ = new (?:Map|Set)\(/mu);
  assert.match(source, /const REGISTRY = '__sfRuntimePackages';/u);
});

test('the registration hook sits on SF.runtimeModule, not enumerable', () => {
  const lookup = () => null;
  one.installPackageRegistration(lookup, () => ['lit']);
  assert.equal(typeof lookup.register, 'function');
  assert.equal(Object.keys(lookup).includes('register'), false);
});
