import assert from 'node:assert/strict';
import test from 'node:test';

import { validate } from '../src/core/js/composition/index.mjs';
import { inlineText, marksIn, normalizeInline, replaceRange, safeHref, setLink, toSegments, toggleMark } from '../src/core/js/composition/inline-model.mjs';

const text = (value, marks) => ({ type: 'text', value, ...(marks ? { marks } : {}) });
const paragraph = (content) => ({ schema: 'simai.composition.document.v1', id: 'p', profile: 'ui-layout', root: { id: 'p', type: 'content.paragraph', data: { content } } });

test('normalization merges runs, orders marks and drops empty parts', () => {
  const content = [text('Hel'), text('lo', []), text(''), text(' wo', ['em', 'strong', 'em']), text('rld', ['strong', 'em']), { type: 'link', href: '/a', children: [text('x')] }, { type: 'link', href: '/a', children: [text('y')] }];
  assert.deepEqual(normalizeInline(content), [text('Hello'), text(' world', ['strong', 'em']), { type: 'link', href: '/a', children: [text('xy')] }]);
  assert.deepEqual(normalizeInline(normalizeInline(content)), normalizeInline(content));
});

test('toggleMark adds a mark to a range and removes it when the whole range has it', () => {
  const content = [text('Hello world')];
  const bold = toggleMark(content, 6, 11, 'strong');
  assert.deepEqual(bold, [text('Hello '), text('world', ['strong'])]);
  assert.deepEqual(marksIn(bold, 6, 11).marks, ['strong']);
  assert.deepEqual(toggleMark(bold, 6, 11, 'strong'), [text('Hello world')]);
  assert.deepEqual(toggleMark(bold, 4, 8, 'strong'), [text('Hell'), text('o world', ['strong'])]);
  assert.deepEqual(toggleMark(content, 0, 5, 'underline'), content);
});

test('links are applied, replaced and removed only with safe addresses', () => {
  const content = [text('Read the guide')];
  const linked = setLink(content, 9, 14, 'https://simai.ru/guide');
  assert.deepEqual(linked, [text('Read the '), { type: 'link', href: 'https://simai.ru/guide', children: [text('guide')] }]);
  assert.equal(marksIn(linked, 9, 14).href, 'https://simai.ru/guide');
  assert.deepEqual(setLink(linked, 9, 14, null), content);
  for (const bad of ['javascript:alert(1)', '//evil.test', 'data:text/html,x', '', 'x'.repeat(2049)]) {
    assert.equal(safeHref(bad), false, bad);
    assert.throws(() => setLink(content, 0, 4, bad), TypeError);
  }
  for (const good of ['/local', './rel', '#top', 'mailto:a@b.c', 'tel:+7000', 'https://x.test']) assert.equal(safeHref(good), true, good);
  assert.deepEqual(toSegments([{ type: 'link', href: 'javascript:x', children: [text('bad')] }]), [{ text: 'bad', marks: [], href: null }]);
});

test('replaceRange inserts, replaces and deletes across runs', () => {
  const content = [text('Hello '), text('world', ['strong'])];
  assert.equal(inlineText(replaceRange(content, 6, 11, [{ text: 'there', marks: ['em'], href: null }])), 'Hello there');
  assert.deepEqual(replaceRange(content, 6, 11, [{ text: 'there', marks: ['em'], href: null }]), [text('Hello '), text('there', ['em'])]);
  assert.deepEqual(replaceRange(content, 3, 8, []), [text('Hel'), text('rld', ['strong'])]);
  assert.deepEqual(replaceRange(content, 11, 11, [{ text: '!', marks: [], href: null }]), [text('Hello '), text('world', ['strong']), text('!')]);
});

test('edited content always validates as heading and paragraph data', () => {
  let content = [text('Абзац с текстом и ссылкой')];
  content = toggleMark(content, 0, 5, 'strong');
  content = toggleMark(content, 2, 9, 'em');
  content = toggleMark(content, 10, 16, 'code');
  content = setLink(content, 19, 26, '/catalog/');
  assert.deepEqual(validate(paragraph(content)), { valid: true, diagnostics: [] });
  assert.equal(inlineText(content), 'Абзац с текстом и ссылкой');
});

test('backslash paths are never local links, in the editor or in Documents', () => {
  for (const bad of ['/\\evil.test', '/a\\b', '#x\\y']) {
    assert.equal(safeHref(bad), false, bad);
    const checked = validate(paragraph([{ type: 'link', href: bad, children: [text('x')] }]));
    assert.ok(checked.diagnostics.some(({ code }) => code === 'unsafe_url'), bad);
  }
});
