import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { toHtml, fromHtml } from '../src/core/js/composition/html-value.mjs';
import { sanitizeRichText } from '../src/core/js/composition/html-subset.mjs';
import { render, validate } from '../src/core/js/composition/index.mjs';
import { INLINE_MARKS, INLINE_MODEL_VERSION, breakSegment, inlineLength, inlineText, normalizeInline, replaceRange, setLink, sliceInline, toSegments, toggleMark } from '../src/core/js/composition/inline-model.mjs';

// Inline model 1.2.0 (2026-11-10 composition review, F2.1): the soft line
// break and the mark strike, and the html@1 value <-> model mapping that holds
// every valid stored value byte for byte.

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const text = (value, marks) => ({ type: 'text', value, ...(marks ? { marks } : {}) });
const br = (marks) => ({ type: 'break', ...(marks ? { marks } : {}) });
const paragraph = (content) => ({ schema: 'simai.composition.document', schema_version: 1, id: 'p', profile: 'structured-content', root: { id: 'root', type: 'content.document', slots: { default: [{ id: 'p', type: 'content.paragraph', data: { content } }] } } });

function corpus() {
  const values = json('tests/fixtures/html1-break-corpus.json').rows.map(({ value }) => value);
  for (const { input } of json('tests/fixtures/rich-text-vectors.json')) values.push(sanitizeRichText(input, { mode: 'value', document: null }));
  let seed = 20261110;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const parts = ['&nbsp;', ' ', '<br>', 'a', 'b', 'ё', '<strong>', '</strong>', '<em>', '</em>', '<a href="/x">', '<a href="https://simai.io/a">', '</a>', '<p>', '</p>', '<ol><li>', '<ul><li>', '</li></ul>', '</li><li>', '<h2>', '</h2>', '<h4>', '<blockquote>', '</blockquote>'];
  for (let index = 0; index < 3000; index += 1) {
    let input = '';
    for (let count = 1 + Math.floor(random() * 10); count > 0; count -= 1) input += parts[Math.floor(random() * parts.length)];
    values.push(sanitizeRichText(input, { mode: 'value', document: null }));
  }
  return values;
}

test('inline model 1.2.0: strike is a known mark and the break a known entry', () => {
  assert.equal(INLINE_MODEL_VERSION, '1.2.0');
  assert.deepEqual(INLINE_MARKS, ['strong', 'em', 'code', 'strike']);
  const content = [text('a', ['strike']), br(), text('b'), { type: 'link', href: '/x', children: [text('c'), br(['strong']), text('d')] }, br(), br()];
  assert.deepEqual(validate(paragraph(content)), { valid: true, diagnostics: [] });
  assert.deepEqual(normalizeInline(content), content, 'breaks in links, with marks and in a row are kept');
  assert.equal(inlineLength(content), 8);
  assert.equal(inlineText(content), 'a\nbc\nd\n\n');
  // A break with a key the model does not define (a newer producer's) keeps
  // it as extension data: kept byte for byte, valid since 2026-11-11 (owner
  // rule: no silent data loss; inline extension keys), drawn as a break.
  const future = { type: 'break', kind: 'page' };
  assert.deepEqual(normalizeInline([text('x'), future]), [text('x'), future]);
  assert.equal(validate(paragraph([future])).valid, true);
  // A break of another shape (marks not a list) is still opaque and refused.
  const odd = { type: 'break', marks: 'strong' };
  assert.deepEqual(normalizeInline([text('x'), odd]), [text('x'), odd]);
  assert.equal(validate(paragraph([odd])).valid, false);
});

test('the renderer draws a break as <br> inside its marks, and strike as <s>', async () => {
  const { html } = await render(paragraph([text('a'), br(), text('b', ['strike']), br(['strong', 'em']), { type: 'link', href: '/x', children: [text('c'), br()] }]));
  assert.equal(html, '<article data-sf-composition-id="root"><p data-sf-composition-id="p">a<br><s>b</s><em><strong><br></strong></em><a href="/x">c<br></a></p></article>');
});

test('every inline operation keeps breaks; only a deletion of its own range removes one', () => {
  const content = [text('one'), br(), text('two', ['em']), br(['em']), text('three')];
  const breaks = (result) => toSegments(result).filter((segment) => segment.break).length;
  const whole = inlineLength(content);
  assert.equal(breaks(toggleMark(content, 0, whole, 'strong')), 2);
  assert.equal(breaks(toggleMark(content, 0, whole, 'strike')), 2);
  assert.equal(breaks(setLink(content, 0, whole, '/all')), 2);
  assert.equal(breaks(replaceRange(content, 0, 3, [{ text: 'ONE', marks: [], href: null }])), 2);
  assert.equal(breaks(sliceInline(content, 2, 6)), 1);
  assert.equal(breaks(replaceRange(content, 3, 4, [])), 1, 'deleting the break removes it');
  assert.equal(breaks(replaceRange(content, 1, 1, [breakSegment()])), 3);
  const linked = setLink(content, 0, whole, '/all');
  assert.deepEqual(validate(paragraph(linked)), { valid: true, diagnostics: [] });
  assert.equal(linked.length, 1, 'one link holds the text and its breaks');
  const struck = toggleMark(content, 0, whole, 'strike');
  assert.ok(struck.every((entry) => entry.marks?.includes('strike')), 'strike reaches the breaks too');
  assert.deepEqual(normalizeInline(normalizeInline(struck)), struck);
});

