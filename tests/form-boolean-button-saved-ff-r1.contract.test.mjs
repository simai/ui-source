import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import './support/russian-language-file.mjs';
import {resolveField} from '../src/smart/field-renderers/templates.js';

// DEV return FF-R1 (group build 12 acceptance, 2026-11-18): in a form saved by
// a button sf-form drew a yes/no as a switch, and sf-switch then warned about
// itself on every load (C165 (4): a switch acts at once; with a save button
// the choice is a checkbox). The record card group edit is such a form.
const source = readFileSync(new URL('../src/smart/form/index.js', import.meta.url), 'utf8');

test('FF-R1: the default yes/no template is the switch; a button-saved form draws it as the checkbox', () => {
  assert.equal(resolveField({key: 'paid', type: 'boolean'}).template, 'switch');
  assert.equal(resolveField({key: 'paid', type: 'boolean', template: 'checkbox'}).template, 'checkbox');
  assert.equal(resolveField({key: 'paid', type: 'boolean', variant: 'switch', template: 'checkbox'}, {quiet: true}).template, 'checkbox', 'template wins over the former variant');
  assert.match(source, /buttonSaved\(field, editing\) \{\n\s+if \(!editing \|\| this\.isInstant\) return field;\n\s+const drawn = fieldTemplate\(field\);\n\s+return drawn\.type === 'boolean' && drawn\.template === 'switch' \? \{\.\.\.field, template: 'checkbox'\} : field;/u);
  assert.match(source, /fieldContext\(given, \{editing, id\}\) \{\n\s+const field = this\.buttonSaved\(given, editing\);/u);
});
