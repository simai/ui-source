import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { fromEditorJs, toEditorJs } from '../src/core/js/composition/editorjs.mjs';
import { normalizedTree, stable, withoutIds } from '../src/core/js/composition/foreign.mjs';
import { validate } from '../src/core/js/composition/index.mjs';
import { fromMarkdown, toMarkdown } from '../src/core/js/composition/markdown.mjs';

// The Markdown module and the Editor.js adapter (2026-11-10 composition
// review, F2.4; assessment test plan items 1 and 6), over generated Documents
// of the content set: SIMAI -> Editor.js -> SIMAI equal including ids;
// SIMAI -> Markdown -> SIMAI equal but for ids whenever nothing else is
// reported; a Docara page unchanged prints back to its bytes, and one changed
// paragraph changes only its own lines.

const kit = new URL('../contracts/conformance/structured-content/markdown/', import.meta.url);

function generator(seed) {
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pick = (list) => list[Math.floor(random() * list.length)];
  let counter = 0;
  const id = () => `n${(counter += 1)}`;
  const words = ['alpha', 'бета', 'gamma', 'дельта', 'x = 1', 'a_b', 'Ü', '1.', 'end'];
  const run = () => {
    const marks = ['strong', 'em', 'code', 'strike'].filter(() => random() < 0.2);
    return { type: 'text', value: pick(words), ...(marks.length ? { marks } : {}) };
  };
  const inline = () => {
    const out = [];
    for (let count = 1 + Math.floor(random() * 4); count > 0; count -= 1) {
      const roll = random();
      if (roll < 0.1 && out.length) out.push({ type: 'break' });
      else if (roll < 0.2) out.push({ type: 'link', href: pick(['/a', 'https://simai.io/b', '#c']), children: [run()] });
      else if (roll < 0.25) out.push({ type: 'component', name: 'kbd', props: { text: 'K' } });
      else out.push(run());
      if (out.at(-1).type === 'text' && random() < 0.5) out.push({ type: 'text', value: ' ' });
    }
    // Content as an editor stores it: no white space or break at the end.
    while (out.length > 1 && (out.at(-1).type === 'break' || (out.at(-1).type === 'text' && out.at(-1).value === ' '))) out.pop();
    return out;
  };
  const paragraph = () => ({ id: id(), type: 'content.paragraph', data: { content: inline() } });
  const block = (depth) => {
    const roll = random();
    if (roll < 0.3 || depth > 2) return paragraph();
    if (roll < 0.4) return { id: id(), type: 'content.heading', data: { level: 2 + Math.floor(random() * 3), content: inline() } };
    if (roll < 0.5) return { id: id(), type: 'content.list', ...(random() < 0.5 ? { props: { ordered: true } } : {}), slots: { items: [{ id: id(), type: 'content.list-item', data: { content: inline() } }, { id: id(), type: 'content.list-item', data: { content: inline() } }] } };
    if (roll < 0.6) return { id: id(), type: 'content.quote', slots: { default: [paragraph()] } };
    if (roll < 0.7) return { id: id(), type: 'content.code', props: { lang: 'js' }, data: { code: 'const a = 1;\n```\nb' } };
    if (roll < 0.8) return { id: id(), type: 'content.alert', props: { status: pick(['info', 'success', 'warning', 'error']) }, data: { title: [run()] }, slots: { default: [block(depth + 1)] } };
    if (roll < 0.9) return { id: id(), type: 'content.details', data: { summary: [run()] }, slots: { default: [block(depth + 1)] } };
    return { id: id(), type: 'content.divider' };
  };
  return () => {
    counter = 0;
    return { schema: 'simai.composition.document', schema_version: 1, id: 'g', profile: 'structured-content', root: { id: 'root', type: 'content.document', slots: { default: Array.from({ length: 1 + Math.floor(random() * 5) }, () => block(0)) } } };
  };
}

test('generated Documents: SIMAI -> Editor.js -> SIMAI equal including ids, SIMAI -> Markdown -> SIMAI equal but for ids', async () => {
  const next = generator(20261110);
  let markdownEqual = 0;
  let markdownReported = 0;
  for (let index = 0; index < 400; index += 1) {
    const document = next();
    assert.deepEqual(validate(document).diagnostics, [], `valid ${index}`);
    const out = await toEditorJs(document);
    assert.deepEqual(out.losses, [], `editorjs ${index}`);
    const back = await fromEditorJs(out.value, { id: document.id });
    assert.equal(stable(back.value), stable(document), `editorjs back ${index}`);
    const markdown = await toMarkdown(document);
    if (markdown.losses.some(({ path }) => path !== '$')) { markdownReported += 1; continue; }
    const read = await fromMarkdown(markdown.value, { id: document.id });
    // Breaks at a block's edge are dropped by CommonMark itself: reported on
    // the way out, never silently.
    assert.equal(stable(withoutIds(read.value.root.slots.default)), stable(withoutIds(normalizedTree(document.root.slots.default))), `markdown ${index}\n${markdown.value}`);
    markdownEqual += 1;
  }
  assert.ok(markdownEqual >= 200, `${markdownEqual} equal, ${markdownReported} reported`);
});

