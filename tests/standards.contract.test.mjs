import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));
const digest = (relative) => createHash('sha256').update(read(relative)).digest('hex');
const schema = json('contracts/standards/standard-contract-1.0.schema.json');

// The live editions. Published bytes of superseded editions stay under
// contracts/standards/history and are never rewritten, so a consumer that
// pinned them keeps valid bytes.
function standardFiles() {
  const base = 'contracts/standards';
  const directory = readdirSync(new URL(`${base}/`, root), {withFileTypes: true});
  return directory
    .filter((entry) => entry.isDirectory() && !['history', 'pinned'].includes(entry.name))
    .flatMap((entry) => readdirSync(new URL(`${base}/${entry.name}/`, root), {withFileTypes: true})
      .filter((version) => version.isDirectory())
      .map((version) => `${base}/${entry.name}/${version.name}/standard.json`));
}

// The envelope rules that matter here, checked without a JSON Schema runtime:
// the same required fields, patterns and closed object shapes as the copied schema.
const idPattern = /^[a-z][a-z0-9.-]*$/;
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const digestPattern = /^[a-f0-9]{64}$/;

function checkReference(reference, where, {requirePinned}) {
  assert.ok(idPattern.test(reference.id), `${where}: id`);
  assert.ok(versionPattern.test(reference.version), `${where}: version`);
  assert.deepEqual(Object.keys(reference).filter((key) => !['id', 'version', 'path', 'url', 'sha256', 'description'].includes(key)), [], `${where}: unknown keys`);
  if (requirePinned) {
    assert.ok(reference.path, `${where}: pinned reference needs a path`);
    assert.ok(digestPattern.test(reference.sha256 || ''), `${where}: pinned reference needs a digest`);
  }
  if (reference.path) {
    assert.ok(digestPattern.test(reference.sha256 || ''), `${where}: a local path needs its digest`);
    assert.ok(!path.isAbsolute(reference.path) && !reference.path.includes('\\'), `${where}: path stays relative`);
  }
}

test('standard envelopes match the copied standard-contract schema', () => {
  const files = standardFiles();
  assert.ok(files.length >= 2, 'the Framework publishes its standards from contracts/standards');
  assert.equal(schema.properties.formatVersion.const, '1.0');
  for (const file of files) {
    const standard = json(file);
    for (const field of ['format', 'formatVersion', 'id', 'version', 'title', 'appliesTo', 'requirements']) {
      assert.ok(field in standard, `${file}: ${field} is required`);
    }
    assert.deepEqual(Object.keys(standard).filter((key) => !(key in schema.properties)), [], `${file}: unknown envelope keys`);
    assert.equal(standard.format, 'standard-contract', `${file}: format`);
    assert.equal(standard.formatVersion, '1.0', `${file}: formatVersion`);
    assert.ok(idPattern.test(standard.id), `${file}: id`);
    assert.ok(versionPattern.test(standard.version), `${file}: version`);
    assert.ok(standard.appliesTo.length > 0 && standard.appliesTo.every((kind) => idPattern.test(kind)), `${file}: appliesTo`);
    assert.equal(file, `contracts/standards/${standard.id}/${standard.version}/standard.json`, `${file}: lives at its identity`);

    const ids = new Set();
    for (const requirement of standard.requirements) {
      assert.ok(idPattern.test(requirement.id), `${file}: requirement id ${requirement.id}`);
      assert.ok(!ids.has(requirement.id), `${file}: duplicate requirement ${requirement.id}`);
      ids.add(requirement.id);
      assert.ok(['must', 'should', 'may'].includes(requirement.level), `${file}: level of ${requirement.id}`);
      assert.ok(requirement.text.trim().length > 0, `${file}: text of ${requirement.id}`);
      assert.ok(['manual', 'equals'].includes(requirement.verification), `${file}: verification of ${requirement.id}`);
      assert.deepEqual(Object.keys(requirement).filter((key) => !['id', 'level', 'text', 'verification', 'property', 'value', 'guidance'].includes(key)), [], `${file}: keys of ${requirement.id}`);
    }
    // The agreed framing: a framework standard stays at 15 to 20 principles.
    assert.ok(standard.requirements.length >= 15 && standard.requirements.length <= 20, `${file}: ${standard.requirements.length} requirements`);

    for (const inherited of standard.extends ?? []) checkReference(inherited, `${file}: extends ${inherited.id}`, {requirePinned: true});
    for (const used of standard.uses ?? []) checkReference(used, `${file}: uses ${used.id}`, {requirePinned: false});
    for (const reference of standard.references ?? []) checkReference(reference, `${file}: references ${reference.id}`, {requirePinned: false});
    if (standard.specification) checkReference(standard.specification, `${file}: specification`, {requirePinned: false});
  }
});

