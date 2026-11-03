// The docs thread's comparison of every Smart page with its manifest (pair
// ui-2d39b617a719): the declarations corrected to what the runtime does.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../src/smart/', import.meta.url);
const manifest = (name) => JSON.parse(readFileSync(new URL(`${name}/smart.manifest.json`, root), 'utf8'));
const aliases = (name) => JSON.parse(readFileSync(new URL(`${name}/aliases.json`, root), 'utf8')).aliases;

test('every Smart manifest describes the base settings root-class and root-style', () => {
  for (const name of readdirSync(root)) {
    if (!existsSync(new URL(`${name}/smart.manifest.json`, root))) continue;
    const inputs = manifest(name).inputs.properties;
    for (const key of ['root-class', 'root-style']) {
      if (inputs[key]) assert.ok(inputs[key].description, `${name} ${key}`);
    }
  }
});

test('an old event name declares the detail it arrives with', () => {
  // drawer, modal (the element adapter adds component, the element, root to
  // the new detail) and profile-picker (the same detail): the old payload holds
  // every field of the new one.
  for (const name of ['drawer', 'modal', 'profile-picker']) {
    const events = manifest(name).events;
    for (const row of aliases(name).filter((entry) => entry.kind === 'event' && entry.to && events[entry.from])) {
      const fresh = Object.keys(events[row.to].payload.properties ?? {});
      const old = Object.keys(events[row.from].payload.properties ?? {});
      for (const field of fresh) assert.ok(old.includes(field), `${name} ${row.from} carries ${field} of ${row.to}`);
    }
  }
  // editor-inline and composition-overlay keep the former detail, and say so.
  for (const [name, olds] of [['editor-inline', ['sf-inline-edit-input', 'sf-inline-edit-commit', 'sf-inline-edit-cancel']],
    ['composition-overlay', ['sf-composition-overlay-action', 'sf-composition-overlay-edit']]]) {
    for (const old of olds) assert.match(manifest(name).events[old].summary, /Its detail is the former one/u, `${name} ${old}`);
  }
});

test('sf-popover-open and -close are requests; -opened and -closed the facts', () => {
  const events = manifest('popover').events;
  assert.match(events['sf-popover-open'].summary, /^A request to open/u);
  assert.match(events['sf-popover-close'].summary, /^A request to close/u);
  assert.match(events['sf-popover-opened'].summary, /^The surface opened/u);
  assert.match(events['sf-popover-closed'].summary, /^The surface closed/u);
});

test('sf-modal: heading is the setting, title its dated alias', () => {
  const inputs = manifest('modal').inputs.properties;
  assert.match(inputs.heading.description, /title in the default header/u);
  assert.match(inputs.title.description, /^Dated alias of heading/u);
});

test('sf-sortable inserter-items names the fields the inserter reads', () => {
  const text = manifest('sortable').inputs.properties['inserter-items'].description;
  for (const field of ['value', 'label', 'icon', 'caption', 'keywords', 'disabled']) assert.ok(text.includes(field), field);
  const code = readFileSync(new URL('../src/core/js/composition/sortable-inserter.mjs', import.meta.url), 'utf8');
  assert.match(code, /id: String\(item\.value\)/u);
});

test('sf-tree-item declares no retired open(), close() or toggle() method', () => {
  const methods = manifest('tree-item').methods;
  for (const name of ['open', 'close', 'toggle']) assert.equal(methods[name], undefined, name);
  assert.match(methods.setOpen.returns.description, /outcome/u);
});

test('the inputs the docs found undescribed have words, and the closed sets an enum', () => {
  const described = {
    button: ['text-position', 'segment'], drawer: ['placement', 'heading', 'label', 'width', 'z-index', 'unsaved', 'dismissible'],
    'profile-picker': ['profiles', 'rights'], slider: ['dots-type', 'dots-size', 'button-size'],
  };
  for (const [name, keys] of Object.entries(described)) {
    for (const key of keys) assert.ok(manifest(name).inputs.properties[key].description, `${name} ${key}`);
  }
  const modal = manifest('modal').inputs.properties;
  const settings = JSON.parse(readFileSync(new URL('modal/component.json', root), 'utf8')).settings;
  for (const key of Object.keys(settings)) assert.ok(modal[key].description, `modal ${key}`);
  for (const key of ['dots-type', 'dots-size', 'button-size']) assert.ok(Array.isArray(manifest('slider').inputs.properties[key].enum), key);
  for (const key of ['text-position', 'segment']) assert.ok(Array.isArray(manifest('button').inputs.properties[key].enum), key);
});
