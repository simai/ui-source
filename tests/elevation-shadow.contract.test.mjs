import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const contract = JSON.parse(read('contracts/elevation-shadow.json'));

const files = (directory, pattern) => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(resolve(root, dir), {withFileTypes: true})) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (pattern.test(entry.name)) found.push(path);
    }
  };
  walk(directory);
  return found;
};
const styles = [...files('src/component', /\.s?css$/u), ...files('src/smart', /\.s?css$/u)];

/* Height is one semantic: a panel that floats takes its step's surface and its
   step's shadow together. Before, about a dozen places floated on a bare
   shadow and lay flat in the dark theme, where a black shadow on a near-black
   page shows nothing; the overbox and the legacy dialogs were white there. */
test('elevation: every step is a surface and a shadow, the rim off', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  assert.match(theme, /--sf-shadow--rim: 0 0 0 0 transparent;/u);
  for (const step of [1, 2, 3, 4, 5]) {
    assert.ok(theme.includes(`--sf-elevation-${step}--surface:`), `surface ${step}`);
    assert.ok(theme.includes(`--sf-elevation-${step}--shadow: var(--sf-ui-shadow-${step}), var(--sf-shadow--rim);`), `shadow ${step}`);
  }
  const utility = read('src/utility/elevation/default/scss/_sf_css__elevation.scss');
  assert.match(utility, /background-color: var\(--sf-elevation-#\{\$level\}--surface\);\n {8}box-shadow: var\(--sf-elevation-#\{\$level\}--shadow\);/u);
});

test('elevation: a component does not float on a step shadow alone', () => {
  const allowed = new Set(contract.exemptions.map(({file, token}) => `${file} ${token}`));
  const used = new Set();
  const offenders = [];
  for (const path of styles) {
    const source = read(path);
    for (const [token] of source.matchAll(/--sf-ui-shadow-[1-5]\b/gu)) {
      const id = `${path} ${token}`;
      if (allowed.has(id)) used.add(id);
      else offenders.push(id);
    }
    for (const [, step] of source.matchAll(/--sf-elevation-([1-5])--shadow\b/gu)) {
      if (!source.includes(`--sf-elevation-${step}--surface`)) offenders.push(`${path}: step ${step} shadow without its surface`);
    }
  }
  assert.deepEqual(offenders, [], 'take --sf-elevation-N--shadow with --sf-elevation-N--surface, or exempt with a reason');
  for (const id of allowed) assert.ok(used.has(id), `${id}: exempt but no longer used; remove the exemption`);
  for (const {reason} of contract.exemptions) assert.ok(reason.length > 40);
});

test('elevation: the legacy system builds panels from one level class', () => {
  const offenders = [];
  for (const path of files('src/component/sf-system', /\.js$/u)) {
    for (const [string] of read(path).matchAll(/'[^'\n]*'|"[^"\n]*"/gu)) {
      if (/(^|\s)shadow-[1-5]\b/u.test(string) && /(^|\s)bg-(white|surface-0)\b/u.test(string)) offenders.push(`${path}: ${string.slice(0, 80)}`);
      if (/before:bg-white|before:shadow-[1-5]/u.test(string)) offenders.push(`${path}: ${string.slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, [], 'use elevation-N, which sets the surface and the shadow');
  const pointer = read('src/component/overbox/scss/_css__overbox.scss');
  assert.match(pointer, /background-color: var\(--sf-elevation-4--surface\);/u);
});
