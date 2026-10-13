import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../src/smart/context-menu/smart.manifest.json', import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL('../src/smart/context-menu/studio.fixture.json', import.meta.url)));
const ordinaryDocs = readFileSync(new URL('../src/component/context-menu/docs/docs.md', import.meta.url), 'utf8');
const smartDocs = readFileSync(new URL('../src/smart/context-menu/docs/docs.md', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/generate-smart-studio-artifacts.mjs', import.meta.url), 'utf8');

test('Context Menu machine contract matches its array source property and required name', () => {
  assert.equal(manifest.inputs.properties.items.type, 'array');
  assert.deepEqual(manifest.inputs.properties.items.default, []);
  assert.ok(manifest.inputs.required.includes('aria-label'));
  assert.match(manifest.ai_guidance.minimal_example, /aria-label=/);
  // The standard menu (owner, 2026-10-12): entries as data, opened for an
  // anchor. Slotted sf-button items stay supported; the fixture below uses them.
  assert.match(manifest.ai_guidance.minimal_example, /\.entries\s*=/);
  assert.match(manifest.ai_guidance.minimal_example, /toggleFor\(|openFor\(/);
  assert.equal(manifest.inputs.properties.entries.type, 'array');
  for (const name of ['openFor', 'toggleFor', 'close']) assert.ok(manifest.methods[name], name);
  assert.ok(manifest.events['sf-context-menu-select']);
  assert.match(generator, /type:\\s\*Array/);
});

test('Context Menu reference fixture uses Framework-owned slotted action controls', () => {
  assert.ok(fixture.props['aria-label']);
  assert.ok(fixture.children.length >= 2);
  assert.ok(fixture.children.every(item => item.element === 'sf-button' && item.props.slot === 'content'));
});

test('Context Menu docs preserve presentation, menu and host ownership boundaries', () => {
  assert.match(ordinaryDocs, /отвечает только за\s+представление/);
  assert.match(ordinaryDocs, /Не назначайте обычной статической разметке `role="menu"`/);
  assert.match(smartDocs, /обязательно задают доступное имя/);
  assert.match(smartDocs, /хост открывает меню/);
});
