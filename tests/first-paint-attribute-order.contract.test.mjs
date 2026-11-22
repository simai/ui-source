// GB17 L7: the first-paint snapshot writer and check compare markup with each start tag's attributes in
// name order, so a component that sets title before or after aria-haspopup depending on timing does not
// make its snapshot stale (the Editor set's release stopped on sf-button-icon's inner button).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortedAttributes, sameSnapshot} from '../scripts/first-paint-lib.mjs';

const stored = '<button type="button" class="sf-icon-button" aria-label="Справка" tabindex="0" aria-haspopup="dialog" aria-expanded="false" title data-sf-static>\n<i class="sf-icon" aria-hidden="true" data-sf-static>help</i></button>';
const rendered = '<button type="button" class="sf-icon-button" aria-label="Справка" tabindex="0" title aria-haspopup="dialog" aria-expanded="false" data-sf-static>\n<i class="sf-icon" aria-hidden="true" data-sf-static>help</i></button>';

test('the same markup in another attribute order is the same snapshot', () => {
  assert.notEqual(stored, rendered);
  assert.equal(sortedAttributes(stored), sortedAttributes(rendered));
  assert.ok(sameSnapshot(stored, rendered));
});

test('a changed value, a lost attribute or changed text is still stale', () => {
  assert.ok(!sameSnapshot(stored, stored.replace('tabindex="0"', 'tabindex="-1"')));
  assert.ok(!sameSnapshot(stored, stored.replace(' title', '')));
  assert.ok(!sameSnapshot(stored, stored.replace('>help<', '>close<')));
  assert.ok(!sameSnapshot('<a title="x y">', '<a title="x" y>'));
});

test('values, bare names, quotes, self-closing tags and text are kept', () => {
  assert.equal(sortedAttributes('<sf-icon root-class="a b" icon="help" filled="false">t</sf-icon>'), '<sf-icon filled="false" icon="help" root-class="a b">t</sf-icon>');
  assert.equal(sortedAttributes('<input value=\'a"b\' disabled type=text />'), '<input disabled type=text value=\'a"b\' />');
  assert.equal(sortedAttributes('plain <p>text</p> & more'), 'plain <p>text</p> & more');
  assert.equal(sortedAttributes('<b z a>'), '<b a z>');
  assert.equal(sortedAttributes('<span>no attributes</span>'), '<span>no attributes</span>');
});

test('the writer and the check compare through it', () => {
  const script = readFileSync(new URL('../scripts/snapshot-first-paint.mjs', import.meta.url), 'utf8');
  assert.equal((script.match(/sameSnapshot\(readFileSync\(/gu) || []).length, 3);
  assert.doesNotMatch(script, /readFileSync\([^)]*'utf8'\) [!=]== /u);
});
