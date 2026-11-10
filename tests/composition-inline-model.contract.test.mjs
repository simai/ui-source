import assert from 'node:assert/strict';
import test from 'node:test';

import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { render, validate } from '../src/core/js/composition/index.mjs';
import { INLINE_COMPONENTS, fromSegments, inlineLength, inlineText, isInlineComponent, marksIn, normalizeInline, objectAt, replaceRange, safeHref, setLink, sliceInline, toSegments, toggleMark } from '../src/core/js/composition/inline-model.mjs';

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

const atom = (name, props) => ({ type: 'component', name, ...(props ? { props } : {}) });
const codes = (content) => validate(paragraph(content)).diagnostics.map(({ code }) => code);

test('an unknown inline node round-trips through toSegments and back unchanged', () => {
  const future = { type: 'mention', user: { id: 7, name: 'Rim' }, marks: ['strong'] };
  const unknownAtom = atom('chart', { series: [1, 2] });
  const inLink = { type: 'footnote', ref: 'n1' };
  const content = [text('Before '), future, text(' and '), unknownAtom, { type: 'link', href: '/a', children: [text('x'), inLink, text('y')] }];
  assert.deepEqual(fromSegments(toSegments(content)), content);
  assert.deepEqual(normalizeInline(content), content);
  assert.equal(inlineLength(content), 'Before '.length + 1 + ' and '.length + 1 + 3);
  assert.equal(inlineText(content), 'Before  and xy');
  // The segment holds a copy: editing the result never writes into the input.
  const [, segment] = toSegments(content);
  segment.node.user.name = 'changed';
  assert.equal(future.user.name, 'Rim');
});

test('every inline operation keeps unknown nodes and atoms exactly', () => {
  const future = { type: 'mention', user: 'rim' };
  const key = atom('kbd', { text: 'Ctrl' });
  const content = [text('Press '), key, text(' then '), future, text(' done')];
  const keep = (result) => {
    assert.ok(result.some((entry) => JSON.stringify(entry) === JSON.stringify(key)), JSON.stringify(result));
    assert.ok(result.some((entry) => JSON.stringify(entry) === JSON.stringify(future)), JSON.stringify(result));
  };
  const whole = inlineLength(content);
  keep(toggleMark(content, 0, whole, 'strong'));
  keep(toggleMark(content, 0, whole, 'em'));
  keep(setLink(content, 0, whole, '/all'));
  keep(replaceRange(content, 0, 6, [{ text: 'Hit ', marks: [], href: null }]));
  keep(replaceRange(content, whole, whole, [{ text: '!', marks: [], href: null }]));
  keep(replaceRange(content, 7, 7, [{ text: '+', marks: [], href: null }]));
  // Marks and links pass around atoms: never on them, never wrapping them.
  const bold = toggleMark(content, 0, whole, 'strong');
  assert.deepEqual(bold[1], key);
  assert.deepEqual(marksIn(bold, 0, whole).marks, ['strong']);
  const linked = setLink(content, 0, whole, '/all');
  assert.deepEqual(linked.map(({ type }) => type), ['link', 'component', 'link', 'mention', 'link']);
  assert.ok(linked.filter(({ type }) => type === 'link').every(({ children }) => children.every(({ type }) => type === 'text')));
});

test('edits next to an atom keep it, and deleting its one unit removes it whole', () => {
  const badge = atom('badge', { text: 'New', status: 'success', compact: true });
  const content = [text('Hello'), badge, text('world')];
  assert.deepEqual(objectAt(content, 5), badge);
  assert.equal(objectAt(content, 4), null);
  assert.equal(objectAt(content, 6), null);
  assert.deepEqual(replaceRange(content, 5, 5, [{ text: ' ', marks: [], href: null }]), [text('Hello '), badge, text('world')]);
  assert.deepEqual(replaceRange(content, 6, 6, [{ text: ' ', marks: [], href: null }]), [text('Hello'), badge, text(' world')]);
  assert.deepEqual(replaceRange(content, 4, 5, []), [text('Hell'), badge, text('world')]);
  assert.deepEqual(replaceRange(content, 6, 7, []), [text('Hello'), badge, text('orld')]);
  assert.deepEqual(replaceRange(content, 5, 6, []), [text('Helloworld')]);
  assert.deepEqual(sliceInline(content, 4, 7), [text('o'), badge, text('w')]);
  const pasted = replaceRange([text('ab')], 1, 1, toSegments(sliceInline(content, 5, 6)));
  assert.deepEqual(pasted, [text('a'), badge, text('b')]);
  assert.deepEqual(validate(paragraph(pasted)), { valid: true, diagnostics: [] });
});

