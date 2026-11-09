import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Highlight exposes concise options and safe language fallback', async () => {
  const source = await read('src/component/highlight/js/index.js');

  assert.match(source, /dataset\.lang/);
  assert.match(source, /dataset\.lines/);
  assert.match(source, /dataset\.chrome/);
  assert.match(source, /supportedLanguages/);
  assert.match(source, /highlightState = hljs\.getLanguage\(language\) \? 'ready' : 'unsupported'/);
  assert.doesNotMatch(source, /Math\.random|\[!Copy/);
});

test('the generated code head has no fill or backdrop filter of its own (Docara, 2026-11-07)', async () => {
  const source = await read('src/component/highlight/js/index.js');
  const head = /head\.className = '([^']+)'/u.exec(source);
  assert.ok(head, 'the generated head class list');
  assert.ok(head[1].split(' ').includes('sf-highlight__head'));
  assert.ok(!head[1].split(' ').some((name) => name.startsWith('bg-')), `no background utility on the head: ${head[1]}`);
});

test('the code head lays itself out without the utility sheet (simai/ui-source#31)', async () => {
  const [source, defaults] = await Promise.all([
    read('src/component/highlight/js/index.js'),
    read('src/component/highlight/scss/_default.scss'),
  ]);
  const head = /head\.className = '([^']+)'/u.exec(source);
  assert.deepEqual(head[1].split(' '), ['sf-highlight__head', 'sf--highlight-head'], 'no layout utilities on the generated head');
  const rule = /:is\(\.sf-highlight__head, \.sf--highlight-head\) \{([^}]+)\}/u.exec(defaults);
  assert.ok(rule, 'the head has a layout rule of its own');
  assert.match(rule[1], /display: flex;/u);
  assert.match(rule[1], /align-items: center;/u);
  assert.match(rule[1], /justify-content: space-between;/u);
  assert.match(defaults, /\.sf-highlight__status \{[^}]*position: absolute;[^}]*clip-path: inset\(50%\);/u, 'the copy status is hidden by the component');
  assert.match(defaults, /border-radius: var\(--sf-highlight-radius, var\(--sf-radius--surface\)\);/u);
});

test('Highlight composes native Clipboard and supports dynamic refresh', async () => {
  const [source, rule] = await Promise.all([
    read('src/component/highlight/js/index.js'),
    read('src/component/highlight/rule.js'),
  ]);

  assert.match(source, /button\.type = 'button'/);
  assert.match(source, /sf-clipboard/);
  assert.match(source, /sf-icon-button/);
  assert.match(source, /createElement\('span'\)/);
  assert.match(source, /icon\.className = 'sf-icon'/);
  assert.match(source, /status\.className = 'sf-highlight__status sr-only'/);
  assert.match(source, /button\.dataset\.status/);
  assert.match(source, /window\.SF\.Highlight/);
  assert.match(source, /MutationObserver/);
  assert.match(rule, /name: 'clipboard'/);
  assert.match(rule, /name: 'icon-buttons'/);
  assert.match(rule, /name: 'icons'/);
  assert.match(rule, /name: 'scrollbar'/);
});

test('Highlight line numbers and presentation use semantic tokens', async () => {
  const [lineNumbers, defaults, theme] = await Promise.all([
    read('src/component/highlight/js/line_numbers.js'),
    read('src/component/highlight/scss/_default.scss'),
    read('src/component/highlight/scss/_theme.scss'),
  ]);

  // Numbered from data-start (1 when absent), and each line is a row the
  // stylesheet lays out -- unstyled rows ran every line into one.
  assert.match(lineNumbers, /first \+ index/);
  assert.match(lineNumbers, /dataset\.start/);
  assert.match(defaults, /\.sf-code-line \{\s*display: flex;/);
  assert.match(defaults, /\.sf-code-line__number \{[^}]*user-select: none/);
  assert.match(lineNumbers, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(lineNumbers, /\d(?:\.\d+)?rem|paddingLeft/);
  assert.match(defaults, /--sf-radius--surface/);
  assert.match(defaults, /--sf-text-medium--size/);
  assert.match(theme, /--sf-space-1/);
  assert.doesNotMatch(`${defaults}${theme}`, /(?<![-\w])\d+(?:\.\d+)?(?:px|rem|em)(?![-\w])/);
});

test('Highlight documentation uses executable Framework-only variants', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, lines, modes, fallback] = await Promise.all([
    readUiDoc('content/ru/components/content/highlight.md'),
    readUiDoc('examples/components/highlight/overview/index.html'),
    // Line numbers are a public option (data-lines) the docs must show running.
    readUiDoc('examples/components/highlight/line-numbers/index.html').catch(() => ''),
    readUiDoc('examples/components/highlight/chrome/index.html'),
    readUiDoc('examples/components/highlight/fallback/index.html'),
  ]);

  assert.match(page, /data-lang/);
  assert.match(page, /data-lines/);
  assert.match(page, /data-chrome/);
  assert.match(overview, /data-lang="html"/);
  assert.match(lines, /data-lines/, 'examples/components/highlight/line-numbers must show data-lines');
  assert.match(modes, /data-chrome="none"/);
  // A language outside the bundled set stays readable as plain text.
  assert.match(fallback, /<pre><code data-lang="([a-z-]+)">[^<]+<\/code><\/pre>\s*<code[^>]*>data-lang="\1" — языка нет в наборе/);
  assert.doesNotMatch(`${overview}${lines}${modes}${fallback}`, /style=/);
});

test('a numbered block copies its code, one line per row, without the numbers', async () => {
  const clipboard = await read('src/component/clipboard/js/index.js');
  const reader = clipboard.slice(clipboard.indexOf('function readTargetText'), clipboard.indexOf('function resolveCopySource'));
  assert.match(reader, /\.sf-code-line__content/);
  assert.match(reader, /\.join\('\\n'\)/);
});
