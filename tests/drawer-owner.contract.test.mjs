import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Smart Drawer separates modality from its visual overlay', async () => {
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /modal:\s*\{type: Boolean, default: true\}/);
  assert.match(source, /get modal\(\)/);
  // A modal drawer locks the page, unless it stands in an overlay container.
  // The one page lock of the layer stack (layer-stack.js) holds while it is open.
  assert.match(source, /locksPage: modal && !drawer\.closest\(OVERLAY_CONTAINER\)/);
  // A docked drawer is modal while it floats -- without the room its
  // dock-breakpoint asks for -- and modeless as a column (1.8.0,
  // q-a49e2045c1); modal="false" keeps it modeless. It re-declares itself
  // to the stack when it crosses the breakpoint while open.
  assert.match(source, /return typeof document !== 'undefined' && !drawerManager\.reservesDock\(this\);/);
  assert.match(source, /drawer\.syncModal\(\);/);
  assert.match(source, /updateLayer\(this, drawerManager\.declares\(this\)\)/);
  assert.match(source, /role=\$\{context\.docked && !context\.modal \? 'region' : 'dialog'\}/);
  assert.match(source, /if \(!this\.modal\) return false;/);
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

test('Smart Drawer: bottom sheet, app bar offset and controlled close (simai/ui-source#20, #29)', async () => {
  const [source, styles, manifest] = await Promise.all([
    read('src/smart/drawer/index.js'),
    read('src/smart/drawer/scss/_smart__drawer.scss'),
    read('src/smart/drawer/smart.manifest.json').then(JSON.parse),
  ]);
  assert.match(source, /const PLACEMENTS = \['left', 'right', 'inline-start', 'inline-end', 'bottom'\]/);
  assert.match(source, /const SNAPS = \['auto', 'half', 'full'\]/);
  // A sheet is never a page column.
  assert.match(source, /getBooleanAttr\('docked', false\) && !this\.sheet/);
  // The close button stands down only while the outside switch is on screen.
  assert.match(source, /showClose: this\.showClose && !this\._switchVisible/);
  assert.match(styles, /inset-block: var\(--sf-drawer-block-start, 0\) 0/);
  assert.match(styles, /var\(--sf-drawer-dock-block-start, var\(--sf-drawer-block-start, 0\)\)/);
  assert.match(styles, /env\(safe-area-inset-bottom, 0\)/);
  assert.match(styles, /data-sf-drawer-placement='bottom'/);
  assert.deepEqual(manifest.inputs.properties.placement.enum, ['left', 'right', 'inline-start', 'inline-end', 'bottom']);
  for (const name of ['snap', 'controlled', 'block-start']) assert.ok(manifest.inputs.properties[name], name);
  assert.ok(manifest.events['drawer:snap']);
});

test('Smart Drawer: a docked column takes the page surface (simai/ui-source#26)', async () => {
  const [source, styles] = await Promise.all([
    read('src/smart/drawer/index.js'),
    read('src/smart/drawer/scss/_smart__drawer.scss'),
  ]);
  // The root says whether a docked drawer has the room and is a column of the
  // page; the manager decides it per drawer.
  assert.match(source, /data-sf-drawer-column=\$\{context\.column \? 'true' : 'false'\}/);
  assert.match(source, /drawer\.setDockColumn\(column\)/);
  // A column: the page's surface and no shadow; the raised surface and its
  // dimmed-text role stay with a floating panel.
  assert.match(styles, /\.sf-drawer\[data-sf-drawer-column='true'\] \.sf-drawer-panel \{[^}]*background: var\(--sf-drawer-background, var\(--sf-surface-0\)\);[^}]*box-shadow: none;/);
  assert.match(styles, /\.sf-drawer:not\(\[data-sf-drawer-column='true'\]\) \.sf-drawer-panel \{\s*background: var\(--sf-drawer-background, var\(--sf-elevation-4--surface\)\);[^}]*--sf-on-surface-variant: var\(--sf-on-elevation-4--variant\);/);
  // A docked drawer that floats (a narrow host) keeps its shadow.
  assert.doesNotMatch(styles, /\.sf-drawer\[data-sf-drawer-docked='true'\] \.sf-drawer-panel \{[^}]*box-shadow: none/);
});

test('Smart Drawer: a configurable dock threshold and a switch that hides a docked column (simai/ui-source#25)', async () => {
  const [source, manifest, size] = await Promise.all([
    read('src/smart/drawer/index.js'),
    read('src/smart/drawer/smart.manifest.json').then(JSON.parse),
    read('src/core/scss/_sf_css__size.scss'),
  ]);
  assert.match(source, /dockBreakpoint: \{attribute: 'dock-breakpoint', default: ''\}/);
  // The attribute, else the variable where the drawer stands, else 48rem.
  assert.match(source, /getPropertyValue\('--sf-drawer-dock-breakpoint'\)/);
  assert.match(source, /return themed \|\| `\$\{DOCK_MIN_REM\}rem`;/);
  assert.match(source, /const threshold = drawer\.dockBreakpoint;/);
  // A toggle switch says whether the panel is shown.
  assert.match(source, /element\.setAttribute\('aria-expanded', expanded\)/);
  assert.ok(manifest.inputs.properties['dock-breakpoint']);
  assert.ok(manifest.contracts.dock_host.properties.variables.const.includes('--sf-drawer-dock-breakpoint'));
  // Layout tokens: a reading column on the scale and the chat kit's floating panel.
  assert.match(size, /--sf-layout-reading-width: var\(--sf-h2\);/);
  assert.match(size, /--sf-layout-floating-panel-width: calc\(var\(--sf-g2\) \+ var\(--sf-b6\)\);/);
  assert.match(size, /--sf-layout-floating-panel-height: calc\(var\(--sf-h0\) \+ var\(--sf-d0\)\);/);
});
