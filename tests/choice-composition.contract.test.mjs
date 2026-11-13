import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);

/* A checkbox, a radio and a switch put a mark before a label: the label
   follows at the row gap H2 of C105 (--sf-space-1/2: 12, compact and phone 8)
   at every size, as the text follows its picture in a list row, so a choice
   control in a form and in a list row line up (dispatcher ruling, R229 X1;
   owner decision C63 keeps the three on one row rule). Measured before C105:
   7, 8 and 10px for sizes 1/2, 1 and 2 at 1440. */
test('choice composition: the label follows the mark at the row gap', async () => {
  for (const [path, block] of [
    ['component/checkbox/scss/_css__checkbox.scss', 'checkbox'],
    ['component/radio/scss/_css_radio.scss', 'radio-button'],
    ['component/switch/scss/_css_switch.scss', 'switch'],
  ]) {
    const css = await read(path);
    for (const size of ['1\\/2', '1', '2']) {
      assert.match(css, new RegExp(`\\.sf-${block}--size-${size.replace(/[\\/]/g, (c) => '\\' + c)} \\{\\s*--sf-${block}--gap: var\\(--sf-space-1\\\\\\/2\\);`), `${block} ${size}`);
      assert.doesNotMatch(css, new RegExp(`--sf-${block}--gap: var\\(--sf-ui-`), `${block}: no text step left`);
    }
  }
});
