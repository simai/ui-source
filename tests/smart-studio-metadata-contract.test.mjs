import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async (relative) => JSON.parse(await readFile(path.resolve(root, relative), 'utf8'));
const source = (relative) => readFile(path.resolve(root, relative), 'utf8');

test('button Studio contract preserves closed choices and open icon examples', async () => {
  const [manifest, fixture] = await Promise.all([
    json('src/smart/button/smart.manifest.json'),
    json('src/smart/button/studio.fixture.json'),
  ]);
  const properties = manifest.inputs.properties;

  // The list stays closed; link reads as ghost since sf-button 1.9.0 (decision
  // C15, a dated value alias listed in compatibility.aliases). surface and the
  // scheme secondary are former names since sf-button 1.14.0 (decision C116),
  // drawn as tonal on-surface and on-surface, so Studio no longer offers them.
  assert.deepEqual(properties.type.enum, ['default', 'tonal', 'outline', 'ghost']);
  assert.ok(manifest.compatibility.aliases.includes('appearance=link'));
  // on-surface-variant: the on-surface family one step quieter (sf-button 1.2.0).
  assert.deepEqual(properties.scheme.enum, ['primary', 'on-surface', 'on-surface-variant']);
  assert.deepEqual(properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  assert.deepEqual(properties['icon-position'].enum, ['start', 'end']);
  assert.equal(properties['root-class'].type, 'string');
  assert.equal(properties.tightness.type, 'string');
  assert.equal(properties.loading.type, 'boolean');
  assert.ok(properties.icon.examples.includes('settings'));
  assert.ok(properties['icon-left'].examples.includes('search'));
  assert.ok(properties.icon.description.length > 0);
  assert.ok(properties.type.enum.includes(fixture.props.type));
});

test('metadata refresh is generic and also corrects icon button inputs', async () => {
  const [generator, manifest] = await Promise.all([
    source('scripts/generate-smart-studio-artifacts.mjs'),
    json('src/smart/button-icon/smart.manifest.json'),
  ]);

  assert.match(generator, /componentMetadata\(componentRoot\)/);
  assert.match(generator, /metadataInputProperties/);
  assert.match(generator, /refreshMetadata/);
  assert.match(generator, /buttons: \{text: 'Продолжить', type: 'default'/);
  // The icon button carries four appearances (sf-button-icon 1.6.0, decision
  // C15): link reads as ghost, surface is drawn as tonal on-surface.
  assert.deepEqual(manifest.inputs.properties.type.enum, ['default', 'tonal', 'outline', 'ghost']);
  assert.equal(manifest.inputs.properties.icon.type, 'string');
  assert.equal(manifest.inputs.properties.loading.type, 'boolean');
});

test('all owner reference fixtures use declared component inputs and meaningful data', async () => {
  const smartRoot = path.resolve(root, 'src/smart');
  const {readdir} = await import('node:fs/promises');
  const directories = (await readdir(smartRoot, {withFileTypes: true})).filter((entry) => entry.isDirectory());
  let fixtureCount = 0;

  for (const directory of directories) {
    const manifestPath = path.join(smartRoot, directory.name, 'smart.manifest.json');
    const fixturePath = path.join(smartRoot, directory.name, 'studio.fixture.json');
    let manifest;
    let fixture;
    try {
      [manifest, fixture] = await Promise.all([json(path.relative(root, manifestPath)), json(path.relative(root, fixturePath))]);
    } catch {
      continue;
    }
    fixtureCount += 1;
    const properties = manifest.inputs.properties;
    assert.deepEqual(Object.keys(fixture.props).filter((name) => !(name in properties)), [], `${manifest.id} fixture has unknown inputs`);
    const values = [...Object.values(fixture.props), ...fixture.children.flatMap((child) => [child.text, ...Object.values(child.props)])];
    assert.ok(values.some((value) => value === true || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim().length > 0)), `${manifest.id} fixture has no meaningful demonstration data`);
  }

  // 47 until sf-view-table and sf-admin-menu, which carry studio fixtures, left the
  // free source; 46 with sf-page-header, the head of an admin page once the
  // top bar is gone; 47 with sf-resizer, a panel widened by its edge; 48 with
  // sf-profile-picker; 49 with sf-empty-state;
  // 50 with sf-copy-button; 51 with sf-help-mark;
  // 52 with sf-theme-generator; 53 with sf-image-field; 54 with sf-accordion; 55 with sf-quantity; 56 with sf-menu; 57 with sf-code-input;
  // 58 with sf-progress-ring; 59 with sf-site-header; 60 with sf-search; 61 with sf-settings-menu; 62 with sf-pager; 63 with sf-contents; 64 with sf-rich-text; 65 with sf-lookup;
  // 64 again when sf-settings-menu was folded into sf-context-menu (owner, 2026-10-30); 65 with sf-include; 64 when sf-toggle was swept (2026-11-02);
  // 66 with sf-confirm and sf-confirm-change (block confirm, 2026-11-03); 67 with sf-alert-bar (2026-11-05);
  // 69 with sf-list and sf-list-feed (block list, 2026-11-05); 70 with sf-language (2026-11-06); 71 with sf-settings (2026-11-06);
  // 73 with sf-wizard and sf-wizard-step (2026-11-06); 76 with sf-tile-metric, sf-list-attention and sf-progress-run (2026-11-07);
  // 79 with sf-input-choice, sf-list-description and sf-list-timeline (2026-11-08); 80 with sf-time and 81 with sf-change (C40, 2026-11-10).
  assert.equal(fixtureCount, 81);
});
