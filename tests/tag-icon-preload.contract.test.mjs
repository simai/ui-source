import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// R074 F3: sf-tag's icon reached the Loader only once the tag had drawn, after
// the page's first icon request; a second request followed. The tag now asks
// for the glyphs it draws when it connects and when it draws, as sf-segmented
// does (preloadControlIcons, one request per distinct list).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/smart/tag/index.js'), 'utf8');

test('sf-tag asks for its drawn glyphs when it connects and when it draws', () => {
  assert.match(source, /import \{ preloadControlIcons \} from '\.\.\/helpers\/cycle';/u);
  const drawn = source.slice(source.indexOf('function drawnIcons(host)'), source.indexOf('\n}\n', source.indexOf('function drawnIcons(host)')));
  assert.match(drawn, /host\.type === 'icon' && !slotted\('leading'\)\) return \[host\.icon \|\| 'sell'\]/u);
  assert.match(drawn, /host\.type === 'avatar'[^\n]*return \['person'\]/u);
  assert.match(source, /connectedCallback\(\) \{\s*super\.connectedCallback\(\);[\s\S]*?preloadTagIcons\(this\);\s*\}/u);
  assert.match(source, /template\(\) \{\s*preloadTagIcons\(this\);\s*return renderTagTemplate\(this\.templateContext\(\)\);/u);
});