test('a Docara page unchanged prints back to its bytes; one changed paragraph changes only its lines', async () => {
  const names = readdirSync(kit).filter((name) => name.startsWith('docara-page-'));
  assert.ok(names.length >= 10);
  for (const name of names) {
    const source = readFileSync(new URL(name, kit), 'utf8');
    const { value, losses } = await fromMarkdown(source);
    const printed = await toMarkdown(value);
    if (!losses.some(({ code }) => code === 'form_normalized')) assert.equal(printed.value, source, name);
    const target = value.root.slots.default.findIndex((node) => node.type === 'content.paragraph');
    if (target < 0) continue;
    const changed = structuredClone(value);
    changed.root.slots.default[target].data.content = [{ type: 'text', value: 'Изменённый абзац.' }];
    const after = (await toMarkdown(changed)).value.split('\n');
    const before = printed.value.split('\n');
    const differing = before.map((line, index) => (line === after[index] ? null : index)).filter((index) => index !== null);
    // The paragraph's own lines, and the lines that move up when it is shorter.
    const original = (await toMarkdown({ root: value.root.slots.default[target] })).value.trimEnd().split('\n').length;
    const start = differing[0];
    assert.ok(start !== undefined, name);
    assert.deepEqual(after.slice(start + 1), before.slice(start + original), `${name}: only the paragraph differs`);
  }
});

test('the alert vocabulary both ways, and what Docara requires is reported, not invented', async () => {
  const { value } = await fromMarkdown(':::alert {type=danger variant=outlined}\n#### Ошибка\n\nТекст.\n:::\n');
  assert.deepEqual(value.root.slots.default[0].props, { status: 'error', appearance: 'outlined' });
  const clear = await fromMarkdown(':::alert {type=clear}\n#### К сведению\n\nТекст.\n:::\n');
  assert.equal(clear.value.root.slots.default[0].props, undefined, 'clear is the Framework\'s neutral, which is the default');
  const titleless = await toMarkdown({ root: { id: 'w', type: 'content.alert', slots: { default: [{ id: 'b', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'Body.' }] } }] } } });
  assert.equal(titleless.value, ':::alert {type=clear}\nBody.\n:::\n');
  assert.ok(titleless.losses.some(({ code, path }) => code === 'docara_alert_title_required' && path === '$.root.data.title'));
});

test('a foreign block goes back only to its own format; elsewhere in a carrier, and never with a wrong hash', async () => {
  const markdown = await fromMarkdown(':::example {label="Пример"}\n```html\n<b>x</b>\n```\n:::\n');
  const [foreign] = markdown.value.root.slots.default;
  assert.equal(foreign.type, 'content.foreign');
  assert.match(foreign.data.hash, /^sha256:[0-9a-f]{64}$/u);
  assert.equal((await toMarkdown(markdown.value)).value, ':::example {label="Пример"}\n```html\n<b>x</b>\n```\n:::\n');
  const editorjs = await toEditorJs(markdown.value);
  assert.equal(editorjs.value.blocks[0].type, 'sf-foreign');
  assert.ok(editorjs.losses.some(({ code }) => code === 'not_expressible'));
  assert.equal(stable((await fromEditorJs(editorjs.value, { id: 'markdown' })).value), stable(markdown.value), 'the carrier brings it back');
  const carried = await toMarkdown((await fromEditorJs({ blocks: [{ id: 'c1', type: 'checklist', data: { items: [] } }] })).value);
  assert.equal(carried.value, ':::foreign {source=editorjs}\n```json\n{"id":"c1","type":"checklist","data":{"items":[]}}\n```\n:::\n');
  const back = await fromMarkdown(carried.value);
  assert.deepEqual(back.value.root.slots.default[0].data.raw, '{"id":"c1","type":"checklist","data":{"items":[]}}');
  const wrong = structuredClone(markdown.value);
  wrong.root.slots.default[0].data.raw += ' ';
  const refused = await toMarkdown(wrong);
  assert.equal(refused.value, '');
  assert.deepEqual(refused.losses.map(({ code }) => code), ['foreign_hash_mismatch']);
  assert.deepEqual((await toEditorJs(wrong)).losses.map(({ code }) => code), ['foreign_hash_mismatch']);
});

