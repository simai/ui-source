import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

/* FW-LH-1 (DEV order msg-d56fa72b, owner decision C301 (2)): the open saved
   filter's name on «Фильтр» is cut with an ellipsis and said whole in a
   tooltip. sf-button 1.17.0: overflow="truncate" (the name and values of
   sf-list-description's overflow) and max-width; the class form is
   sf-button--truncate. tests/browser/button-truncate-c301.browser.mjs
   measures the cut and the tooltip on the built bytes. Plus the list head's
   notes on the parts: an interactive sf-tag is never a toggle, and sf-popover
   leaves data-open to the page. */
test('truncate: sf-button declares overflow and max-width', () => {
  const manifest = json('src/smart/button/component.json');
  assert.deepEqual(manifest.settings.overflow.values, ['wrap', 'truncate']);
  assert.equal(manifest.settings.overflow.default, 'wrap');
  assert.equal(manifest.settings['max-width'].type, 'string');
  assert.equal(manifest.settings['max-width'].default, '');
  // The same word and values as sf-list-description's overflow.
  assert.deepEqual(json('src/smart/list-description/component.json').settings.overflow.values, ['wrap', 'truncate']);
  assert.ok(manifest['css-variables']['--sf-button-max-width'], 'the public variable is declared');
  const contract = json('src/core/contracts/public-variables.v1.json').components.find((one) => one.component === 'button');
  assert.ok(contract.variables.some((one) => one.name === '--sf-button-max-width' && one.role === 'max-inline-size'));
  const relation = manifest.relations.find((one) => one.name === 'tooltip');
  assert.equal(relation?.lazy, true, 'the tooltip controller is fetched when a label is cut');
  assert.match(read('src/smart/button/rule.js'), /name: 'tooltip', lazy: true/u);
  assert.ok(json('src/smart/button/examples.json').examples.some((one) => one.name === 'truncate' && one.settings.overflow === 'truncate'));
});

test('truncate: the sheet cuts the label on one line at the smaller of max-width and the container', () => {
  const sheet = read('src/component/buttons/scss/_css__buttons_custom.scss');
  const block = (selector) => {
    const at = sheet.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    return sheet.slice(at, sheet.indexOf('}', at));
  };
  const root = block('.sf-button.sf-button--truncate');
  assert.match(root, /max-inline-size: min\(var\(--sf-button--max-width, var\(--sf-button-max-width, 100%\)\), 100%\);/u);
  assert.match(root, /min-inline-size: 0;/u);
  const label = block('.sf-button.sf-button--truncate > .sf-button-text-container');
  for (const rule of ['min-inline-size: 0;', 'overflow: hidden;', 'text-overflow: ellipsis;', 'white-space: nowrap;']) assert.ok(label.includes(rule), rule);
  assert.match(block('.sf-button.sf-button--truncate > :not(.sf-button-text-container)'), /flex-shrink: 0;/u);
});

test('truncate: the template writes the class, the internal width and the cut tooltip', () => {
  const template = read('src/smart/button/js/templates/default.js');
  assert.match(template, /context\.overflow === 'truncate' \? 'sf-button--truncate' : ''/u);
  // On the button and on the link: data-tooltip names the hidden tooltip.
  assert.equal(template.match(/data-tooltip=\$\{context\.cutTooltipId \|\| nothing\}/gu)?.length, 2);
  assert.match(template, /class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-button-tooltip" aria-hidden="true" hidden>/u);
  assert.match(template, /\$\{endContent\}\$\{renderCutTooltip\(context\)\}/u);
  const source = read('src/smart/button/index.js');
  // max-width goes into the internal variable; the public one stays the page's.
  assert.match(source, /return `--sf-button--max-width: \$\{width\}`;/u);
  assert.match(source, /if \(!width \|\| \/\[;\{\}<>"\\\\\]\/u\.test\(width\)\) return "";/u, 'a value that could close the declaration is dropped');
  // The cut is read from the label, watched with a ResizeObserver.
  assert.match(source, /const cut = Boolean\(label && label\.scrollWidth - label\.clientWidth > 0\.5\);/u);
  assert.match(source, /new ResizeObserver\(\(\) => this\.measureCut\(\)\)/u);
  assert.match(source, /globalThis\.SF\?\.Loader\?\.ensurePlugin\?\.\("tooltip"\)/u);
  // The tooltip says the host's title when there is one, else the whole label.
  assert.match(source, /cutText\(\) \{\s+const title = String\(this\.getAttribute\("title"\) \|\| ""\)\.trim\(\);\s+if \(title\) return title;/u);
  // The browser's title is not drawn over a cut label's tooltip.
  assert.match(source, /else button\.setAttribute\("title", this\._sfCut \? "" : this\.getAttribute\("title"\)\);/u);
  assert.match(source, /"overflow",\s+"max-width",[\s\S]{0,200}"title",/u, 'title, overflow and max-width are not forwarded as plain attributes');
});

test('list head notes: an interactive bare tag is never a toggle', () => {
  const source = read('src/smart/tag/index.js');
  assert.match(source, /function bareToggle\(element\) \{[\s\S]{0,400}?if \(isInteractive\(element\)\) return false;/u);
  assert.match(source, /function isInteractive\(element\) \{\s+return Boolean\(element\?\.hasAttribute\?\.\('interactive'\)\) && normalize\(element\.getAttribute\('interactive'\)\) !== 'false';/u);
});

test('list head notes: sf-popover leaves data-open to the page and draws by its open attribute', () => {
  const source = read('src/smart/popover/index.js');
  assert.doesNotMatch(source, /this\.dataset\.open\s*=/u);
  const sheet = read('src/smart/popover/js/templates/default.css');
  assert.match(sheet, /sf-popover:not\(\[open\]\) > \[slot='content'\] \{\s+display: none(?: !important)?;/u);
  assert.doesNotMatch(sheet, /\[data-open='false'\]/u);
  assert.doesNotMatch(read('src/smart/input-rich/scss/_smart__rich_text.scss'), /sf-rich-text-link[^{]*data-open/u);
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'behaviour-popover-data-open-retired');
  assert.equal(record?.stage, 'removed');
  assert.equal(json('src/smart/popover/component.json').values.open.reflect, true, 'open is reflected, so the sheet can read it');
});
