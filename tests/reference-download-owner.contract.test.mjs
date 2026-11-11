/* global process, URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Reference Link owns native navigation, complete geometry and BEM aliases', async () => {
  const css = await read('src/component/reference-link/scss/_css__reference_link.scss');
  const template = await read('src/smart/reference-link/js/templates/default.js');
  const rule = await read('src/component/reference-link/rule.js');
  const manifest = JSON.parse(await read('src/smart/reference-link/smart.manifest.json'));

  assert.match(css, /display: flex/);
  assert.match(css, /border: var\(--sf-px\)/);
  assert.match(css, /border-radius: var\(--sf-(?:reference-link|download-file)-radius, var\(--sf-radius--ui\)\)/);
  assert.match(css, /:has\([^}]*:focus-visible/s);
  assert.match(css, /\.sf-reference-link__link/);
  assert.match(css, /\.sf-reference-link-left/);
  assert.match(template, /<a class="sf-reference-link__link"/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(template, /href && !disabled/);
  assert.match(rule, /js: false/);
  assert.deepEqual(manifest.composition.uses, ['component.icons', 'component.reference-link', 'smart.icon']);
  assert.equal(manifest.contracts.navigation.disabled, 'non-interactive content with no href');
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Download File owns native/button semantics, canonical structure and tokens', async () => {
  const runtime = await read('src/component/download-file/js/_download-file.js');
  const css = await read('src/component/download-file/scss/_css_download-file.scss');
  const template = await read('src/smart/file-download/js/templates/default.js');
  const rule = await read('src/smart/file-download/rule.js');
  const manifest = JSON.parse(await read('src/smart/file-download/smart.manifest.json'));

  assert.match(runtime, /createElement\('span'\)/);
  assert.match(runtime, /sf-download-file__body/);
  assert.match(runtime, /sf-download-file__main/);
  assert.match(runtime, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(runtime, /^\s*console;\s*$/m);
  assert.match(css, /--sf-download-file--text-size: var\(--sf-text-size-1\)/);
  assert.match(css, /border: var\(--sf-px\)/);
  // The public variable carries the element's name; the former one is read
  // under it until 2027-01-01 (DF-11, journal token-file-download-variable-names).
  assert.match(css, /border-radius: var\(--sf-file-download-radius, var\(--sf-download-file-radius, var\(--sf-radius--ui\)\)\)/);
  // A data: or blob: address is never asked for its size (DF-15).
  assert.match(runtime, /if \(!href \|\| LOCAL_ADDRESS\.test\(href\) \|\| isSameDocument\(href\)\) return '';/);
  // C51: only an http(s) address on the page's own origin is asked.
  assert.match(runtime, /if \(!isSameOriginHttp\(href\)\) return '';/);
  // L2: an address that leads back to the page itself (#, #part) is no file either.
  assert.match(runtime, /function isSameDocument\(href\)/);
  // L3: while preparing, the status shrinks beside the name and wraps on whole lines.
  assert.match(css, /\.sf-download-file\.sf-download-file--preparing :where\(\.sf-download-file__meta\) \{[^}]*white-space: normal;/);
  // C51 return D1/D2: every row's facts go under the name when the row has no room (its own width decides).
  assert.match(css, /\.sf-download-file :where\(\.sf-download-file__text\) \{[^}]*flex-wrap: wrap;/);
  assert.match(css, /\.sf-download-file:focus-visible/);
  // C51: the row is as wide as its text (full-width fills), the name is
  // never cut -- it wraps -- and the type and size go under it on a phone.
  assert.match(css, /inline-size: fit-content;/);
  assert.match(css, /\.sf-download-file\.sf-download-file--full-width \{\s*inline-size: 100%;/);
  assert.doesNotMatch(css, /text-overflow: ellipsis|word-break: break-all/);
  // A name narrows to its longest word, never to letters (C51 return D1).
  assert.match(css, /overflow-wrap: break-word;/);
  assert.doesNotMatch(css, /overflow-wrap: anywhere;/);
  assert.match(css, /@media \(max-width: map\.get\(bp\.\$breakpoint-array, sm\)\)/);
  // What a screen reader hears: the hidden words, the seen facts aria-hidden.
  assert.match(runtime, /function spokenFileSize\(text, node = null\)/);
  assert.match(runtime, /metaNode\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(css, /--sf-download-file--padding-block: var\(--sf-ui-1--space-y-tightness-default\)/);
  assert.match(css, /--sf-download-file--icon-size: var\(--sf-text-height-1\)/);
  // A link while there is an href and the file is not disabled, else a button.
  assert.match(template, /const row = href && !disabled\s+\? html`\s+<a\b/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(rule, /name: 'icons'/);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  // The spinner and the ring of a file being prepared, the buttons in and
  // beside the row (decisions C25, C51); no notice any more.
  assert.deepEqual(manifest.composition.uses, ['component.download-file', 'component.icons', 'component.progress-ring', 'component.spinner', 'smart.button', 'smart.icon']);
  assert.ok(manifest.events['sf-file-download-request']);
  assert.ok(manifest.events['sf-file-download-download']);
  assert.ok(manifest.events['sf-download-file:click']);
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Reference and download documentation uses native destinations and decorative icons', async () => {
  const root = process.env.UI_DOC_ROOT;
  assert.ok(root, 'UI_DOC_ROOT is required');
  const reference = await readFile(`${root}/content/ru/components/content/reference-link.md`, 'utf8');
  const download = await readFile(`${root}/content/ru/components/actions/download-file.md`, 'utf8');
  const examples = await Promise.all([
    'examples/components/reference-link/overview/index.html',
    'examples/components/reference-link/state-disabled/index.html',
    'examples/components/download-file/overview/index.html',
    'examples/components/download-file/sizes/index.html',
    'examples/components/download-file/action/index.html',
    'examples/components/download-file/disabled/index.html',
    'examples/components/reference-link/state-focus/index.html',
    'examples/components/download-file/state-focus/index.html',
  ].map(path => readFile(`${root}/${path}`, 'utf8')));

  // The whole card is the native link's hit area and its focus ring.
  assert.match(reference, /Ссылка — настоящий `<a href>`; её область нажатия растягивается на всю\s+карточку/);
  assert.match(reference, /кольцо фокуса охватывает всю карточку/);
  assert.match(download, /sf-download-file:click/);
  assert.doesNotMatch(examples[1], /disabled[^>]*>[\s\S]*?<a\b/);
  assert.doesNotMatch(examples[5], /href=/);
  for (const html of examples) {
    for (const icon of html.matchAll(/<i class="[^"]*sf-icon[^"]*"([^>]*)>/g)) {
      assert.match(icon[1], /aria-hidden="true"/);
    }
  }
});

test('Download File keeps the focus when the button is redrawn as the link', async () => {
  const source = await read('src/smart/file-download/index.js');
  assert.match(source, /const REDRAWN_BY = new Set\(\['href', 'disabled', 'state', 'target'\]\);/u);
  // Read before the change draws anything, and only when the focus was on the file.
  const hook = source.slice(source.indexOf('attributeChangedCallback(name, oldValue, newValue) {'));
  assert.ok(hook.indexOf('this.holdsFocus()') < hook.indexOf('super.attributeChangedCallback'));
  assert.match(source, /return Boolean\(active && active !== this\.ownerDocument\.body && this\.contains\(active\)\);/u);
  // Only when the focus was lost with what held it: the row, or the button it now offers.
  assert.match(source, /if \(!active \|\| active === document\.body\) \{\n\s+const target = this\.focusTarget\(\);/u);
});

test('Download File fetches a late file only by a fresh press (decision C51)', async () => {
  const source = await read('src/smart/file-download/index.js');
  assert.match(source, /const FETCH_ITSELF_WITHIN = 10000;/u);
  assert.match(source, /const inTime = Date\.now\(\) - this\._pressedAt <= FETCH_ITSELF_WITHIN;/u);
  assert.match(source, /const inSight = this\.ownerDocument\.visibilityState !== 'hidden';/u);
  assert.match(source, /this\.sfEmit\('request', detail, \{ cancelable: true \}\)/u);
});
