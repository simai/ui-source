import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// DEV return CV-T (group build 12 acceptance, 2026-11-18): the table footer
// total prints the field's unit as the cells do -- the CV-7 rule, a number
// keeps its unit in every place; C294 money totals already carry the currency.
const source = readFileSync(new URL('../src/smart/field-renderers/index.js', import.meta.url), 'utf8');

test('CV-T: renderTotalField writes the number total with the field unit, as renderNumericCell does', () => {
  const total = source.slice(source.indexOf('export function renderTotalField('), source.indexOf('export function isNumericType('));
  assert.match(total, /const text = formatDecimal\(sum, locale\);\n\s+const unit = fieldUnit\(field\);\n\s+return \[unit \? `\$\{text\} \$\{unit\}` : text\];/u);
  assert.match(source, /return text && field\.unit \? `\$\{text\} \$\{field\.unit\}` : text;/u, 'the cell keeps the unit');
});
