import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';
import {cleanHtml, htmlText} from '../src/smart/field-renderers/html.js';

// Formatted text (simai.property-view-port 1.17.0, propertyType html; Larena,
// 2026-10-30): an HTML string of sf-rich-text's subset, edited with
// sf-rich-text, shown cleaned by that component's own rule, a cell its text.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const body = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}\n', start));
};
const element = (text, tag) => text.slice(text.indexOf(`<${tag}`), text.indexOf(`></${tag}>`));

const HOSTILE = [
  '<p onclick="alert(1)">Текст <strong onmouseover="alert(2)">важный</strong></p>',
  '<script>alert(3)</script><p>после</p>',
  '<img src=x onerror="alert(4)"><p>картинка</p>',
  '<p><a href="javascript:alert(5)">ссылка</a> и <a href="java\tscript:alert(6)">ещё</a></p>',
  '<style>p{color:red}</style><svg onload="alert(7)"><p>svg</p></svg>',
  '<iframe src="https://evil.example/"></iframe><p style="background:url(x)">стиль</p>',
  '<p>a</p><div><script>alert(8)</script></div>',
];

test('html is registered between text and integer, in both languages, with the text keys', () => {
  const types = PROPERTY_TYPES.map((entry) => entry.type);
  assert.equal(types.indexOf('html'), types.indexOf('text') + 1);
  const entry = PROPERTY_TYPES.find((one) => one.type === 'html');
  assert.deepEqual(entry.label, {ru: 'Форматированный текст', en: 'Formatted text'});
  assert.deepEqual(entry.variants, []);
  assert.deepEqual(entry.params, ['placeholder', 'required', 'readonly']);
});

test('view, edit and cell draw html; the filter falls back to a text search', () => {
  assert.match(source, /\n    html: renderHtmlView,\n/u);
  assert.match(source, /\n    html: renderHtmlEdit,\n/u);
  assert.match(source, /\n    html: renderHtmlCell,\n/u);
  const filters = source.slice(source.indexOf('export const FILTER_RENDERERS = {'), source.indexOf('};', source.indexOf('export const FILTER_RENDERERS = {')));
  assert.doesNotMatch(filters, /\bhtml:/u);
  assert.match(source, /const renderer = FILTER_RENDERERS\[asked\] \|\| FILTER_RENDERERS\.text;/u);
});

test('the edit is sf-rich-text, named as the textarea is, and writes the editor\'s value back', () => {
  const edit = element(body('renderHtmlEdit'), 'sf-rich-text');
  const textarea = element(body('renderTextAreaEdit'), 'sf-textarea');
  for (const line of ['size=${EDIT_SIZE}', 'appearance="bordered"', 'name=${fieldName(field)}',
    'placeholder=${field.placeholder || nothing}', '?required=${Boolean(field.required)}',
    "aria-label=${field.label || field.key || ''}"]) {
    assert.ok(edit.includes(line), `edit: ${line}`);
    assert.ok(textarea.includes(line), `textarea has the same: ${line}`);
  }
  assert.match(edit, /\?disabled=\$\{EDIT_DISABLED\}/u);
  assert.match(edit, /value=\$\{typeof value === 'string' \? value : ''\}/u);
  assert.equal((edit.match(/@[a-z-:]+=/gu) ?? []).join(), '@input=,@change=');
  // The element's value, not the editing surface's: the events come from inside it.
  assert.match(body('renderHtmlEdit'), /host\.setFieldValue\(field, event\.currentTarget\?\.value \?\? ''\)/u);
});

test('the view draws markup only from the cleaned value, and nowhere else', () => {
  const view = body('renderHtmlView');
  assert.match(view, /const clean = cleanHtml\(value\);/u);
  assert.match(view, /unsafeHTML\(clean\)/u);
  // unsafeHTML is imported once and used once in the whole set.
  assert.equal((source.match(/unsafeHTML\(/gu) ?? []).length, 1);
  assert.match(source, /import \{cleanHtml, htmlText\} from "\.\/html\.js";/u);
  const helpers = readFileSync(join(root, 'src/smart/field-renderers/html.js'), 'utf8');
  assert.match(helpers, /from '\.\.\/rich-text\/js\/rich-text-html\.mjs'/u);
  assert.match(helpers, /sanitizeRichText\(html, \{mode: 'value'\}\)/u);
});

test('a cleaned value keeps the subset', () => {
  const kept = '<h2>Заголовок</h2><p>Текст с <strong>важным</strong>, <em>курсивом</em> и <a href="https://simai.io/">ссылкой</a></p><ul><li>один</li><li>два</li></ul><blockquote><p>цитата</p></blockquote>';
  assert.equal(cleanHtml(kept), kept);
  assert.equal(cleanHtml({value: kept, text: 'ignored'}), kept);
  for (const empty of [null, undefined, '', 7, [], {}, '<p></p>']) assert.equal(cleanHtml(empty), '');
});

test('a hostile value is never drawn: no script, no on* attribute, no javascript: link, no style', () => {
  for (const hostile of HOSTILE) {
    const clean = cleanHtml(hostile);
    assert.doesNotMatch(clean, /<script|<style|<img|<svg|<iframe/iu, hostile);
    assert.doesNotMatch(clean, /\son[a-z]+\s*=/iu, hostile);
    assert.doesNotMatch(clean, /javascript:|java\tscript:/iu, hostile);
    assert.doesNotMatch(clean, /style=|src=/iu, hostile);
    assert.doesNotMatch(clean, /alert\(/u, hostile);
    // Only the subset's tags, and of attributes only href.
    for (const [, tag, attributes] of clean.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gu)) {
      assert.ok(['p', 'h2', 'h3', 'h4', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'br'].includes(tag), `${tag} in ${clean}`);
      assert.ok(attributes === '' || /^ href="[^"]*"$/u.test(attributes), `${attributes} in ${clean}`);
    }
  }
  assert.equal(cleanHtml(HOSTILE[0]), '<p>Текст <strong>важный</strong></p>');
  assert.equal(cleanHtml(HOSTILE[3]), '<p>ссылка и ещё</p>');
});

test('a cell is the value\'s text on one line, a hostile one without its script', () => {
  assert.equal(htmlText('<h2>Заголовок</h2><p>Первый <strong>абзац</strong></p><ul><li>один</li><li>два</li></ul>'), 'Заголовок Первый абзац один два');
  assert.equal(htmlText(HOSTILE[1]), 'после');
  assert.equal(htmlText('<p>a &amp; b &lt;c&gt;</p>'), 'a & b <c>');
  for (const empty of [null, undefined, '', 7]) assert.equal(htmlText(empty), '');
  assert.match(body('renderHtmlCell'), /return htmlText\(value\) \|\| null;/u);
});
