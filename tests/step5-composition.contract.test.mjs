import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
const manifest = async (name) => JSON.parse(await read(`smart/${name}/smart.manifest.json`));

/* Tabs and pagination are rows of size 1 controls: an underlined or full tab
   was 2px taller than a plain one, and a page number was a text-height-4 box,
   28px on mobile beside 36px arrows. tests/browser/navigation-composition.cli.js
   measures the result. */
test('navigation composition: page numbers are size 1 controls and tab indicators sit inside the height', async () => {
  const page = await read('component/pagination/scss/_css__page_number.scss');
  assert.match(page, /block-size: var\(--sf-page-number--height, var\(--sf-ui-1--control-height\)\);/);
  assert.match(page, /inline-size: var\(--sf-page-number--width, var\(--sf-ui-1--control-height\)\);/);
  const tabs = await read('component/tabs/scss/_css__tabs.scss');
  assert.match(tabs, /\.sf-tabs--underline > \.sf-tabs-top-container > \.sf-tabs-top \.sf-button \{\s*padding-block-end: calc\(var\(--sf-button--padding-bottom\) - var\(--sf-button--border-bottom-width\)\);/);
  assert.match(tabs, /\.sf-tabs\.sf-tabs--full > \.sf-tabs-top-container > \.sf-tabs-top \.sf-button \{\s*padding-block-start: calc\(var\(--sf-button--padding-top\) - var\(--sf-button--border-top-width\)\);/);
});

/* The field renderer set addresses these components by type, so the inputs it
   passes are a contract: every size a renderer may pass is declared, and a
   name that looks like the ladder but is not says so. */
test('renderer inputs: datepicker size, reference size, avatar line, file-preview file size', async () => {
  const datepicker = await manifest('datepicker');
  assert.deepEqual(datepicker.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.match(datepicker.inputs.properties['input-size'].description, /Legacy name for size/);
  const runtime = await read('smart/datepicker/index.js');
  assert.match(runtime, /this\.getAttribute\('size'\) \|\| this\.getAttribute\('input-size'\)/);
  assert.deepEqual((await manifest('reference-link')).inputs.properties.size.enum, ['', '1/2', '1', '2']);
  const reference = await read('component/reference-link/scss/_css__reference_link.scss');
  for (const size of ['1\\/2', '1', '2']) assert.ok(reference.includes(`.sf-reference-link.sf-reference-link--size-${size} {`), size);
  assert.deepEqual((await manifest('avatar')).inputs.properties.line.enum, ['', '1/2', '1', '2']);
  const avatars = await read('component/avatars/scss/_css__avatars.scss');
  for (const size of ['1\\/2', '1', '2']) assert.ok(avatars.includes(`.sf-avatar.sf-avatar--line-${size} {\n    --sf-avatar--height: var(--sf-text-height-${size});`), size);
  assert.match((await manifest('file-preview')).inputs.properties.size.description, /Legacy name for file-size/);
  const axes = JSON.parse(await readFile(new URL('../contracts/public-api-axes.json', import.meta.url), 'utf8'));
  assert.ok(axes.size_ladder.name_aliases.some((a) => a.component === 'datepicker' && a.legacy.includes('input-size')));
  assert.ok(axes.exempt_properties.some((e) => e.component === 'file-preview' && e.property === 'size'));
});

/* A renderer binds the events a control declares and nothing else, so every
   control the set renders declares what it emits today. */
test('renderer events: the controls declare what they emit', async () => {
  for (const [name, events] of [
    ['input', ['input', 'change']], ['textarea', ['input', 'change']],
    ['checkbox', ['change']], ['switch', ['change']], ['file-upload', ['change']],
  ]) {
    const declared = Object.keys((await manifest(name)).events);
    for (const event of events) assert.ok(declared.includes(event), `${name} ${event}`);
  }
});
