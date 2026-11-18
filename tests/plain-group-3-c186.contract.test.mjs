import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {russianWords} from './support/russian-language-file.mjs';

// Owner decision C186 (2026-11-14): links, text flow, the code block and the
// headings -- plain group 3 (study control/research/2026-11-14-plain-group-3.md
// and prototypes/plain-group-3-study.html in ui-control). The built sheets are
// measured by the probe in the build's evidence; this holds the source.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// The rules alone: the comments tell what a rule replaced and name it.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const link = read('src/core/scss/_sf_css__link.scss');
const linkVars = read('src/core/scss/vars/_sf_var__link.scss');
const typography = read('src/core/scss/_sf_css__typograpy.scss');
const sfLink = read('src/component/link/scss/_css__link.scss');
// The palette moved to core in highlight 1.7.0 (DEV msg-75ee8dec).
const highlightTheme = read('src/core/scss/_sf_css__code_palette.scss');
const highlight = read('src/component/highlight/scss/_default.scss');
const wordBreak = read('src/utility/word-break/default/scss/_sf_css__word_break.scss');
const contract = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json'));
const roles = read('src/core/figma_variables/figma_typography_roles.scss');

test('C186 (1): a link in text is underlined at ink 48, full on hover; none in navigation and tables until hover', () => {
  assert.match(link, /--sf-link--underline-ink: 48%;/u);
  // RG-UT-V LNK-4: a link- class is read at the start of a class name.
  assert.match(link, /\[class\*=':link-'\] ~ a \{[^}]*text-decoration-line: underline;[^}]*text-decoration-color: color-mix\(in srgb, currentColor var\(--sf-link--underline-ink\), transparent\);/su);
  assert.match(link, /:where\(nav, menu, \[role='navigation'\][^)]*table[^)]*\) a:not\(\[class\]\) \{\s*text-decoration-line: none;\s*&:is\(:hover, :focus-visible\) \{\s*text-decoration-line: underline;/su);
  assert.match(sfLink, /text-decoration-color: color-mix\(in srgb, currentColor var\(--sf-link--underline-ink, 48%\), transparent\);/u);
  assert.match(sfLink, /\.sf-link:hover[^{]*\{[^}]*--sf-link--text-decoration: underline;/su, 'sf-link keeps its line under the pointer');
  assert.doesNotMatch(sfLink, /--sf-link--text-decoration: none;\s*\}\s*\.sf-link:active/su);
});

test('C186 (2): no visited colour by default; data-sf-visited="on" turns it on', () => {
  assert.doesNotMatch(linkVars, /^\s*visited:/mu, 'no visited step in the arrays');
  assert.match(link, /:where\(\[data-sf-visited='on'\]\) \{[\s\S]*&:visited \{\s*color: var\(--sf-place--ink, var\(--sf-link-visited\)\);/u);
  assert.match(sfLink, /:where\(\[data-sf-visited='on'\]\) \.sf-link:visited/u);
  assert.doesNotMatch(sfLink, /^\s*\.sf-link:visited/mu);
});

test('C186 (3): a new-tab link gets arrow_outward after its last word and the words for a screen reader', async () => {
  const index = read('src/core/js/index.js');
  assert.match(index, /import '\.\/new-tab-link\.js';/u);
  const module = read('src/core/js/new-tab-link.js');
  assert.doesNotMatch(module, /from '\.\.\/\.\.\/smart\//u, 'core does not import a Smart component');
  const {WORDS, opensNewTab} = await import('../src/core/js/new-tab-link.js');
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(read(`src/smart/file-download/lang/${locale}.json`)).runtime;
    // English is built in; Russian is core's language file (C282).
    const own = locale === 'en' ? WORDS.en : russianWords('core/js/lang/new-tab');
    assert.equal(own['new-tab-text'], words['new-tab-text'], `${locale} new-tab-text is sf-file-download's`);
  }
  assert.equal(russianWords('core/js/lang/new-tab')['new-tab-text'], '(откроется в новой вкладке)');
  assert.deepEqual(Object.keys(WORDS), ['en'], 'the bundle says English only');
  // The mark: the text's size, 4 from the word, one unbreakable run with it.
  assert.match(link, /a \[data-sf-new-tab='mark'\] \{[^}]*--sf-icon--font-size: 1em;[^}]*margin-inline-start: var\(--sf-space-1\\\/4\);[^}]*text-decoration: none;/su);
  assert.match(link, /a \[data-sf-new-tab='tail'\] \{\s*white-space: nowrap;/u);
  assert.match(link, /a \[data-sf-new-tab='words'\] \{[^}]*position: absolute;[^}]*clip-path: inset\(50%\);/su);
  assert.match(module, /const GLYPH = 'arrow_outward';/u);
  // Which links: a link in text that opens a new tab, not a component's own.
  const element = (attributes, cls = '', parentCls = '') => ({
    localName: 'a',
    hasAttribute: (name) => name in attributes,
    getAttribute: (name) => (name === 'class' ? cls : attributes[name] ?? null),
    parentElement: {getAttribute: () => parentCls},
  });
  assert.equal(opensNewTab(element({href: '/', target: '_blank'})), true);
  assert.equal(opensNewTab(element({href: '/', target: '_blank'}, 'sf-link')), true);
  assert.equal(opensNewTab(element({href: '/', target: '_blank'}, 'link-dotted')), true);
  assert.equal(opensNewTab(element({href: '/'})), false, 'the same tab: no mark');
  assert.equal(opensNewTab(element({href: '/', target: '_blank'}, 'sf-button')), false, 'a component\'s link');
  assert.equal(opensNewTab(element({href: '/', target: '_blank'}, '', 'sf-reference-link__main')), false, 'inside a component');
});

