import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {components, assemblies, exampleFiles, givesLateData} from '../scripts/first-paint-lib.mjs';

// The first paint of every Smart component, as committed build snapshots
// (standard simai.smart-component 1.3.8 §5.4, §7.3, gate 24; owner decision
// 2026-10-27). Without a browser: that the files are there and say what they
// should. tests/browser/first-paint-snapshots.browser.mjs checks they are what
// the build renders, tests/browser/first-paint-gate.browser.mjs that they hold
// still.
const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const all = components();

test('every component has a snapshot per example, and the sheets it needs', () => {
  // 60 with sf-progress-ring, 61 with sf-site-header, 62 with sf-settings-menu.
  assert.equal(all.length, 62);
  for (const component of all) {
    const sheets = JSON.parse(readFileSync(join(component.dir, 'static', 'sheets.json'), 'utf8'));
    assert.equal(sheets.component, component.tag);
    assert.ok(sheets.sheets.includes('core/css/core.css'), `${component.folder}: core.css`);
    for (const example of component.examples.filter((one) => one.template !== 'skeleton')) {
      const files = exampleFiles(component, example);
      assert.ok(existsSync(files.html), `${component.folder}/${example.name}: static markup`);
      const html = readFileSync(files.html, 'utf8');
      assert.match(html, new RegExp(`<${component.tag}[\\s>]`, 'u'), `${component.folder}/${example.name}: the host`);
      assert.ok(Array.isArray(sheets.examples[example.name]), `${component.folder}/${example.name}: its sheets`);
      // A skeleton exactly where the example gives late data.
      const late = givesLateData(component, example);
      assert.equal(existsSync(files.skeleton), late, `${component.folder}/${example.name}: skeleton ${late ? 'missing' : 'not wanted'}`);
      if (late) assert.match(readFileSync(files.skeleton, 'utf8'), /data-sf-first-paint="skeleton" aria-busy="true"/u);
    }
  }
});

test('a drawn component prints its markup as static, never its runtime marks', () => {
  for (const component of all.filter((one) => !one.overlay)) {
    for (const example of component.examples.filter((one) => one.template !== 'skeleton')) {
      const html = readFileSync(exampleFiles(component, example).html, 'utf8');
      assert.doesNotMatch(html, /data-sf-started|data-sf-style-ready|data-sf-snap-page|<!--\?lit/u, `${component.folder}/${example.name}`);
      if (component.folder !== 'sortable' && component.folder !== 'resizer' && component.folder !== 'inline-editor') {
        assert.match(html, /data-sf-static/u, `${component.folder}/${example.name}: static markup`);
      }
    }
  }
});

test('late data is declared, the old shape hints are gone', () => {
  for (const component of all) {
    const skeleton = component.manifest.presentation?.skeleton;
    assert.equal(component.manifest['x-kept']?.presentation?.skeleton, undefined, `${component.folder}: x-kept skeleton hint`);
    for (const name of skeleton?.late ?? []) assert.ok(component.manifest.settings?.[name], `${component.folder}: late ${name} is a setting`);
  }
  const late = Object.fromEntries(all.filter((one) => one.late.length).map((one) => [one.folder, one.late]));
  assert.deepEqual(late, {menu: ['items'], 'profile-picker': ['profiles'], tree: ['items']});
});

test('the element adopts its printed markup: island, late data, hand-over, held children', () => {
  const manifest = read('src/core/js/element-manifest.js');
  assert.match(manifest, /sfReadIsland\(\)/u);
  assert.match(manifest, /data-sf-settings/u);
  assert.match(manifest, /sfAwaitingData\(\)/u);
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /handOverStaticMarkup\(printed\)/u);
  assert.match(base, /this\.sfAwaitingData\?\.\(\) === true/u);
  assert.match(base, /closest\("\[data-sf-static\]"\)/u);
  const sheet = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(sheet, /> \[data-sf-held\] \{\s*display: none !important;/u);
  assert.match(sheet, /\.sf-first-paint-bar \{/u);
  assert.match(read('src/core/js/assembly/host.mjs'), /adoptPrinted\(\)/u);
});

test('an assembly\'s first paint is composed from its parts', () => {
  const found = assemblies();
  assert.ok(found.length >= 1);
  for (const assembly of found) {
    for (const layout of Object.keys(assembly.layouts)) {
      for (const example of assembly.examples) {
        const html = readFileSync(join(assembly.dir, 'static', layout, `${example.name}.html`), 'utf8');
        assert.match(html, /data-sf-layout="[^"]*" data-sf-static/u);
        for (const [role, def] of Object.entries(assembly.manifest.roles)) {
          assert.match(html, new RegExp(`<${def.part} data-sf-role="${role}"`, 'u'), `${assembly.folder}: ${role}`);
        }
      }
    }
  }
});
