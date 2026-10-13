import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = JSON.parse(await read('src/smart/dropdown/smart.manifest.json'));
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('Dropdown machine contract describes the public source surface', () => {
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.deepEqual(manifest.inputs.properties.type.enum, ['filled', 'outlined']);
  assert.deepEqual(manifest.inputs.properties.mode.enum, ['tag', 'select']);
  assert.ok(manifest.composition.uses.includes('component.dropdown'));
  assert.ok(manifest.composition.uses.includes('smart.list-item'));
  assert.equal(manifest.accessibility.accessible_name, 'required');
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Space', 'Escape', 'Tab']) {
    assert.ok(manifest.accessibility.keyboard.includes(key));
  }
  assert.match(manifest.ai_guidance.minimal_example, /label="Статус"/);
  assert.match(manifest.ai_guidance.minimal_example, /<sf-list-item value="open"/);
});

test('Smart Dropdown template keeps option decoration out of the accessibility tree', async () => {
  const template = await read('src/smart/dropdown/js/templates/default.js');
  assert.match(template, /sf-tag-color-icon[^>]+aria-hidden="true"/);
  assert.match(template, /sf-tag-icon" aria-hidden="true"/);
  assert.match(template, /sf-icon sf-icon-hint" aria-hidden="true"/);
  assert.match(template, /\$\{dropdownIcon\}<\/i>/);
});

test('Dropdown documentation exposes every supported public axis through examples', {
  skip: uiDocRoot === null,
}, async () => {
  const ids = ['overview', 'variants', 'tags', 'options', 'sizes', 'states', 'search', 'portal',
    // What a long list needs and what a list behind something other than a
    // field needs: stretches with a heading over each, and a trigger the
    // consumer hands in.
    'groups', 'trigger'];
  const page = await readUiDoc('content/ru/components/navigation/dropdown.md');
  const examples = (await Promise.all(ids.map(id =>
    readUiDoc(`examples/components/dropdown/${id}/index.html`)
  ))).join('\n');

  for (const id of ids) assert.ok(page.includes(`components/dropdown/${id}`));
  for (const size of ['1/2', '1', '2']) {
    assert.ok(examples.includes(`sf-dropdown--size-${size}`) || examples.includes(`size="${size}"`));
  }
  for (const type of ['text', 'icon', 'checkbox', 'avatar', 'color']) {
    assert.ok(examples.includes(`type="${type}"`) || examples.includes(`sf-list-item--${type}`));
  }
  assert.match(examples, /sf-list-heading/u);
  assert.match(examples, /sf-list-container--grid/u);
  assert.match(examples, /sf-dropdown-trigger/u);
  assert.match(examples, /\bmultiple\b/);
  assert.match(examples, /\bportal\b/);
  assert.doesNotMatch(examples, /data-multiple|data-portal/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});

// A Smart parent that renders a dropdown from a template owns the children it
// put there. Capturing them means removing them, and once they are gone the
// parent can no longer put a changed list back: Lit has lost the nodes it
// bookkeeps, so a later render inserts nothing. Options therefore also travel as
// data, which has no owner to take them from.
test('options can be given as data, and data keeps the dropdown out of its parent’s children', async () => {
  const source = await read('src/smart/dropdown/index.js');

  assert.match(
    source,
    /set options\(value\) \{/u,
    'the dropdown accepts an options list as data',
  );
  assert.match(
    source,
    /captureOptions\(\) \{\s*if \(this\._optionsFromData\) \{\s*return;/u,
    'once options are data, the children of the parent are left alone',
  );
  assert.match(
    source,
    /function parseOptionList\(/u,
    'a list given as data is normalised through one function',
  );

  const options = manifest.inputs.properties.options;
  assert.ok(options, 'the manifest declares the data path');
  assert.equal(options.type, 'array');
  assert.match(options.description, /sf-list-item children/u, 'the description says what it replaces');

  // The one component that renders a dropdown from a template must use it:
  // rows per page and the actions list are exactly the two lists that broke.
  const template = await read('src/smart/pagination/js/templates/default.js');
  assert.doesNotMatch(
    template,
    /<sf-list-item/u,
    'pagination passes its lists as data rather than as dropdown children',
  );
  assert.equal(
    (template.match(/\.options=\$\{/gu) || []).length,
    2,
    'both of its dropdowns — rows per page and the actions list — are fed as data',
  );
});
