import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

// sf-tag (2026-11-11): the gap after a leading picture is the tag's own value,
// not the label's text inset (--sf-ui-*--text-space-x), so one step no longer
// drives both.
test('the label after a leading picture starts at the tag picture gap', async () => {
  const css = await read('src/component/tags/scss/_css__tags.scss');
  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) {
    const at = css.indexOf(`.sf-tag.sf-tag--size-${size} {\n  --sf-tag--gap`);
    const block = css.slice(at, css.indexOf("}", at));
    assert.ok(block.includes(`--sf-tag--picture-gap: var(--sf-tag-picture-gap, var(--sf-tag--picture-gap-${size}));`), size);
    assert.doesNotMatch(block, /--sf-tag--picture-gap:[^;]*text-space-x/u, size);
  }
  // The ladder: today's text step per screen and density, 8 at size 1/2.
  const ladder = css.slice(0, css.indexOf('@layer sf.components'));
  assert.doesNotMatch(ladder, /var\(--sf-ui-[^)]*text-space-x/u);
  assert.equal([...ladder.matchAll(/--sf-tag--picture-gap-1\\\/2: var\(--sf-a8\);/gu)].length, 4);
  // Monotone (DEV 2026-11-11): in every context (phone, desktop, compact,
  // explicit size / normal region) no size has a smaller gap than a smaller
  // size, and sizes 1 and up are at least 8.
  const step = (token) => ({a: 0, b: 10, c: 20})[token[0]] + Number(token.slice(1));
  const blocks = [...ladder.matchAll(/\{([^{}]*--sf-tag--picture-gap-[^{}]*)\}/gu)].map((m) => m[1]);
  assert.equal(blocks.length, 4);
  for (const block of blocks) {
    const gaps = ['1\\/3', '1\\/2', '1', '2', '3'].map((size) => step(block.match(new RegExp(`--sf-tag--picture-gap-${size.replace('/', '\\/')}: var\\(--sf-([abc]\\d)\\);`, 'u'))[1]));
    for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] >= gaps[i - 1], `monotone ${gaps}`);
    assert.ok(gaps.slice(2).every((gap) => gap >= 8), `sizes 1+ at least 8: ${gaps}`);
  }
  // Every appearance state rule names outline beside its former name surface.
  for (const state of [/interactive:is\(\.sf-tag--appearance-outline, \.sf-tag--appearance-surface\):not\(:disabled\):not\(\.disabled\):hover,/u,
    /interactive:is\(\.sf-tag--appearance-outline, \.sf-tag--appearance-surface\):not\(:disabled\):not\(\.disabled\):hover \{\s*--sf-tag--box-shadow/u,
    /\.sf-tag:is\(\.sf-tag--appearance-outline, \.sf-tag--appearance-surface\):is\(:disabled, \.disabled\),/u]) assert.match(css, state);
  assert.doesNotMatch(css, /\.sf-tag--appearance-surface:(?:not|is)\(:disabled/u);
  // Ink (owner, 2026-11-11): between a leading picture and the remove cross
  // the label ends at the picture gap too, and after an icon the cross moves
  // on by the close-optical step (1 px where the icon is 24 or more).
  assert.match(css, /\+ \.sf-tag-container:has\(\+ :is\(:is\(sf-button-close, sf-close\), :is\(sf-button-icon, sf-icon-button\), \.sf-icon-button--close\)\) \{\s*--sf-tag-container--padding-inline-end: var\(--sf-tag--picture-gap\);/u);
  assert.match(css, /:is\(\.sf-icon, sf-icon\) \+ \.sf-tag-container:has\([^{]*\{\s*--sf-tag-container--padding-inline-end: calc\(var\(--sf-tag--picture-gap\) \+ var\(--sf-tag--close-optical\)\);/u);
  assert.equal([...ladder.matchAll(/--sf-tag--close-optical-[^:]+: (?:var\(--sf-a1\)|calc\(var\(--sf-px\) \* 0\));/gu)].length, 20);
  assert.match(css, /\.sf-tag :is\(\.sf-icon, sf-icon, \.sf-tag-check, \.sf-dot, \.sf-tag-color-icon, \.sf-avatar\) \+ \.sf-tag-container \{\s*--sf-tag-container--padding-inline-start: var\(--sf-tag--picture-gap\);\s*\}/u);
  const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
  const tag = contract.components.find((c) => c.component === 'tag');
  assert.ok(tag.variables.some((v) => v.name === '--sf-tag-picture-gap'));
});