test('the inline atom validates for each declared name', () => {
  const content = [
    text('Status '), atom('badge', { text: 'Beta', appearance: 'tonal', scheme: 'primary', status: 'info', size: '1/2', compact: false, icon: 'star' }),
    text(', press '), atom('kbd', { text: 'Ctrl+S' }),
    text(', '), atom('icon', { icon: 'arrow_forward', label: 'Next', filled: true }),
    text(', '), atom('button', { text: 'Save', icon: 'save', appearance: 'outline', scheme: 'secondary', size: '1' }),
    atom('badge'),
  ];
  assert.deepEqual(validate(paragraph(content)), { valid: true, diagnostics: [] });
  for (const entry of content.filter(({ type }) => type === 'component')) assert.equal(isInlineComponent(entry), true, entry.name);
  const heading = { ...paragraph(content), root: { id: 'h', type: 'content.heading', data: { level: 2, content } } };
  assert.deepEqual(validate(heading), { valid: true, diagnostics: [] });
});

test('the inline atom rejects marks, nesting in a link, names outside the list and undeclared props', () => {
  assert.deepEqual(codes([{ ...atom('kbd', { text: 'K' }), marks: ['strong'] }]), ['schema_one_of']);
  assert.deepEqual(codes([{ type: 'link', href: '/a', children: [text('x'), atom('kbd', { text: 'K' })] }]), ['schema_one_of']);
  for (const name of ['chart', 'Badge', 'sf-badge', 'tag', '']) assert.deepEqual(codes([atom(name, { text: 'x' })]), ['schema_one_of'], name);
  assert.deepEqual(codes([atom('badge', { onclick: 'alert(1)' })]), ['schema_one_of']);
  assert.deepEqual(codes([atom('badge', { status: 'x" onload="y' })]), ['schema_one_of']);
  assert.deepEqual(codes([atom('badge', { compact: 'yes' })]), ['schema_one_of']);
  assert.deepEqual(codes([atom('kbd')]), ['schema_one_of']);
  assert.deepEqual(codes([atom('icon', { label: 'No glyph' })]), ['schema_one_of']);
  assert.deepEqual(codes([{ ...atom('kbd', { text: 'K' }), value: 'x' }]), ['schema_one_of']);
  for (const bad of [{ ...atom('kbd', { text: 'K' }), marks: ['em'] }, atom('chart'), atom('badge', { onclick: 'x' })]) assert.equal(isInlineComponent(bad), false);
});

test('the renderer draws atoms with every prop escaped as text', async () => {
  const content = [
    atom('kbd', { text: '<script>alert(1)</script>' }),
    atom('badge', { text: '"><script>alert(2)</script>', status: 'info', compact: true }),
    atom('button', { text: '<b>x</b>' }),
    atom('icon', { icon: 'star', label: '</sf-icon><img src=x onerror=alert(3)>' }),
  ];
  const { html } = await render({ ...paragraph(content) });
  assert.equal(html, '<p data-sf-composition-id="p">'
    + '<kbd>&lt;script&gt;alert(1)&lt;/script&gt;</kbd>'
    + '<sf-badge text="&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;" status="info" compact></sf-badge>'
    + '<sf-button text="&lt;b&gt;x&lt;/b&gt;"></sf-button>'
    + '<sf-icon icon="star" label="&lt;/sf-icon&gt;&lt;img src=x onerror=alert(3)&gt;"></sf-icon>'
    + '</p>');
});

test('content.heading is type version 1.2.0 and content.paragraph 1.3.0 (G-39 modifiers, alignment and visibility), the Document stays v1', () => {
  assert.equal(BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'content.heading').version, '1.2.0');
  assert.equal(BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'content.paragraph').version, '1.3.0');
  assert.equal(BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.heading').type_version, '1.2.0');
  assert.deepEqual(Object.keys(INLINE_COMPONENTS), ['badge', 'kbd', 'icon', 'button']);
});