test('every pinned reference matches the bytes it names', () => {
  for (const file of standardFiles()) {
    const standard = json(file);
    const directory = path.posix.dirname(file);
    for (const reference of [...(standard.extends ?? []), ...(standard.uses ?? []), ...(standard.specification ? [standard.specification] : [])]) {
      if (!reference.path) continue;
      const target = path.posix.normalize(path.posix.join(directory, reference.path));
      assert.ok(!target.startsWith('..'), `${file}: ${reference.id} stays inside the repository`);
      assert.equal(digest(target), reference.sha256, `${file}: ${reference.id} digest of ${target}`);
    }
    for (const inherited of standard.extends ?? []) {
      const parent = json(path.posix.normalize(path.posix.join(directory, inherited.path)));
      assert.equal(parent.id, inherited.id, `${file}: parent identity`);
      assert.equal(parent.version, inherited.version, `${file}: parent version`);
      const inheritedKinds = new Set(parent.appliesTo);
      assert.ok(standard.appliesTo.every((kind) => inheritedKinds.has(kind)), `${file}: parent applies to the same kinds`);
      const own = new Set(standard.requirements.map((requirement) => requirement.id));
      for (const requirement of parent.requirements) {
        assert.ok(!own.has(requirement.id), `${file}: ${requirement.id} is inherited, not repeated`);
      }
    }
  }
});

// One identity and version may never cover two byte sets: a pinned reference
// names the version the target itself declares. Reported by Larena after the
// 1.0.1 re-issue pinned an extended schema under its previous version.
test('a pinned version matches the version the target declares', () => {
  for (const file of standardFiles()) {
    const standard = json(file);
    const directory = path.posix.dirname(file);
    for (const used of standard.uses ?? []) {
      if (!used.path) continue;
      const target = json(path.posix.normalize(path.posix.join(directory, used.path)));
      const declared = target['x-simai-version'] ?? target.version;
      assert.ok(declared, `${file}: ${used.id} target declares no version`);
      assert.equal(used.version, declared, `${file}: ${used.id} pins ${used.version} but the target says ${declared}`);
    }
  }
});

test('a live standard pins only frozen copies, and history keeps the published bytes', () => {
  for (const file of standardFiles()) {
    const standard = json(file);
    for (const used of standard.uses ?? []) {
      assert.ok(used.path.includes('/pinned/'), `${file}: ${used.id} must pin a frozen copy`);
    }
  }
  const history = readdirSync(new URL('contracts/standards/history/', root), {withFileTypes: true})
    .filter((entry) => entry.isDirectory());
  assert.ok(history.length >= 3, 'superseded editions are kept');
  for (const entry of history) {
    for (const version of readdirSync(new URL(`contracts/standards/history/${entry.name}/`, root), {withFileTypes: true})) {
      const published = json(`contracts/standards/history/${entry.name}/${version.name}/standard.json`);
      assert.equal(published.id, entry.name);
      assert.equal(published.version, version.name);
      assert.ok(published.requirements.length > 0);
    }
  }
});

test('the copied envelope schema keeps its origin recorded', () => {
  const notes = read('contracts/standards/README.md').toString('utf8');
  assert.match(notes, /standard-contract 1\.0/);
  assert.match(notes, new RegExp(digest('contracts/standards/standard-contract-1.0.schema.json')));
});
