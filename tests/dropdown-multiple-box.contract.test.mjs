import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

// A multiple dropdown showed what was chosen with a class and `aria-selected`
// alone, so on a list of any length nothing on screen told the person what they
// had picked (Larena storage QA, 2026-10-22). A list row draws a visible box
// only for an option of type checkbox.
test('every option of a multiple dropdown carries the box', async () => {
  const template = await read('src/smart/dropdown/js/templates/default.js');
  assert.ok(template.includes('function renderOptions(options = [], multiple = false)'));
  assert.ok(template.includes('${renderOptions(context.options, context.multiple)}'));
  assert.ok(template.includes('const withBox = multiple && (!option.type || option.type === "text");'));
  assert.ok(template.includes('renderListItemOption(withBox ? {...option, type: "checkbox"} : option)'));
});

test('an option that draws a picture of its own keeps it', async () => {
  const template = await read('src/smart/dropdown/js/templates/default.js');
  // The box would take the place the icon, the colour swatch or the avatar
  // stands in, so only a plain text row becomes a checkbox row.
  assert.doesNotMatch(template, /withBox = multiple(?!.*option\.type === "text")/u);

  // The row itself is unchanged: the box is what a checkbox option has always
  // drawn, and it is checked from the selection.
  const listItem = await read('src/smart/list-item/js/templates/default.js');
  assert.match(listItem, /if \(context\.type === "checkbox"\) \{[\s\S]*?\.checked=\$\{Boolean\(context\.checked \|\| context\.selected\)\}/u);
});

test('the dropdown documentation says what a multiple list draws', async () => {
  const docs = await read('src/smart/dropdown/docs/docs.md');
  assert.ok(docs.includes('A `multiple` dropdown draws a box'));
});
