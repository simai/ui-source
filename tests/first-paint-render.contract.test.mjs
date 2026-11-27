import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {SCHEMA, SCHEMA_VERSION, USAGE, canonicalJson, createRenderer} from '../tools/first-paint/render.mjs';
import {kitFiles} from '../scripts/build-first-paint-kit.mjs';
import {checkShippedPaths, declaredPaths} from '../scripts/check-shipped-paths.mjs';

// tools/first-paint/render.mjs (docs/developer/first-paint-render.md) and
// what group build 19 ships for it, without a browser. The browser half (a
// request with each example's settings answers its committed snapshot, no
// shift when the code arrives, two runs the same bytes) is
// tests/browser/first-paint-render.browser.mjs over a build.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const doc = read('docs/developer/first-paint-render.md');
const schema = json('contracts/schema/first-paint-render.schema.json');

test('1. the pair\'s copy is the tools, byte for byte (scripts/build-first-paint-kit.mjs --check)', () => {
  for (const [name, body] of kitFiles()) assert.equal(read(`src/core/js/composition/${name}`), body, `${name} is stale: node scripts/build-first-paint-kit.mjs`);
  // The copy imports only files beside it, so the build ships all of them
  // (ui-builder materializeSourceAssets copies what a core/js/composition
  // module imports) and nothing outside the distribution.
  const relative = (text) => [...text.matchAll(/(?:^|[;\s])(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?["'](\.{1,2}\/[^"']+)["']/gu)].map((match) => match[1]);
  assert.deepEqual(relative(read('src/core/js/composition/first-paint-render.mjs')), ['./first-paint/render.mjs', './first-paint/render.mjs']);
  assert.deepEqual(relative(read('src/core/js/composition/first-paint/render.mjs')), ['./engine.mjs']);
  assert.deepEqual(relative(read('src/core/js/composition/first-paint/engine.mjs')), ['./lib.mjs', './page.mjs']);
  assert.deepEqual(relative(read('src/core/js/composition/first-paint/lib.mjs')), []);
  assert.equal(JSON.parse(read('src/core/js/composition/first-paint/page.mjs').split('export default ')[1].replace(/;\n$/u, '')), read('scripts/first-paint-page.js'));
  // The render imports the engine alone, so one render.mjs runs from ui-source and from the pair.
  assert.deepEqual(relative(read('tools/first-paint/render.mjs')), ['./engine.mjs']);
});

test('2. the schema names every request field and reason the renderer has', () => {
  const tool = read('tools/first-paint/render.mjs');
  assert.equal(SCHEMA, 'simai.first-paint-render');
  assert.equal(SCHEMA_VERSION, 1);
  assert.equal(schema.$defs.request.properties.schema_version.const, SCHEMA_VERSION);
  assert.equal(schema.$defs.answer.properties.schema_version.const, SCHEMA_VERSION);
  assert.equal(schema.$defs.request.properties.schema.const, SCHEMA);
  const fields = tool.match(/const REQUEST_FIELDS = new Set\(\[([^\]]+)\]\)/u)[1].match(/'([a-z_]+)'/gu).map((one) => one.slice(1, -1));
  assert.deepEqual(Object.keys(schema.$defs.request.properties).sort(), [...fields].sort());
  const reasons = new Set([...tool.matchAll(/(?:refuse\('|reason: ')([a-z-]+)'/gu)].map((match) => match[1]));
  for (const reason of reasons) assert.ok(schema.$defs.answer.properties.reason.enum.includes(reason), `schema: reason ${reason}`);
  for (const reason of schema.$defs.answer.properties.reason.enum) assert.ok(reasons.has(reason) || doc.includes(`\`${reason}\``), `${reason}: in the renderer`);
  for (const reason of reasons) assert.ok(doc.includes(`\`${reason}\``), `docs: reason ${reason}`);
});

test('3. the docs page documents the command line, the module and the answer', () => {
  for (const flag of [...USAGE.matchAll(/--([a-z-]+)/gu)].map((match) => match[1])) assert.ok(doc.includes(`--${flag}`), `docs: --${flag}`);
  for (const name of ['createRenderer', 'renderFirstPaint', 'renderMany', 'canonicalJson', 'buildIdentity', SCHEMA, 'first-paint-render.schema.json']) assert.ok(doc.includes(name), `docs: ${name}`);
  for (const field of Object.keys(schema.$defs.request.properties).filter((one) => one !== 'schema')) assert.ok(doc.includes(`\`${field}\``), `docs: request ${field}`);
  for (const field of Object.keys(schema.$defs.answer.properties).filter((one) => !['schema', 'id', 'tag', 'reason', 'detail'].includes(one))) assert.ok(doc.includes(`\`${field}\``), `docs: answer ${field}`);
  assert.ok(read('docs/developer/first-paint-print.md').includes('(first-paint-render.md)'), 'the print page sends a settings caller here');
});

test('4. the key is the canonical JSON of what draws, never of the caller\'s id', () => {
  assert.equal(canonicalJson({b: 1, a: {d: [2, {f: 1, e: 0}], c: null}}), '{"a":{"c":null,"d":[2,{"e":0,"f":1}]},"b":1}');
  assert.equal(canonicalJson({a: undefined, b: 'x'}), '{"b":"x"}');
});

// A distribution with two components, enough for every check before a browser.
function fakeDistribution() {
  const dir = mkdtempSync(join(tmpdir(), 'sf-render-'));
  for (const part of ['core/js', 'core/lang', 'rule', 'component', 'utility']) mkdirSync(join(dir, part), {recursive: true});
  writeFileSync(join(dir, 'core/js/core.js'), '// core');
  writeFileSync(join(dir, 'core/lang/ru.js'), '// ru');
  writeFileSync(join(dir, 'core/lang/en.js'), '// en');
  for (const folder of ['badge', 'list', 'tooltip']) {
    mkdirSync(join(dir, 'smart', folder), {recursive: true});
    copyFileSync(join(root, 'src/smart', folder, 'component.json'), join(dir, 'smart', folder, 'component.json'));
    copyFileSync(join(root, 'src/smart', folder, 'examples.json'), join(dir, 'smart', folder, 'examples.json'));
  }
  return dir;
}

test('5. what a component does not print is refused before any browser starts', async () => {
  const distr = fakeDistribution();
  const renderer = await createRenderer({distr});
  try {
    const ask = async (request) => {
      const answer = await renderer.render(request);
      assert.equal(answer.schema, SCHEMA);
      assert.equal(answer.schema_version, SCHEMA_VERSION);
      return [answer.status, answer.reason];
    };
    assert.deepEqual(await ask({tag: 'sf-no-such-thing'}), ['unknown', 'unknown-tag']);
    assert.deepEqual(await ask({tag: 'badge'}), ['refused', 'tag']);
    assert.deepEqual(await ask({tag: 'sf-badge', settings: {txt: 'x'}}), ['refused', 'unknown-setting']);
    assert.deepEqual(await ask({tag: 'sf-badge', settings: {status: 'fine'}}), ['refused', 'value']);
    assert.deepEqual(await ask({tag: 'sf-badge', settings: {tight: 'yes'}}), ['refused', 'value']);
    assert.deepEqual(await ask({tag: 'sf-badge', template: 'card'}), ['refused', 'template']);
    assert.deepEqual(await ask({tag: 'sf-badge', attributes: {status: 'info'}}), ['refused', 'attributes']);
    assert.deepEqual(await ask({tag: 'sf-badge', attributes: {'data-sf-static': ''}}), ['refused', 'attributes']);
    assert.deepEqual(await ask({tag: 'sf-badge', attributes: {onclick: 'x()'}}), ['refused', 'attributes']);
    assert.deepEqual(await ask({tag: 'sf-badge', lang: 'xx'}), ['refused', 'lang']);
    assert.deepEqual(await ask({tag: 'sf-badge', now: 'tomorrow'}), ['refused', 'now']);
    assert.deepEqual(await ask({tag: 'sf-badge', prefix: 'two words'}), ['refused', 'prefix']);
    assert.deepEqual(await ask({tag: 'sf-badge', colour: 'red'}), ['refused', 'unknown-field']);
    assert.deepEqual(await ask({tag: 'sf-badge', schema: 'simai.first-paint-print.v1'}), ['refused', 'schema']);
    assert.deepEqual(await ask([]), ['refused', 'not-a-request']);
    // GB20: a retired setting draws nothing (sf-tooltip size, C160 (3)): refused, not printed.
    assert.deepEqual(await ask({tag: 'sf-tooltip', settings: {size: '2'}}), ['refused', 'retired-setting']);
    assert.match((await renderer.render({tag: 'sf-tooltip', settings: {size: '1/3'}})).detail, /retired \(owner decision C160 \(3\)\) until 2027-01-01/u);
    // sf-list's items arrive after the first paint: refused, not drawn as an empty list.
    const late = JSON.parse(readFileSync(join(distr, 'smart/list/component.json'), 'utf8'));
    const lateName = late.presentation.skeleton.late[0];
    assert.deepEqual(await ask({tag: 'sf-list', settings: {[lateName]: [{id: 'a', title: 'A'}]}}), ['refused', 'late-setting']);
    assert.equal(renderer.origin, null, 'no server and no browser for a refusal');
    assert.deepEqual({drawn: renderer.stats.drawn, failed: renderer.stats.failed}, {drawn: 0, failed: 0});
    // The build identity: the files it serves, the same however often it is taken.
    assert.match(renderer.build, /^sha256:[0-9a-f]{64}$/u);
    const again = await createRenderer({distr});
    assert.equal(again.build, renderer.build);
    await again.close();
    writeFileSync(join(distr, 'core/js/core.js'), '// core, another pair');
    const other = await createRenderer({distr});
    assert.notEqual(other.build, renderer.build, 'another file, another build');
    await other.close();
    assert.equal((await createRenderer({distr, build: 'ui-b4f79e1c58b7'})).build, 'ui-b4f79e1c58b7');
  } finally {
    await renderer.close();
    rmSync(distr, {recursive: true, force: true});
  }
});

test('6. the command line: a session answers line by line, in order, and says what was refused', () => {
  const distr = fakeDistribution();
  try {
    const out = execFileSync(process.execPath, [join(root, 'tools/first-paint/render.mjs'), `--distr=${distr}`, '--session', '--build=t'], {
      input: '{"id":"a","tag":"sf-none"}\nnot json\n\n{"id":"c","tag":"sf-badge","settings":{"size":"9"}}\n',
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = out.trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(lines.map((one) => [one.id, one.status, one.reason]), [['a', 'unknown', 'unknown-tag'], [null, 'refused', 'not-json'], ['c', 'refused', 'value']]);
    assert.ok(lines.every((one) => one.build === 't'));
    let strict = 0;
    try {
      execFileSync(process.execPath, [join(root, 'tools/first-paint/render.mjs'), `--distr=${distr}`, '--strict'], {input: '{"tag":"sf-none"}', stdio: ['pipe', 'pipe', 'pipe']});
    } catch (error) {
      strict = error.status;
    }
    assert.equal(strict, 1, '--strict: exit 1 on a request not printed');
  } finally {
    rmSync(distr, {recursive: true, force: true});
  }
});

test('7. the template paths: the seven Docara prints and sf-switch name what the distribution holds', () => {
  const fixed = {badge: '1.9.0', tag: '1.13.2', tooltip: '1.5.5', avatar: '1.8.7', 'progress-bar': '1.5.7', 'reference-link': '1.3.6', 'button-copy': '1.7.8', switch: '1.10.3'}; // GB19 integration: switch 1.10.2 moved on by touch size (1.10.3)
  for (const [folder, version] of Object.entries(fixed)) {
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.equal(manifest.version, version, `${folder}: group build 19, the template path as shipped`);
    assert.equal(json(`src/smart/${folder}/smart.manifest.json`).version, version);
    for (const [name, entry] of Object.entries(manifest.templates)) {
      assert.match(entry.file, /^template\/[a-z-]+\.js$/u, `${folder} templates.${name}`);
      // The build ships js/templates/<file> as template/<file>.
      read(`src/smart/${folder}/js/templates/${entry.file.slice('template/'.length)}`);
    }
    assert.match(manifest.templates.default.$comment, /first-paint-render\.mjs/u, `${folder}: says how a server prints it`);
  }
  const result = checkShippedPaths();
  assert.deepEqual(result.failures, [], 'scripts/check-shipped-paths.mjs');
  const debt = json('contracts/shipped-template-paths.json');
  assert.equal(debt.schema, 'simai.shipped-template-paths');
  assert.equal(debt.schema_version, 1);
  for (const folder of Object.keys(fixed)) assert.ok(!(`smart.${folder}` in debt.debt), `${folder} is not debt`);
  // A path a manifest names that is not shipped and not listed fails; so
  // does a listed one that ships.
  const missing = checkShippedPaths(null, {...debt.debt, 'smart.badge': ['template/default.js']});
  assert.ok(missing.failures.some((one) => one.startsWith('smart.badge templates.default.file "template/default.js" ships now')));
  const {'smart.accordion': _, ...without} = debt.debt;
  assert.ok(checkShippedPaths(null, without).failures.some((one) => one.startsWith('smart.accordion templates.default.file')));
  assert.ok(declaredPaths().some((one) => one.field === 'examples'), 'examples paths are checked too');
});

test('8. the journal records the paths', () => {
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'path-template-file-as-shipped');
  assert.ok(record);
  assert.equal(record.rewrite, 'none');
  assert.deepEqual([...new Set(record.items.map((one) => one.component))], ['sf-badge', 'sf-tag', 'sf-tooltip', 'sf-avatar', 'sf-progress-bar', 'sf-reference-link', 'sf-button-copy', 'sf-switch']);
});
