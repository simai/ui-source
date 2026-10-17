import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);

/* A checkbox, a radio and a switch put a mark before a label: the label follows
   at the size's text step, the step a dropdown option keeps after its picture,
   so a tick in a form and a tick in a list read the same. Measured before: 4, 8
   and 12px for sizes 1/2, 1 and 2, but 8 for a size 2 radio. */
test('choice composition: the label follows the mark at the text step', async () => {
  for (const [path, block] of [
    ['component/checkbox/scss/_css__checkbox.scss', 'checkbox'],
    ['component/radio/scss/_css_radio.scss', 'radio-button'],
    ['component/switch/scss/_css_switch.scss', 'switch'],
  ]) {
    const css = await read(path);
    for (const size of ['1\\/2', '1', '2']) {
      assert.match(css, new RegExp(`\\.sf-${block}--size-${size.replace(/[\\/]/g, (c) => '\\' + c)} \\{\\s*--sf-${block}--gap: var\\(--sf-ui-${size.replace(/[\\/]/g, (c) => '\\' + c)}--text-space-x\\);`), `${block} ${size}`);
    }
  }
});
