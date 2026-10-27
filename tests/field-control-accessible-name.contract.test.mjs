import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

// Inside a labelled field the control carries an accessible name only: the panel
// prints the label, and a control that printed it again showed it twice -- the
// doubled label was wider than the date beside it (Larena storage QA,
// 2026-10-22). The finding was the date; the renderer set had the same slip in
// the phone field and the required yes/no switch.
test('the renderer set gives a labelled field a name, not a second label', async () => {
  const source = await read('src/smart/field-renderers/index.js');
  // The renderers of a field inside a labelled panel, not the filter controls:
  // a filter draws no label of its own, so it has nothing to double.
  for (const [renderer, tag] of [
    ['renderDateEdit', 'sf-datepicker'],
    ['renderBooleanEdit', 'sf-switch'],
    ['renderPhoneEdit', 'sf-country-code'],
  ]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.ok(start > 0, `${renderer} must exist`);
    const block = source.slice(start, source.indexOf(`<${tag}`, start) + 600);
    const element = block.slice(block.indexOf(`<${tag}`));
    const attributes = element.slice(0, element.indexOf('>'));
    assert.match(attributes, /aria-label=\$\{field\.label/u, `${tag} must take the name`);
    assert.doesNotMatch(attributes, /(?<!aria-)label=\$\{field\.label/u, `${tag} must not print the label again`);
  }
  // sf-color's own `label` is an accessible name already -- it draws no label
  // text -- so the colour renderers are right as they are.
  assert.match(source, /<sf-color[\s\S]{0,400}label=\$\{field\.label \|\| field\.key \|\| ''\}/u);
});

// A name passed to a Smart host named nothing: the host is not the control, and
// assistive technology reads the native input. Each control that can stand in a
// field whose label is drawn outside it now takes the name down to its input.
test('the controls carry the name to the element that is read', async () => {
  const input = await read('src/smart/input/js/templates/default.js');
  assert.ok(input.includes('const accessibleName = !labelContent && ariaLabel ? ariaLabel : nothing;'));
  assert.equal(input.split('aria-label=${accessibleName}').length - 1, 2, 'both native inputs');

  const switchTemplate = await read('src/smart/switch/js/templates/default.js');
  assert.ok(switchTemplate.includes('aria-label=${!labelContent && ariaLabel ? ariaLabel : nothing}'));

  const country = await read('src/smart/country-code/js/templates/default.js');
  assert.ok(country.includes('aria-label=${!label && ariaLabel ? ariaLabel : nothing}'));
  // No label, no label row: the row left an empty line above every phone field
  // in a panel that draws the labels itself.
  assert.match(country, /\$\{label\s*\n\s*\/\/[\s\S]{0,200}\? html`\s*\n\s*<span class="sf-country-code-label flex">/u);

  // A date field has no input of its own: the name goes on to sf-input, and only
  // where there is no visible label to conflict with it.
  const datepicker = await read('src/smart/datepicker/js/templates/default.js');
  assert.ok(datepicker.includes('aria-label=${context.label ? nothing : (context.ariaLabel || nothing)}'));
});

test('every control that takes the name declares it', async () => {
  for (const name of ['input', 'switch', 'country-code', 'datepicker']) {
    const source = await read(`src/smart/${name}/index.js`);
    assert.match(source, /ariaLabel: \{\s*attribute: 'aria-label', default: ''\s*\}/u, `${name} prop`);
    assert.match(source, /get ariaLabel\(\) \{\s*return this\.getProp\('ariaLabel'\) \|\| '';/u, `${name} getter`);
    const manifest = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`));
    assert.ok(manifest.inputs?.properties?.['aria-label'], `${name} manifest must name aria-label`);
  }
});
