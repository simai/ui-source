// The code block's file name (owner decision C285, 2026-11-17; ui-control
// prototypes/docara-316-audit-study.html#q-da-code-name): data-title puts the
// file name where the head shows the language, in the same head text.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runtime = read('src/component/highlight/js/index.js');
const chrome = runtime.slice(runtime.indexOf('function updateChrome'), runtime.indexOf("hljs.addPlugin({"));

test('C285: data-title is read from the code, its pre or the root', () => {
  assert.match(chrome, /const title = String\(blockOption\(block, 'data-title'\) \?\? ''\)\.trim\(\);/u);
  // blockOption reads code, pre and the root, as the line-mark attributes do.
  assert.match(runtime, /const holders = \[block, block\.closest\('pre'\), block\.closest\(ROOT_SELECTOR\)\];/u);
});

test('C285: the file name stands in the language slot and the language is not shown', () => {
  assert.match(chrome, /language\.textContent = title \|\| block\.dataset\.requestedLang \|\| result\.language \|\| 'text';/u);
  // A terminal keeps its icon; the name takes the word's place, in its own
  // span so the ellipsis can cut it beside the icon (1.11.0).
  assert.match(chrome, /name\.className = 'sf-highlight__language-text';/u);
  assert.match(chrome, /name\.textContent = title \|\| pageText\(HIGHLIGHT_TEXT, 'terminal'/u);
  // Same head text: the slot keeps its class, no second element.
  assert.match(chrome, /language\.className = 'sf-highlight__language sf-text-1\/2 weight-5';/u);
});

test('C285: the docs teach data-title', () => {
  const docs = read('src/component/highlight/docs/docs.md');
  assert.match(docs, /`data-title`/u);
  assert.match(docs, /C285/u);
});

test('C285 (1.11.0): a long name ends with an ellipsis and a cut name carries its whole text as the title', () => {
  const styles = read('src/component/highlight/scss/_default.scss');
  assert.match(styles, /> \.sf-highlight__language:not\(:has\(> \.sf-highlight__language-text\)\),\s*\.sf-highlight__language-text \{\s*min-inline-size: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/u);
  // The buttons keep their size; the name gives up its room first.
  assert.match(styles, /> :not\(\.sf-highlight__language\) \{\s*flex-shrink: 0;/u);
  assert.match(chrome, /markCutName\(language\);\s*watchName\(language\);/u);
  const mark = runtime.slice(runtime.indexOf('function markCutName'), runtime.indexOf('function watchName'));
  // A page's own title on the label is left alone; the mark is set and taken back.
  assert.match(mark, /if \(language\.hasAttribute\('title'\) && !\('sfHighlightCut' in language\.dataset\)\) return;/u);
  assert.match(mark, /text\.scrollWidth > text\.clientWidth \+ 1/u);
  assert.match(mark, /language\.setAttribute\('title', text\.textContent\.trim\(\)\)/u);
  assert.match(mark, /language\.removeAttribute\('title'\)/u);
});