test('html@1 value -> model -> html@1 value is the same bytes for every value of the corpus', () => {
  const values = corpus();
  assert.ok(values.length > 3000);
  for (const value of values) {
    const document = fromHtml(value);
    assert.deepEqual(document.losses, []);
    assert.deepEqual(validate(document.value).diagnostics, [], `valid: ${value}`);
    const back = toHtml(document.value);
    assert.deepEqual(back.losses, [], value);
    assert.equal(back.value, value);
  }
});

test('the mapping: breaks in marks and links, list lines, quotes, and what html@1 cannot hold is reported', () => {
  const { value } = fromHtml('<p><strong>a<br>b</strong></p><ul><li>x<ul><li>y</li></ul>z</li></ul><blockquote><h3>q</h3></blockquote>');
  const [p, list, quote] = value.root.slots.default;
  assert.deepEqual(p.data.content, [text('a', ['strong']), br(['strong']), text('b', ['strong'])]);
  assert.deepEqual(list.slots.items[0].data.content, [text('x')]);
  assert.deepEqual(list.slots.items[0].slots.default.map(({ type }) => type), ['content.list', 'content.paragraph']);
  assert.equal(quote.slots.default[0].data.level, 3);
  const lossy = {
    schema: 'simai.composition.document', schema_version: 1, id: 'x', profile: 'structured-content',
    root: { id: 'root', type: 'content.document', slots: { default: [
      { id: 'a', type: 'content.paragraph', data: { content: [text('code', ['code']), text(' gone', ['strike']), { type: 'component', name: 'kbd', props: { text: 'K' } }] } },
      { id: 'b', type: 'content.heading', data: { level: 1, content: [text('Top')] } },
      { id: 'c', type: 'content.code', data: { code: 'x' } },
    ] } },
  };
  const out = toHtml(lossy);
  assert.equal(out.value, '<p>code gone</p><h2>Top</h2>');
  assert.deepEqual(out.losses, [
    { code: 'not_expressible', path: '$.root.slots.default[0].data.content[0]', what: 'mark code' },
    { code: 'not_expressible', path: '$.root.slots.default[0].data.content[1]', what: 'mark strike' },
    { code: 'not_expressible', path: '$.root.slots.default[0].data.content[2]', what: 'inline component kbd' },
    { code: 'not_expressible', path: '$.root.slots.default[1].data.level', what: 'heading level 1' },
    { code: 'not_expressible', path: '$.root.slots.default[2]', what: 'type content.code' },
  ]);
});

// 2026-11-11 acceptance (M2): white space and breaks next to the boundaries of
// strong, em and links. Cleaning a value again leaves it unchanged, and the
// minimal cases the acceptance shrank to take their fixed point at once.
test('html@1 cleaning is idempotent next to inline boundaries', () => {
  const minimal = [
    ['a <em> <br>n', '<p>a<em><br>n</em></p>'],
    ['a<strong> </strong>\n<strong>\t&amp;', '<p>a<strong> &amp;</strong></p>'],
    ['б<strong> </strong> <br>б', '<p>б<br>б</p>'],
    ['<p>a <em><br>n</em></p>', '<p>a<em><br>n</em></p>'],
  ];
  for (const [input, expected] of minimal) assert.equal(sanitizeRichText(input, { mode: 'value' }), expected, input);
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const atoms = ['a', 'б', ' ', '&nbsp;', '<br>', '<br/>', ' <br> ', '&amp;', '\n', '\t', 'x y'];
  const inline = (depth) => {
    let out = '';
    for (let index = 0, count = 1 + Math.floor(random() * 5); index < count; index += 1) {
      const roll = random();
      if (depth < 2 && roll < 0.15) out += `<strong>${inline(depth + 1)}</strong>`;
      else if (depth < 2 && roll < 0.25) out += `<em>${inline(depth + 1)}</em>`;
      else if (depth < 2 && roll < 0.32) out += `<a href="${pick(['/x', 'https://simai.io', 'javascript:alert(1)'])}">${inline(depth + 1)}</a>`;
      else if (depth < 2 && roll < 0.36) out += `<span style="font-weight:700">${inline(depth + 1)}</span>`;
      else out += pick(atoms);
    }
    return out;
  };
  const block = () => {
    const roll = random();
    if (roll < 0.4) return `<p>${inline(0)}</p>`;
    if (roll < 0.55) return `<h2>${inline(0)}</h2>`;
    if (roll < 0.7) return `<ul><li>${inline(0)}</li><li>${inline(0)}</li></ul>`;
    if (roll < 0.8) return `<blockquote><p>${inline(0)}</p></blockquote>`;
    return inline(0);
  };
  let changed = 0;
  for (let index = 0; index < 5000; index += 1) {
    const source = Array.from({ length: 1 + Math.floor(random() * 3) }, block).join(pick(['', '\n', ' ']));
    const once = sanitizeRichText(source, { mode: 'value' });
    if (sanitizeRichText(once, { mode: 'value' }) !== once || toHtml(fromHtml(once).value).value !== once) changed += 1;
  }
  assert.equal(changed, 0);
});
