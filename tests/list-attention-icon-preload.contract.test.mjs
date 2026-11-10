import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// R074 F3 (DEV acceptance): sf-list-attention's filled status icons reached the
// Loader only once the rows had drawn, after the page's first icon request; on
// icons.simai.io they drew at 1.05-1.15 s against rows at 0.11 s. The list now
// declares every status glyph it can draw when it connects, before it has
// items, and adds what only some lists draw when it draws -- through
// preloadControlIcons, as sf-segmented and sf-tag do.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/smart/list-attention/index.js'), 'utf8');

test('sf-list-attention declares every status glyph when it connects and when it draws', () => {
  assert.match(source, /import \{preloadControlIcons\} from '\.\.\/helpers\/cycle';/u);
  // The helper, not a path of its own.
  assert.doesNotMatch(source, /loader\.preloadIcons|SF\?\.Loader/u);
  // Every status, filled for the rows and outlined for the head's badges.
  assert.match(source, /export const STATUSES = \['error', 'warning', 'info', 'success'\];/u);
  assert.match(source, /\.\.\.STATUSES\.map\(\(one\) => \(\{icon: ICONS\[one\], filled: true\}\)\),\s*\.\.\.STATUSES\.map\(\(one\) => \(\{icon: ICONS\[one\], filled: false\}\)\),/u);
  // listIcons() always starts from them; at connect the settings add the controls' glyphs.
  assert.match(source, /const entries = \[\.\.\.STATUS_GLYPHS\];[\s\S]*?if \(host\?\.hasAttribute\?\.\('triage'\)\) menu\(\);[\s\S]*?if \(!context\) return entries;/u);
  assert.match(source, /connectedCallback\(\) \{\s*super\.connectedCallback\(\);[\s\S]*?preloadControlIcons\(this, listIcons\(this\)\);\s*\}/u);
  assert.match(source, /template\(\) \{\s*const context = this\.templateContext\(\);\s*preloadControlIcons\(this, listIcons\(this, context\)\);/u);
});