test('C186 (4): the ring of a link is 2px --sf-focus, 2 off the words, corner 4, around each line', () => {
  assert.match(link, /&:focus-visible \{\s*outline-offset: var\(--sf-focus--offset\);\s*border-radius: var\(--sf-radius--ui\);\s*-webkit-box-decoration-break: clone;\s*box-decoration-break: clone;/u);
  assert.doesNotMatch(link, /^\s*outline: none;/mu);
  assert.match(sfLink, /\.sf-link:focus-visible \{[^}]*outline-offset: var\(--sf-focus--offset\);/su);
});

test('C186 (5): on a strong place a link is the place ink, underlined', () => {
  assert.match(link, /color: var\(--sf-place--ink, var\(--sf-link\)\);/u);
  for (const step of ['hover', 'active']) assert.match(linkVars, new RegExp(`${step}: var\\(--sf-place--ink, var\\(--sf-link-${step}\\)\\)`, 'u'));
  assert.match(sfLink, /--sf-link--color: var\(--sf-place--ink, var\(--sf-link\)\);/u);
});

test('C186 (6): hyphenation in narrow running text and text-hyphens; never headings, code, names, addresses', () => {
  assert.match(typography, /@media not all and \(min-width: 60rem\) \{\s*:where\(p, li, dd, blockquote, figcaption\) \{\s*-webkit-hyphens: auto;\s*hyphens: auto;/u);
  assert.match(typography, /@container \(max-width: #\{mq\.container-step\(h0\)\}\) \{\s*:where\(p, li, dd, blockquote, figcaption\) \{\s*-webkit-hyphens: auto;\s*hyphens: auto;/u);
  const manual = /:where\(([^)]*(?:\([^)]*\)[^)]*)*)\) \{\s*-webkit-hyphens: manual;\s*hyphens: manual;/u.exec(typography);
  assert.ok(manual, 'the exclusions are manual');
  for (const part of ['h1', 'h6', '.sf-h-1', 'code', 'pre', 'address', "a[href^='mailto:']", "[translate='no']"]) assert.ok(manual[1].includes(part), `${part} is never hyphenated`);
  assert.match(wordBreak, /\.#\{\$infix\}text-hyphens \{\s*-webkit-hyphens: auto;\s*hyphens: auto;/u);
});

test('C186 (7): overflow-wrap: anywhere on paragraphs, lists and table cells; no deprecated break-word', () => {
  assert.match(typography, /blockquote \{\s*overflow-wrap: anywhere;/u);
  assert.match(typography, /table \{\s*word-break: normal;\s*overflow-wrap: anywhere;\s*\}/u);
  assert.doesNotMatch(code(typography), /word-break: break-word/u);
});

test('C186 (8): one text-* family; the former names are dated aliases the Loader notes', async () => {
  const rule = read('src/utility/word-break/default/rule.js');
  const regex = new Function('SF', `${rule}; return SF.RuleLoader['word-break/default'];`)({RuleLoader: {}});
  for (const name of ['text-break', 'text-break-normal', 'text-hyphens', 'text-break-word', 'text-break-all']) assert.ok(regex.test(name), `${name} loads the sheet`);
  assert.equal(regex.test('text-breakage'), false);
  assert.match(wordBreak, /\.#\{\$infix\}text-break \{\s*overflow-wrap: anywhere;/u);
  const {UTILITY_CLASS_ALIASES, UTILITY_CLASS_ALIAS_DATES, noteUtilityClassAlias} = await import('../src/core/js/utility-class-aliases.js');
  assert.deepEqual({...UTILITY_CLASS_ALIASES}, {'wrap-none': 'text-nowrap', 'text-break-word': 'text-break', 'text-break-all': 'text-break', 't-ellipsis': 'truncate', 't-clip': 'truncate'});
  assert.equal(UTILITY_CLASS_ALIAS_DATES.remove_after, '2027-01-01');
  assert.equal(noteUtilityClassAlias('truncate'), null);
  const {listDeprecations} = await import('../src/core/js/deprecations.js');
  assert.equal(noteUtilityClassAlias('wrap-none'), 'text-nowrap');
  assert.ok(listDeprecations().some((note) => note.from === 'wrap-none' && note.to === 'text-nowrap' && note.remove_after === '2027-01-01'));
  assert.match(read('src/core/js/loader.js'), /noteUtilityClassAlias\(token\);/u);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'class-text-flow-utility-aliases');
  assert.ok(record, 'the journal records the aliases');
  assert.deepEqual(record.items.map(({from, to}) => `${from}>${to}`).sort(), Object.entries(UTILITY_CLASS_ALIASES).map(([from, to]) => `${from}>${to}`).sort());
});

test('C186 (9): h1-h4 balance, running text pretty', () => {
  assert.match(typography, /:where\(h1, h2, h3, h4, \.sf-h-1, \.sf-h-2, \.sf-h-3, \.sf-h-4\) \{\s*text-wrap: balance;/u);
  assert.match(typography, /:where\(p, li, dd, blockquote, figcaption\) \{\s*text-wrap: pretty;/u);
});

test('C186 (10): code in a block is step 1/2 in the system mono', () => {
  assert.match(highlight, /:is\(\.sf-highlight, \.source\) code \{\s*font-family: var\(--sf-code-font-family, var\(--sf-code--font-family\)\);\s*font-size: var\(--sf-text-size-1\\\/2\);\s*line-height: var\(--sf-text-height-1\\\/2\);/u);
  assert.doesNotMatch(code(highlight), /--sf-text-medium--line-height/u, 'the undeclared variable is gone');
});

test('C186 (11): code hues from the static palette, tones 40/80, 4.5:1 or more', () => {
  const expected = {keyword: 'violet', string: 'green', attribute: 'blue', title: 'amber', 'built-in': 'teal', tag: 'green'};
  for (const [role, hue] of Object.entries(expected)) {
    assert.match(highlightTheme, new RegExp(`--sf-highlight-${role}: light-dark\\(var\\(--sf-${hue}-40\\), var\\(--sf-${hue}-80\\)\\);`, 'u'), role);
  }
  for (const status of ['error', 'info', 'warning', 'success', 'tertiary']) {
    assert.doesNotMatch(highlightTheme, new RegExp(`--sf-highlight-(?:keyword|title|attribute|string|built-in|tag): var\\(--sf-${status}\\)`, 'u'));
  }
  // Each tone against the page it stands on: white, and neutral 5 dark.
  const palette = read('src/core/scss/_sf_static_palette.scss') + read('src/core/scss/_sf_figma_colors_variables.scss');
  const hex = (name) => /#([0-9a-f]{6})/iu.exec(new RegExp(`--sf-${name}:\\s*(#[0-9a-f]{6})`, 'iu').exec(palette)[1])[1];
  const lum = (h) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const hue of new Set(Object.values(expected))) {
    assert.ok(ratio(hex(`${hue}-40`), 'ffffff') >= 4.5, `${hue}-40 on white`);
    assert.ok(ratio(hex(`${hue}-80`), hex('neutral-10')) >= 4.5, `${hue}-80 on the dark`);
  }
});

test('C186 (12): long code lines scroll and the head keeps its wrap button', () => {
  assert.match(read('src/component/highlight/js/index.js'), /sf-highlight__wrap-toggle/u);
  assert.match(highlight, /\.sf-code-surface__scroll \{[^}]*overflow: auto;/su);
});

test('C186 (13): h3 takes the 24 line on a phone, 28 on a desktop; C21 sizes unchanged', () => {
  const h3 = contract.typography.roles.heading['3'];
  assert.equal(h3.size, '3');
  assert.equal(h3.height, '3');
  assert.equal(h3.mobileHeight, '4');
  assert.equal(contract.typography.titleLineHeights['4'].mobile, 'c2', 'title line 4 on a phone is 24');
  assert.equal(contract.typography.titleLineHeights['3'].desktop, 'c4', 'title line 3 on a desktop is 28');
  const [phone, desktop] = roles.split('@media (min-width: 60rem)');
  assert.match(phone, /--sf-heading-3--height: var\(--sf-title--height-4\);/u);
  assert.match(desktop, /--sf-heading-3--height: var\(--sf-title--height-3\);/u);
});

test('C186 (14): .sf-h-1..6 is the heading look; .title-N a text size, 7..12 the display rung; headers holds headings only', () => {
  assert.doesNotMatch(read('src/utility/headers/default/scss/index.scss'), /sf_ext__common/u);
  assert.doesNotMatch(code(read('src/utility/headers/default/scss/_css__headers.scss')), /@use[^;]*sf_ext__common/u);
  const title = read('src/utility/title/default/scss/_sf_css__title.scss');
  assert.match(title, /not a heading/u);
  assert.match(title, /\.title-7\.\.12 are larger than h1: the display rung/u);
  const styles = read('src/core/figma_variables/figma_typography_styles.scss');
  for (let level = 1; level <= 6; level += 1) assert.match(styles, new RegExp(`\\.sf-h-${level}, h${level} \\{`, 'u'));
});
