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
  assert.match(css, /\.sf-tag :is\(\.sf-icon, sf-icon, \.sf-tag-check, \.sf-dot, \.sf-tag-color-icon, \.sf-avatar\) \+ \.sf-tag-container \{\s*--sf-tag-container--padding-inline-start: var\(--sf-tag--picture-gap\);\s*\}/u);
  const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
  const tag = contract.components.find((c) => c.component === 'tag');
  assert.ok(tag.variables.some((v) => v.name === '--sf-tag-picture-gap'));
});
