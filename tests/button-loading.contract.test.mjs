import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const bare = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const buttons = bare(await read('src/component/buttons/scss/_css__buttons_custom.scss'));
const iconButtons = bare(await read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss'));
const SIZES = ['1\\/3', '1\\/2', '1', '2', '3'];

/* The spinner is the one loading indicator (simai/ui-source#10). A loading
   button shows it at its icon's size, so its slot is the icon's box at every
   step -- the same tokens as `.sf-button--size-N .sf-icon` -- drawn by the
   button sheets themselves, so the box is right before the spinner sheet has
   arrived. The probe button-loading measures it. */
test('button loading: the spinner slot is the icon box of every step', () => {
  for (const [css, block] of [[buttons, 'sf-button'], [iconButtons, 'sf-icon-button']]) {
    assert.ok(css.includes(`.${block} {\n    --${block}-spinner--size: var(--sf-icon-size-3);`) || css.includes(`.${block} {\n  --${block}-spinner--size: var(--sf-icon-size-3);`), `${block}: the default slot is the default icon`);
    for (const step of SIZES) {
      assert.ok(css.includes(`.${block}.${block}--size-${step} {\n${block === 'sf-button' ? '  ' : '    '}--${block}-spinner--size: var(--sf-text-height-${step});`), `${block} ${step}: the slot is the icon of the step`);
    }
    assert.match(css, new RegExp(`inline-size: var\\(--${block}-spinner--size\\);\\s*block-size: var\\(--${block}-spinner--size\\);`));
    assert.doesNotMatch(css, /(?<![\w-])(?:\d*\.)?\d+(?:px|rem|em)\b/, `${block}: dimensions on system tokens`);
  }
});

/* Without an icon the spinner lies over the label: the label keeps its place,
   so the button keeps its width, and stays in the accessibility tree (painted
   transparent, never hidden). */
test('button loading: without an icon the spinner overlays the label, which stays named', () => {
  assert.match(buttons, /\.sf-button > \.sf-button-spinner--overlay \{\s*position: absolute;\s*inset: 0;\s*margin: auto;/);
  assert.match(buttons, /\.sf-button > \.sf-button-spinner--overlay ~ \* \{\s*color: transparent;\s*-webkit-text-fill-color: transparent;/);
  assert.doesNotMatch(buttons, /visibility:\s*hidden|display:\s*none/, 'the label is never removed from the accessibility tree');
});

/* The stripes are gone as the loading look: nothing animates them and the
   Framework no longer sets their variables. A page that sets one still gets
   still stripes in it until the sweep (journal token-button-loading-stripe). */
test('button loading: the stripes are only read, never set or animated', async () => {
  for (const [css, name] of [[buttons, '--sf-button-loading-stripe'], [iconButtons, '--sf-icon-button-loading-stripe']]) {
    assert.doesNotMatch(css, new RegExp(`${name}\\s*:`), `${name} is not set`);
    assert.match(css, new RegExp(`var\\(${name}, transparent\\)`), `${name} is still read`);
    assert.doesNotMatch(css, /stripes-slide|animation:/);
  }
  const journal = JSON.parse(await read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'token-button-loading-stripe');
  assert.ok(record && record.stage === 'compat', 'recorded in the journal');
  assert.deepEqual(record.items.map((item) => item.from).sort(), ['--sf-button-loading-stripe', '--sf-icon-button-loading-stripe']);
});

/* Every loading button draws the same spinner: the Smart templates, the
   ordinary constructors and the group's segments take it from one drawing. */
test('button loading: every button draws the one spinner', async () => {
  for (const path of [
    'src/smart/button/js/templates/default.js',
    'src/smart/icon-buttons/js/templates/default.js',
    'src/smart/button-group/js/templates/default.js',
    'src/component/buttons/js/_buttons.js',
    'src/component/icon-buttons/js/_icon-buttons.js',
  ]) {
    const source = await read(path);
    assert.match(source, /import \{ ?createInlineSpinner ?\} from '[./]+(?:component\/)?spinner\/js\/_spinner-draw'/, `${path} imports the drawing`);
    assert.match(source, /createInlineSpinner\(\{ ?className: 'sf-(?:icon-)?button-spinner'/, path);
  }
  const group = await read('src/smart/button-group/js/templates/default.js');
  assert.match(group, /aria-busy=\$\{item\.loading \? 'true' : nothing\}/);
  assert.match(group, /\?loading=\$\{item\.loading\}/);
});
