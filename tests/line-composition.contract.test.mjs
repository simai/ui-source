import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* A badge or a progress scale in a table cell or a row of fields takes the text
   line of a form size, so the row keeps its control height. Measured before: a
   size 1/2 badge 28px and a size 1/2 scale 26px tall against a 20px line; no
   badge size fit the line at all. */
test('line composition: badge and scale take the text line', async () => {
  for (const name of ['badge', 'progress-scale', 'reference-link', 'tag']) {
    const manifest = JSON.parse(await read(`smart/${name}/smart.manifest.json`));
    assert.deepEqual(manifest.inputs.properties.line.enum, ['', '1/2', '1', '2'], name);
  }
  const badges = await read('component/badges/scss/_css__badges.scss');
  const scale = await read('component/progress-scale/scss/_css__progress_scale.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(badges.includes(`.sf-badge.sf-badge--line-${size} {`) && badges.includes(`--sf-badge--line-height: var(--sf-text-height-${size});`), `badge ${size}`);
    assert.ok(scale.includes(`.sf-progress-scale.sf-progress-scale--line-${size} {`) && scale.includes(`block-size: var(--sf-text-height-${size});`), `scale ${size}`);
  }
  const reference = await read('component/reference-link/scss/_css__reference_link.scss');
  for (const size of ['1\\/2', '1', '2']) assert.ok(reference.includes(`.sf-reference-link.sf-reference-link--line-${size} {`), `reference ${size}`);
  const tags = await read('component/tags/scss/_css__tags.scss');
  for (const size of ['1\\/2', '1', '2']) assert.ok(tags.includes(`.sf-tag.sf-tag--line-${size} {\n  --sf-tag--line: var(--sf-text-height-${size});`), `tag ${size}`);
  const tagRuntime = await read('smart/tag/index.js');
  assert.match(tagRuntime, /if \(line\) return \(\{ '1\/2': '1\/3', '1': '1\/2', '2': '1' \}\)\[line\];/);
  const core = await read('component/progress-scale/js/_progress_scale.js');
  assert.match(core, /onLine \? 'flex-row' : 'flex-col'/);
});
