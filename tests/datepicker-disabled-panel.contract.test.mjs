import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// sf-datepicker 1.1.5: `disabled` disables the field and the panel
// (component.json settings.disabled). The panel is drawn while disabled when a
// host holds it open (the open attribute) or draws it inline (input=false), so
// every control the panel template draws carries the field's disabled state,
// and every path a control calls refuses while the field is disabled. The
// browser probe (probe.json, disabled-reaches-*) shows it on the built bytes;
// this keeps a control added later from slipping past it.
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('every control of the datepicker panel follows the field\'s disabled state', async () => {
  const template = await read('src/smart/datepicker/js/templates/default.js');
  const panel = template.slice(0, template.indexOf('function renderDatepickerInput'))
    + template.slice(template.indexOf('function renderDay'));
  const controls = [...panel.matchAll(/<(button|sf-button|sf-icon-button)\b[^>]*>/gu)];
  assert.ok(controls.length >= 9, `the panel template draws its controls (${controls.length})`);
  for (const [tag] of controls) {
    assert.match(tag, /\?disabled=\$\{[^}]*(context\.disabled|day\.disabled|month\.disabled|year\.disabled)/u, `a panel control without the disabled state: ${tag.slice(0, 80)}`);
  }
  // Days, months and years are disabled by the field, not only by min/max.
  const source = await read('src/smart/datepicker/index.js');
  assert.equal([...source.matchAll(/const disabled = Boolean\(\s*this\.disabled \|\|/gu)].length, 3);
});

test('the paths the panel calls refuse while the field is disabled', async () => {
  const source = await read('src/smart/datepicker/index.js');
  for (const method of ['toggleContext', 'shiftYearPage', 'shiftMonth', 'handleDayKeydown', 'selectDate', '_choosePreset', '_chooseCustomRange', 'selectMonth', 'selectYear']) {
    const start = source.indexOf(`    ${method}(`);
    assert.ok(start > 0, `${method} is defined`);
    const body = source.slice(start, source.indexOf('\n    }\n', start));
    assert.match(body, /this\.disabled/u, `${method} refuses while disabled`);
  }
  for (const action of ['choose-preset', 'choose-custom-range', 'open-panel']) {
    const start = source.indexOf(`'${action}'(`);
    assert.ok(start > 0, `${action} is an action`);
    assert.match(source.slice(start, start + 200), /if \(this\.disabled\) return 'disabled';/u, `${action} answers disabled`);
  }
});

test('value is a string or [start, end], written in component.json', async () => {
  const component = JSON.parse(await read('src/smart/datepicker/component.json'));
  assert.deepEqual(component['x-registry'].inputs.value, {type: ['string', 'array'], items: {type: 'string'}, maxItems: 2});
  const manifest = JSON.parse(await read('src/smart/datepicker/smart.manifest.json'));
  assert.deepEqual(manifest.inputs.properties.value.type, ['string', 'array']);
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.1.5:') && /type union/u.test(line)));
});
