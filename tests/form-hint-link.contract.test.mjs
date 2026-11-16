import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-form follow-up (msg-a1474963): the hint the form draws under a field is
// read with the field. The browser check is the area-e probe (hint id in the
// native control's aria-describedby, the error replacing it, the control's
// own ids kept).
const source = readFileSync(new URL('../src/smart/form/index.js', import.meta.url), 'utf8');

test('the form links its hint and error lines to the control after every drawing', () => {
  assert.match(source, /linkMessages\(\) \{/u);
  // After the form's own drawing and after a control's (which may rewrite the attribute).
  assert.match(source, /this\.linkMessages\(\);\n  \}/u);
  assert.match(source, /addEventListener\('sf-after-render', this\._onControlDrawn\)/u);
  assert.match(source, /removeEventListener\('sf-after-render', this\._onControlDrawn\)/u);
  // The lines are the form's own, found by class and id; stale ones of the field leave.
  assert.match(source, /node\.matches\('\.sf-form-hint, \.sf-form-error'\)/u);
  assert.match(source, /!id\.endsWith\(`--hint-\$\{key\}`\) && !id\.endsWith\(`--error-\$\{key\}`\)/u);
});
