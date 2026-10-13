import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/component/${path}`, import.meta.url), 'utf8');

/* A filled field reads as a field only by its fill. While focus is inside it
   becomes the ordinary field: the bordered surface and a visible boundary.
   Measured after the change on the built bytes: input and textarea go from the
   12% fill to the surface with the focus border, an open filled dropdown looks
   like an open outlined one, and a filled code field turns its cells bordered
   with the current cell marked. */
test('filled fields: focus inside turns the field into the ordinary one', async () => {
  const input = await read('inputs/scss/_css__inputs.scss');
  assert.match(input, /@layer sf\.states \{[^]*\.sf-input:not\(\.error\)\.sf-input--filled:has\(input:enabled:not\(:disabled\):not\(\.disabled\):not\(:read-only\):focus-within\) \.sf-input-field \{\s*--sf-input-field--background-color: var\(--sf-surface-0\);/);
  const textarea = await read('textarea/scss/_css__textarea.scss');
  assert.match(textarea, /\.sf-textarea:not\(\.error\)\.sf-textarea--filled:has\(textarea:enabled:not\(:disabled\):not\(\.disabled\):not\(:read-only\):focus-within\) textarea \{\s*--sf-textarea-textarea--background-color: var\(--sf-surface-0\);/);
  const dropdown = await read('dropdown/scss/_css__dropdown.scss');
  assert.match(dropdown, /\.sf-dropdown\.sf-dropdown\.sf-dropdown--filled:not\(\.error\):not\(:has\(> \.sf-dropdown-field > :disabled\)\):is\(\.open, :focus-within\) \.sf-dropdown-field\.sf-dropdown-field \{\s*--sf-dropdown-field--background-color: var\(--sf-surface-0\);\s*--sf-dropdown-field--border-color: var\(--sf-outline\);/);
  const verification = await read('verification/scss/_css__verification.scss');
  assert.match(verification, /\.sf-verification--filled:not\(\.error\):has\(\.sf-verification-input:enabled:focus\) \.sf-verification-cell,/);
  assert.match(verification, /\.sf-verification--filled:not\(\.error\):has\(\.sf-verification-input:enabled:focus\) \.sf-verification-cell\.current,/);
});

test('filled fields: the focused field keeps a visible boundary without the pointer', async () => {
  const input = await read('inputs/scss/_css__inputs.scss');
  assert.match(input, /\.sf-input:not\(\.error\)\.sf-input--filled:has\(input:focus-within\) \.sf-input-field \{\s*--sf-input-field--border-color: var\(--sf-outline\);/);
  const textarea = await read('textarea/scss/_css__textarea.scss');
  assert.match(textarea, /\.sf-textarea:not\(\.error\)\.sf-textarea--filled:has\(textarea:focus-within\) textarea \{\s*--sf-textarea-textarea--border-color: var\(--sf-outline\);/);
});

