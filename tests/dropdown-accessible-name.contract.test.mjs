import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// The control a person reaches in sf-dropdown is the readonly input inside the
// trigger. Its visible label is a sibling span, not the wrapping <label>, and
// a name given to the host named the host, so the input had none -- ui-mail's
// axe gate reported «label», critical, on every screen with a dropdown
// (simai/ui-source#32). The input now carries the name: the drawn label first,
// then the host's aria-label, aria-labelledby, or a <label for> pointing at it.
const template = fs.readFileSync(new URL('../src/smart/dropdown/js/templates/default.js', import.meta.url), 'utf8');
const component = fs.readFileSync(new URL('../src/smart/dropdown/index.js', import.meta.url), 'utf8');

test('the trigger input and the search input are named', () => {
  assert.match(template, /class="cursor-pointer"\s*\n\s*aria-label=\$\{context\.accessibleName \|\| nothing\}/u);
  assert.match(template, /placeholder=\$\{context\.searchPlaceholder\}\s*\n\s*aria-label=\$\{context\.searchPlaceholder \|\| nothing\}/u);
});

test('the name comes from the label, then from what the page said about the host', () => {
  const body = component.slice(component.indexOf('accessibleName() {'), component.indexOf('get searchPlaceholder()'));
  const order = ["getProp('label')", "getAttribute('aria-label')", "getAttribute('aria-labelledby')", "label[for]"]
    .map((needle) => body.indexOf(needle));
  assert.ok(order.every((at) => at > 0), 'every source of a name is read');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in that order of precedence');
  assert.match(component, /accessibleName: this\.accessibleName\(\),/u);
});
