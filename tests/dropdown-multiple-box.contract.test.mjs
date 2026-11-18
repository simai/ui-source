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
  assert.ok(template.includes('const withBox = multiple && (!option.type || option.type === "text" || option.type === "icon");'));
  // C308 FO-4: an option's colour names it as a tonal label first (optionName);
  // C308 (4), FF-3: the box stands at the row's end on every row (checkEnd).
  assert.ok(template.includes('renderListItemOption(withBox ? {...named, checkEnd: true} : named, {multiple})'));
});

// A picture row (avatar, colour) of a single choice drew an empty box at its
// end; the chosen row says it with its fill (owner C08; DEV P2, R143,
// 2026-11-12). The box after the picture stays for a multiple list, and a row
// outside a dropdown draws none (docs precheck smart content LI-01).
test('an avatar or colour option draws its box only in a multiple list', async () => {
  const listItem = await read('src/smart/list-item/js/templates/default.js');
  assert.ok(listItem.includes('export function renderListItemOption(option = {}, {multiple = false} = {})'));
  assert.ok(listItem.includes('multiple: Boolean(multiple),'));
  assert.ok(listItem.includes('if (isOption && context.multiple && (context.type === "avatar" || context.type === "color" || context.checkEnd === true)) {'));
  assert.ok(listItem.includes('checkEnd: option.checkEnd === true,'));
});

test('an option that draws a picture of its own keeps it', async () => {
  const template = await read('src/smart/dropdown/js/templates/default.js');
  // The box stands after the name (FF-3), so an icon row keeps its icon and
  // a colour or avatar row its picture; none of them becomes a checkbox row.
  assert.doesNotMatch(template, /withBox = multiple(?!.*option\.type === "text")/u);
  assert.doesNotMatch(template, /\{\.\.\.named, type: "checkbox"\}/u);

  // The row itself is unchanged: the box is what a checkbox option has always
  // drawn, and it is checked from the selection.
  const listItem = await read('src/smart/list-item/js/templates/default.js');
  assert.match(listItem, /if \(context\.type === "checkbox"\) \{[\s\S]*?\.checked=\$\{Boolean\(context\.checked \|\| context\.selected\)\}/u);
});

test('the dropdown documentation says what a multiple list draws', async () => {
  const docs = await read('src/smart/dropdown/docs/docs.md');
  assert.ok(docs.includes('A `multiple` dropdown draws a box'));
});
