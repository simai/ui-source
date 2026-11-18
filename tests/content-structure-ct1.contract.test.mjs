import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Section Content, structure part (DEV letter msg-45546f2b, studies
// ui-control prototypes/content-*-study.html on pair 5.20261115.1622; owner
// decisions C228, C233): the rules the measured fixes rest on.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
// Every rule of the selector, joined: C273 writes a part's shape in
// sf.components and its paint in a sf.paint block of the same selector, and
// splits a border shorthand into its width and style there and its colour here
// (group build 10).
const block = (css, selector) => {
  const out = [];
  for (let start = css.indexOf(`${selector} {`); start >= 0; start = css.indexOf(`${selector} {`, start + 1)) {
    out.push(css.slice(start, css.indexOf('}', start) + 1));
  }
  return out.join('\n');
};
const layer = (css, name) => {
  const start = css.indexOf(`@layer ${name} {`);
  return start < 0 ? '' : css.slice(start);
};

const divider = strip(read('src/component/contentDivider/scss/_css__contentDivider.scss'));
const dividerScript = read('src/component/contentDivider/js/_contentDivider.js');
const doc = strip(read('src/component/doc/scss/_sf_css_doc.scss'));
const procedure = strip(read('src/component/procedure/scss/_css__procedure.scss'));
const reference = strip(read('src/component/reference-link/scss/_css__reference_link.scss'));
const template = read('src/smart/reference-link/js/templates/default.js');

test('divider R1: a vertical line is one text line at least, not a control height (C18)', () => {
  assert.match(divider, /--sf-divider--length: var\(--sf-text-height-1\);/u);
  assert.match(block(divider, '  .sf-divider-vertical'), /min-block-size: var\(--sf-divider--length\)/u);
  assert.match(block(divider, '  .sf-divider-vertical'), /align-self: stretch/u);
});

test('divider R2: the box reset stands in sf.base, below the utilities (C19)', () => {
  const base = divider.slice(divider.indexOf('@layer sf.base {'), divider.indexOf('@layer sf.components {'));
  assert.match(base, /\.sf-divider \{\s*box-sizing: border-box;\s*border: 0;\s*margin: 0;\s*padding: 0;/u);
  const root = block(layer(divider, 'sf.components'), '  .sf-divider');
  assert.doesNotMatch(root, /^\s+(?:margin|padding):/mu);
});

test('divider R3: the legacy button pair stands joined, no gap between its buttons', () => {
  assert.match(divider, /\.sf-divider-buttons:has\(> \.sf-divider-button\) \{\s*--sf-divider-buttons--gap: var\(--sf-0\);/u);
});

test('divider legacy buttons: 40 on the ladder with the border inside (C01), no fill of their own (C16)', () => {
  const button = block(divider, '  .sf-divider-button');
  assert.match(button, /box-sizing: border-box/u);
  assert.match(button, /min-block-size: var\(--sf-ui-1--control-height\)/u);
  assert.match(button, /background-color: var\(--sf-transparent\)/u);
});

test('C233: --small is an alias drawn as the plain caption, noted once until 2027-01-01', () => {
  assert.doesNotMatch(divider, /\.sf-divider-content--small \{/u);
  assert.match(dividerScript, /'sf-divider-content--small': 'sf-divider-content'/u);
  assert.match(dividerScript, /'sf-divider-content--small': '2026-11-16'/u);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'class-content-divider-small-c233');
  assert.ok(record, 'journal record');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map((item) => item.from), ['sf-divider-content--small']);
});

test('C228: the class accordion keeps its names; plates without a modifier, lines with --flush', () => {
  const accordion = read('src/component/accordion/scss/_css__accordion.scss');
  assert.match(accordion, /\.sf-accordion--flush/u);
});

test('doc D1: the example stands on the page, the source is the code surface (D20)', () => {
  const example = block(doc, '  .sf-doc-example,\n  .example');
  assert.doesNotMatch(example, /background/u);
  assert.match(example, /border-width: var\(--sf-px\);\s*border-style: solid;/u);
  assert.match(example, /border-color: var\(--sf-outline-variant\);/u);
  const source = block(doc, '  :is(.sf-doc-source, .source):not(.sf-code-surface, .sf-code-surface__scroll)');
  assert.match(source, /background-color: var\(--sf-highlight-background-color, var\(--sf-surface-container\)\)/u);
  assert.match(source, /border-style: solid;/u);
  assert.match(source, /border-color: var\(--sf-highlight-border-color, var\(--sf-outline-variant\)\)/u);
  assert.doesNotMatch(doc, /inverse/u);
});

test('doc D2: the seam rule stands after the source paint, so its top corners are square', () => {
  const paint = doc.indexOf('  :is(.sf-doc-source, .source):not(.sf-code-surface, .sf-code-surface__scroll) {');
  const seam = doc.indexOf('  :is(.sf-doc-example, .sf-playground, .example) + :is(');
  assert.ok(paint > 0 && seam > paint, 'seam after paint');
});

test('doc D3: the example resets only its inline and end margins', () => {
  const example = block(doc, '  .sf-doc-example,\n  .example');
  assert.doesNotMatch(example, /\bmargin: 0/u);
  assert.match(example, /margin-inline: 0;\s*margin-block-end: 0;/u);
});

test('doc D4: the source has the space-1 field and code at step 1/2 (C186 (10))', () => {
  const source = block(doc, '  :is(.sf-doc-source, .source):not(.sf-code-surface, .sf-code-surface__scroll)');
  assert.match(source, /padding: var\(--sf-space-1\)/u);
  const code = block(doc, '  :is(.sf-doc-source, .source):not(.sf-code-surface, .sf-code-surface__scroll) code');
  assert.match(code, /font-size: var\(--sf-text-size-1\\\/2\)/u);
  assert.match(code, /line-height: var\(--sf-text-height-1\\\/2\)/u);
});

test('procedure Pr1-Pr3: the sf-steps marks -- check when done, ring through a gap when current, muted ahead (C194, C101 (6))', () => {
  assert.match(block(procedure, '  .sf-procedure-step::before'), /var\(--sf-procedure-marker-color, var\(--sf-on-surface-variant\)\)/u);
  const done = block(procedure, '  .sf-procedure-step--complete::before');
  assert.match(done, /content: '';/u);
  assert.match(done, /var\(--sf-on-primary\) calc\(50% - var\(--sf-procedure--check\)\)/u);
  const current = block(procedure, '  .sf-procedure-step--current::before');
  assert.match(current, /background-color: var\(--sf-primary\)/u);
  assert.match(current, /color: var\(--sf-on-primary\)/u);
  assert.match(current, /outline: var\(--sf-procedure--ring\) solid var\(--sf-primary\)/u);
  assert.match(current, /outline-offset: var\(--sf-procedure--ring\)/u);
  assert.doesNotMatch(current, /box-shadow|primary-container/u);
  assert.match(procedure, /--sf-procedure--ring: calc\(var\(--sf-px\) \* 2\)/u);
});

test('reference C1/C2: the card route keeps its line; a disabled name is cut like a link', () => {
  assert.match(reference, /:where\(\.sf-reference-link__meta, \.sf-reference-link-text\) \{\s*flex: 0 100 auto;[^}]*white-space: nowrap;/u);
  assert.match(reference, /\.sf-reference-link-left > span:not\(\.sf-icon\)\) \{\s*display: -webkit-box;/u);
});

test('reference C3/C4: the line in text at ink 48, the ring 2 off and cloned (C186 (1), (4))', () => {
  assert.match(reference, /--inline :where\(\.sf-reference-link__label\) \{[^}]*text-decoration-color: color-mix\(in srgb, currentColor 48%, transparent\)/u);
  const ring = block(reference, '  .sf-reference-link.sf-reference-link--inline a.sf-reference-link__link:focus-visible');
  // C186 (4) exception to C212 (dispatcher 2026-11-18): links and crumbs keep the 2 px offset.
  assert.match(ring, /outline-offset: var\(--sf-a2\)/u);
  assert.match(ring, /box-decoration-break: clone/u);
});

test('reference C5/C6: the new-tab sign is arrow_outward; the icon and the first word are one run', () => {
  assert.match(template, /aria-hidden="true">arrow_outward<\/i>/u);
  assert.doesNotMatch(template, />open_in_new</u);
  assert.match(template, /<span class="sf-reference-link__start">\$\{iconPart\}\$\{split\[1\]\}<\/span>/u);
  assert.match(reference, /:where\(\.sf-reference-link__start\) \{\s*white-space: nowrap;/u);
});