// F1.2 (2026-11-10 review): a mark this model does not know survives every
// operation; validation still refuses it.
test('a run with a mark the model does not know comes out of every operation unchanged', () => {
  for (const unknown of [['superscript'], ['strong', 'highlight', 'underline'], ['underline', 'em']]) {
    const marked = text('kept', unknown);
    const content = [text('Before '), marked, text(' after.')];
    const expected = normalizeInline(content).find(({ value }) => value === 'kept');
    // Known marks first in their order, unknown ones after them in theirs.
    assert.deepEqual(expected.marks, [...unknown.filter((mark) => ['strong', 'em', 'code'].includes(mark)), ...unknown.filter((mark) => !['strong', 'em', 'code'].includes(mark))]);
    const kept = (result, label) => assert.ok(toSegments(result).some((segment) => segment.text === 'kept' && JSON.stringify(segment.marks) === JSON.stringify(expected.marks)), `${label}: ${JSON.stringify(result)}`);
    kept(normalizeInline(content), 'normalizeInline');
    kept(normalizeInline(normalizeInline(content)), 'normalizeInline twice');
    kept(toggleMark(content, 0, 6, 'strong'), 'toggleMark on a neighbour');
    kept(toggleMark(content, 12, 17, 'em'), 'toggleMark after it');
    kept(setLink(content, 0, 6, '/before'), 'setLink on a neighbour');
    kept(replaceRange(content, 7, 7, [{ text: '+', marks: [], href: null }]), 'replaceRange right before');
    kept(replaceRange(content, 11, 11, [{ text: '+', marks: [], href: null }]), 'replaceRange right after');
    kept(replaceRange(content, 0, 7, []), 'replaceRange deleting the neighbour');
    assert.deepEqual(sliceInline(content, 7, 11), [expected], 'sliceInline');
    // The mark still holds when the run itself takes a known mark.
    const both = toggleMark(content, 7, 11, 'code');
    assert.ok(toSegments(both).some((segment) => segment.text === 'kept' && segment.marks.includes('code') && expected.marks.every((mark) => segment.marks.includes(mark))));
    assert.ok(codes(content).includes('schema_one_of') || codes(content).includes('schema_enum'), 'validation refuses the unknown mark');
  }
});

// F1.3: an atom is never inside a link, whatever the model is given.
test('a link that holds an atom is split around it, and the result validates', () => {
  const key = atom('kbd', { text: 'K' });
  const linked = [{ type: 'link', href: '/a', children: [text('x'), key, text('y')] }];
  assert.deepEqual(normalizeInline(linked), [{ type: 'link', href: '/a', children: [text('x')] }, key, { type: 'link', href: '/a', children: [text('y')] }]);
  assert.deepEqual(validate(paragraph(normalizeInline(linked))), { valid: true, diagnostics: [] });
  assert.deepEqual(toSegments(linked)[1], { text: '￼', marks: [], href: null, node: key });
  // An opaque entry from a newer producer keeps its place in its link.
  const future = { type: 'footnote', ref: 'n1' };
  assert.deepEqual(normalizeInline([{ type: 'link', href: '/a', children: [text('x'), future] }]), [{ type: 'link', href: '/a', children: [text('x'), future] }]);
});

// A small deterministic generator: valid and invalid-shaped inputs alike.
function generator(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const pick = (list) => list[Math.floor(next() * list.length)];
  const markSets = [[], ['strong'], ['em'], ['code'], ['strong', 'em'], ['em', 'strong', 'code']];
  const atoms = [atom('kbd', { text: 'Ctrl' }), atom('badge', { text: 'New', status: 'info' }), atom('icon', { icon: 'star' }), atom('button')];
  const words = ['a', 'bc', ' ', 'Слово', 'x y', '', 'ё'];
  const run = () => (next() < 0.2 ? pick(atoms) : text(pick(words), pick(markSets).length ? pick(markSets) : undefined));
  const content = () => Array.from({ length: 1 + Math.floor(next() * 6) }, () => (next() < 0.25
    ? { type: 'link', href: pick(['/a', '/b', 'https://x.test']), children: Array.from({ length: 1 + Math.floor(next() * 3) }, run) }
    : run()));
  return { next, pick, content };
}

test('every inline operation\'s output validates (property test)', () => {
  const random = generator(20261110);
  const operations = [
    ['normalizeInline', (content) => normalizeInline(content)],
    ['toggleMark', (content, from, to) => toggleMark(content, from, to, random.pick(['strong', 'em', 'code']))],
    ['setLink', (content, from, to) => setLink(content, from, to, random.pick(['/x', null, 'mailto:a@b.c']))],
    ['replaceRange', (content, from, to) => replaceRange(content, from, to, toSegments(random.content()))],
    ['sliceInline', (content, from, to) => sliceInline(content, from, to)],
  ];
  let checked = 0;
  for (let round = 0; round < 400; round += 1) {
    let content = random.content();
    for (let step = 0; step < 4; step += 1) {
      const [name, operation] = random.pick(operations);
      const length = inlineLength(content);
      const from = Math.floor(random.next() * (length + 1));
      const to = Math.floor(random.next() * (length + 1));
      const input = content;
      content = operation(content, from, to);
      const result = validate(paragraph(content));
      assert.deepEqual(result.diagnostics, [], `${name}(${from}, ${to}) of ${JSON.stringify(input)} gave ${JSON.stringify(content)}`);
      assert.deepEqual(normalizeInline(content), content, `${name}: its output is normalized`);
      checked += 1;
    }
  }
  assert.equal(checked, 1600);
});
