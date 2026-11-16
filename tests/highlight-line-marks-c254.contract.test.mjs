// Code block line marks (component.highlight 1.7.0): owner decisions
// C254-C258 and the study prototypes/highlight-features-study.html (ui-control).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {splitLines} from '../src/component/highlight/js/line_numbers.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runtime = read('src/component/highlight/js/index.js');
const defaults = read('src/component/highlight/scss/_default.scss');
const theme = read('src/component/highlight/scss/_theme.scss');
const palette = read('src/core/scss/_sf_css__code_palette.scss');

// The marker pattern as the runtime declares it.
const MARKER = new RegExp(eval(runtime.match(/const LINE_MARKER = (\/.*\/u);/u)[1]));

test('C258: Shiki markers in any comment syntax, with a count, and nothing else', () => {
  const cases = [
    ['const a = 1; // [!code ++]', '++', undefined],
    ['b = 2  # [!code --]', '--', undefined],
    ['<p>x</p> <!-- [!code highlight] -->', 'highlight', undefined],
    ['x(); /* [!code focus:3] */', 'focus', '3'],
    ['-- [!code hl]', 'hl', undefined],
  ];
  for (const [line, kind, count] of cases) {
    const match = MARKER.exec(line);
    assert.ok(match, line);
    assert.equal(match[1], kind);
    assert.equal(match[2], count);
  }
  assert.equal(MARKER.exec("const s = '[!code ++] in a string';"), null);
  assert.equal(MARKER.exec('// [!code word:x]'), null);
  // Markdown shows markers; [!!code] is the escape.
  assert.match(runtime, /LITERAL_LANGUAGES = new Set\(\['markdown', 'md'\]\)/u);
  assert.match(runtime, /replaceAll\('\[!!code ', '\[!code '\)/u);
  // Block attributes, read from code, pre or the root.
  for (const name of ['data-mark', 'data-focus', 'data-add', 'data-remove', 'data-frame']) assert.match(runtime, new RegExp(`'${name}'`, 'u'));
});

test('C255, C257: copy leaves removed lines and terminal output behind', () => {
  assert.match(runtime, /line\.skip = line\.diff === 'remove' \|\| line\.output/u);
  assert.match(read('src/component/highlight/js/line_numbers.js'), /row\.dataset\.copy = 'false'/u);
  const helper = read('src/core/js/copy-feedback.js');
  const reader = helper.slice(helper.indexOf('export function readCopyText'), helper.indexOf('export function selectCopySource'));
  assert.match(reader, /dataset\?\.copy !== 'false'/u);
  // Signs and prompts are the stylesheet's, so they are never in the text.
  assert.match(defaults, /content: '\+' \/ '';/u);
  assert.match(defaults, /content: '\\2212' \/ '';/u);
  assert.match(defaults, /content: '\$' \/ '';/u);
  // The terminal head names itself in the block's language.
  for (const code of ['ru', 'en', 'kk']) {
    const words = JSON.parse(read(`src/component/highlight/lang/${code}.json`)).runtime;
    for (const key of ['added', 'removed', 'terminal']) assert.ok(words[key], `${code} ${key}`);
  }
});

test('C258: the Loader leaves [!name] inside code as text', () => {
  const loader = read('src/core/js/loader.js');
  assert.match(loader, /const SHORTCODE_SKIPPED = '[^']*\bpre, code\b/u);
  assert.match(loader, /host\?\.closest\?\.\('pre, code'\)\) return;/u);
});

test('C255, C256: tints from roles, a 2 px start bar, no dimming or blur', () => {
  assert.match(defaults, /\[data-line-diff='add'\] \{\s*background: var\(--sf-highlight-addition-background\);/u);
  assert.match(defaults, /\[data-line-diff='remove'\] \{\s*background: var\(--sf-highlight-deletion-background\);/u);
  const marked = defaults.slice(defaults.indexOf('.sf-code-line:is([data-line-mark], [data-line-focus])'));
  assert.match(marked, /linear-gradient\(var\(--sf-primary\), var\(--sf-primary\)\) left \/ calc\(2 \* var\(--sf-px\)\) 100% no-repeat,\s*var\(--sf-primary-container\);/u);
  assert.doesNotMatch(defaults, /\.sf-code-line[^{]*\{[^}]*(?:opacity|filter):/u);
});

test('study F2, F3: rows carry the side room; the divider role is gone', () => {
  assert.match(defaults, /\.sf-code-line \{\s*display: flex;\s*padding-inline: var\(--sf-space-1\);/u);
  assert.match(defaults, /\.sf-code-surface__scroll:has\(> code > \.sf-code-lines\) \{\s*padding-inline: 0;/u);
  assert.doesNotMatch(`${theme}${palette}`, /--sf-highlight-line-divider:/u);
  assert.match(defaults, /var\(--sf-highlight-line-divider, var\(--sf-outline-variant\)\)/u);
});

test('a token over several lines keeps its colour on every row', () => {
  const rows = splitLines('<span class="hljs-comment">/* a\nb */</span> x\ny');
  assert.deepEqual(rows, ['<span class="hljs-comment">/* a</span>', '<span class="hljs-comment">b */</span> x', 'y']);
});

test('DEV msg-75ee8dec: the palette is core, the token roles are attribute aliases', () => {
  assert.match(read('src/core/scss/index.scss'), /@use 'sf_css__code_palette';/u);
  assert.doesNotMatch(theme, /--sf-highlight-keyword:/u);
  for (const role of ['number', 'property', 'operator', 'variable']) {
    assert.match(palette, new RegExp(`--sf-highlight-${role}: var\\(--sf-highlight-attribute\\);`, 'u'));
    assert.match(theme, new RegExp(`color: var\\(--sf-highlight--${role}\\);`, 'u'));
  }
});
