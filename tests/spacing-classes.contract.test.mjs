import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
const SHEETS = ['component/buttons/scss/_css__buttons.scss', 'component/icon-buttons/scss/_css_icon_buttons.scss'];

/* `tightness-low` is the least inner space and `tightness-highest` the most, so
   the names read backwards and the documentation translated them the wrong way
   round. The Smart `spacing` attribute already names the steps by what they do;
   the classes now carry the same names, and the old ones stay beside them. */
test('spacing classes: every density selector takes the readable name too', async () => {
  const spacing = await read('core/js/control-spacing.js');
  const pairs = {low: 'compact', high: 'comfortable', highest: 'spacious'};
  for (const [legacy, readable] of Object.entries(pairs)) {
    assert.match(spacing, new RegExp(`${readable}: '${legacy}'`), `the Smart mapping agrees: ${readable} is ${legacy}`);
  }
  for (const file of SHEETS) {
    const css = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [legacy, readable] of Object.entries(pairs)) {
      const pair = `:is(.tightness-${legacy}, .spacing-${readable})`;
      const bare = css.split(pair).join('');
      assert.doesNotMatch(bare, new RegExp(`\\.tightness-${legacy}(?![-\\w])`), `${file}: tightness-${legacy} never stands alone`);
      assert.doesNotMatch(bare, new RegExp(`\\.spacing-${readable}(?![-\\w])`), `${file}: spacing-${readable} only beside its legacy name`);
      assert.equal(css.split(pair).length - 1, 5, `${file}: one rule per size for ${readable}`);
    }
  }
});

test('spacing classes: the constructors accept the readable option', async () => {
  for (const file of ['component/buttons/js/_buttons.js', 'component/icon-buttons/js/_icon-buttons.js']) {
    const source = await read(file);
    assert.match(source, /\['normal', 'compact', 'comfortable', 'spacious'\]\.includes\(spacing\)/, file);
    assert.match(source, /classList\.add\(`spacing-\$\{spacing\}`\)/, file);
    // spacing wins: the legacy class is written only when no valid spacing is given
    assert.match(source, /else if \(!hasSpacing && tightness\)/, file);
  }
});
