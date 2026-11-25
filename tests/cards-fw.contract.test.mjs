import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Cards study orders for the SIMAI Framework (ui-control research
// 2026-11-18-cards-view, CV-7 and the view set's reserved names).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const source = read('src/smart/field-renderers/index.js');
const body = (name) => source.slice(source.indexOf(`function ${name}(`), source.indexOf('\n}\n', source.indexOf(`function ${name}(`)));

test('CV-7: a number keeps its unit in the edit and filter places, as in the view and the compact place', () => {
  assert.match(body('fieldUnit'), /typeof field\?\.unit === 'string' \? field\.unit\.trim\(\) : ''/u);
  assert.match(body('renderNumberEdit'), /text-end=\$\{fieldUnit\(field\) \|\| nothing\}/u);
  assert.match(body('renderStepperEdit'), /unit=\$\{percent \? '%' : fieldUnit\(field\) \|\| nothing\}/u);
  // The filter: a percent keeps «%», money its currency sign, a number its unit.
  assert.match(body('renderNumberFilterControl'), /const textEnd = look\.percent \? '%' : isolatedSign\(sign && !sign\.before \? sign\.sign : '', locale\)\s+\|\| \(look\.money \? '' : fieldUnit\(field\)\);/u);
  assert.match(body('renderNumericCell'), /return text && field\.unit \? `\$\{text\} \$\{field\.unit\}` : text;/u);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.2') // GB19 B: include view owns no lit DOM // GB18 L6; // FS-9 (feat/form-defects-fs, merged in GB17); // group build 17 F4: option badge hue // group build 16 returns GB16-3: the phone sheet fills; // group build 16 G8: the filter window's one step, PH-3 band radius; // C396 WM-4: the template parameter width, above 1.26.1 on origin // group build 13: 1.25.0 moved on by the merged branches or a GB11 merge
});

test('the view set reserves sf-view-cards and sf-view-calendar (rules cl-view-cards, cl-view-calendar)', () => {
  const view = json('contracts/registry/names.json').owners.find(({id}) => id === 'view');
  const status = Object.fromEntries(view.names.map(({element, status}) => [element, status]));
  assert.equal(status['sf-view-cards'], 'preview'); // GB15 A7: the set ships it
  assert.equal(status['sf-view-calendar'], 'preview'); // GB15 A7: the set ships it
  assert.match(view.source, /sf-view-cards \(rule cl-view-cards\)/u);
  assert.match(view.source, /sf-view-calendar \(rule cl-view-calendar\)/u);
  const elements = view.names.map(({element}) => element);
  assert.deepEqual(elements, [...elements].sort(), 'names stay in order');
});