// 2026-11-11 acceptance (H2): a neighbour deleted next to a foreign Markdown
// block must not let the block swallow or be swallowed by what now stands
// beside it. Generated pages of Docara-like blocks, every block deleted in
// turn: what is written reads back as the edited Document, or the change is
// in the loss report.
const SNIPPETS = [
  'Para **one**.', '- one ![img](/i.png)\n- two', '- a\n- b', '1. x\n2. y', '    indented code', '<div>html</div>',
  '# Title', '| A | B |\n| --- | --- |\n| 1 | 2 |', '> quoted', ':::alert {type=info}\n#### T\n\nBody.\n:::', ':::example\nx\n:::',
  '```js\nconst a = 1;\n```', 'Setext\n===', '[ref]: /x', '***', '- [ ] task', '- a\n  - nested', 'text\n> lazy', 'Line with\\\nbreak', '1) other', '* star',
];
function pages(seed, count) {
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({ length: count }, () => Array.from({ length: 3 + Math.floor(random() * 4) }, () => SNIPPETS[Math.floor(random() * SNIPPETS.length)]).join('\n\n') + '\n');
}
const silentKinds = new Set(['block ids', 'ids of blocks without a directive']);

test('neighbour deletions around foreign Markdown blocks: read back as edited, or reported', async () => {
  let equal = 0;
  let reported = 0;
  let carried = 0;
  for (const page of pages(20261111, 120)) {
    const read = await fromMarkdown(page);
    const blocks = read.value.root.slots?.default || [];
    for (let index = 0; index < blocks.length; index += 1) {
      const edited = structuredClone(read.value);
      edited.root.slots.default.splice(index, 1);
      const out = await toMarkdown(edited);
      const back = await fromMarkdown(out.value);
      const same = stable(withoutIds(normalizedTree(back.value.root.slots?.default || []))) === stable(withoutIds(normalizedTree(edited.root.slots.default)));
      if (out.losses.some(({ what }) => what.endsWith('written in a carrier'))) carried += 1;
      if (same) { equal += 1; continue; }
      reported += 1;
      assert.ok(out.losses.some(({ what }) => !silentKinds.has(what) && !what.endsWith('written in a carrier')), `a change without a loss:\n${page}\n-- deleted ${index} --\n${out.value}`);
    }
  }
  assert.ok(equal > 300 && carried > 5, `${equal} equal, ${reported} reported, ${carried} carried`);
});

test('a foreign Markdown raw that is not one block of itself goes in the carrier; a carriage return is reported', async () => {
  const doc = { root: { id: 'root', type: 'content.document', slots: { default: [
    { id: 'f', type: 'content.foreign', data: { source: 'markdown', raw: 'a\n\nb' } },
    { id: 'g', type: 'content.foreign', data: { source: 'markdown', raw: 'plain' } },
    { id: 'h', type: 'content.foreign', data: { source: 'html', raw: '<p>a</p>\r\n' } },
  ] } } };
  const out = await toMarkdown(doc);
  const back = await fromMarkdown(out.value);
  assert.deepEqual(back.value.root.slots.default.map(({ data }) => data.raw), ['a\n\nb', 'plain', '<p>a</p>\n']);
  assert.ok(out.losses.some(({ path, what }) => path === '$.root.slots.default[2].data.raw' && /carriage return/u.test(what)));
  // A carrier read from a page: a block that needs it is printed back in it;
  // one that does not is written bare, and the read said form_normalized.
  const needed = ':::foreign {source=markdown}\n```markdown\na\n\nb\n```\n:::\n';
  const kept = await fromMarkdown(needed);
  assert.deepEqual(kept.losses, []);
  assert.equal((await toMarkdown(kept.value)).value, needed);
  const carrier = ':::foreign {source=markdown}\n```markdown\n- one ![img](/i.png)\n- two\n```\n:::\n';
  const again = await fromMarkdown(carrier);
  assert.equal(again.value.root.slots.default[0].data.raw, '- one ![img](/i.png)\n- two');
  assert.ok(again.losses.some(({ code }) => code === 'form_normalized'));
  assert.equal((await toMarkdown(again.value)).value, '- one ![img](/i.png)\n- two\n');
});
