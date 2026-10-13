import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Smart Drawer separates modality from its visual overlay', async () => {
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /modal:\s*\{type: Boolean, default: true\}/);
  assert.match(source, /get modal\(\)/);
  assert.match(source, /drawerStack\.find\(drawer => drawer\.openState && drawer\.modal\)/);
  assert.match(source, /if \(!this\.modal\) return;/);
  assert.match(source, /aria-modal=\$\{context\.modal \? 'true' : nothing\}/);
  assert.match(source, /\?hidden=\$\{!context\.modal \|\| !context\.overlay\}/);
});

test('Smart Drawer preserves live authored nodes and exposes concise triggers', async () => {
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /this\._contentNodes = Array\.from\(this\.childNodes\)/);
  // The authored nodes are still moved rather than cloned; they are split now,
  // because a child asking for the edge stands beside the panel instead of in
  // it. What this guards is that nothing is serialised and re-parsed.
  assert.match(source, /body\.replaceChildren\(\.\.\.this\._contentNodes\.filter\(/);
  assert.match(source, /area\.append\(\.\.\.new Set\(waiting\)\)/);
  assert.doesNotMatch(source, /_initialContentHtml|body\.innerHTML/);
  assert.match(source, /\[data-drawer\]/);
  assert.match(source, /getAttribute\('aria-controls'\)/);
  assert.match(source, /data-sf-drawer-open/);
});

test('Smart Drawer geometry uses semantic tokens and logical placement', async () => {
  const [source, styles] = await Promise.all([
    read('src/smart/drawer/index.js'),
    read('src/smart/drawer/scss/_smart__drawer.scss'),
  ]);
  // The size speaks the shared ladder, and still answers to the words it
  // replaced: see contracts/public-api-axes.json.
  assert.match(source, /values: \['1\/2', '1', '2', 'full'\]/);
  assert.match(source, /valueAliases: \{'1\/2': \['small'\], 1: \['medium'\], 2: \['large'\]\}/);
  // The prop config is the single source: the getter reads it rather than
  // repeating the list, or the template and the getter could disagree.
  assert.match(source, /get size\(\) \{\s*return this\.getProp\('size'\);/);
  assert.match(styles, /var\(--sf-radius--surface\)/);
  assert.match(styles, /var\(--sf-elevation-4--shadow\)/);
  assert.match(styles, /var\(--sf-duration-normal\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /data-sf-drawer-placement='inline-start'/);
  assert.match(styles, /data-sf-drawer-placement='inline-end'/);
  assert.doesNotMatch(styles, /\b(?:8|12|14|16|24|32|48|390|9000)px\b/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
});
