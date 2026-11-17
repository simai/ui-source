// The Smart reference is generated from the manifests: a method, an action, a
// setting or the AI guidance that names a dated event alias as what the element
// sends teaches the former name as current (DEV docs-actuality audit
// 2026-11-17, (b) 4: sf-menu-context chooseTab() "emit sf-context-menu-tab",
// sf-header-site open() "cancels sf-site-header-open"). The alias entries
// themselves (events with alias_of) and the version notes are history.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../src/smart/', import.meta.url);
// Found by this test on 2026-11-17 and not fixed here (reported to the dispatcher).
const KNOWN = new Set([
  'confirm-change contracts/answers/const sf-change-confirm-answer',
  'confirm-change events/sf-confirm-change-answer/summary sf-change-confirm-accept',
  'confirm-change events/sf-confirm-change-expired/summary sf-change-confirm-expire',
  'editor-overlay ai_guidance/use_when sf-composition-overlay-edit',
  'sortable ai_guidance/use_when sf-sortable-intent',
  'theme-generator events/change/summary sf-theme-change',
  'resizer ai_guidance/do_not/2 sf-resize',
]);

function findings() {
  const out = [];
  for (const unit of readdirSync(root)) {
    const file = new URL(`${unit}/smart.manifest.json`, root);
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    const aliases = Object.entries(manifest.events ?? {})
      .filter(([name, event]) => event?.alias_of && name.startsWith('sf-')).map(([name]) => name);
    if (!aliases.length) continue;
    const walk = (value, path) => {
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, String(index)]));
      else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (path.length === 1 && path[0] === 'events' && aliases.includes(key)) continue;
          if (path.length === 0 && key === 'compatibility') continue; // the migration notes are history
          walk(item, [...path, key]);
        }
      } else if (typeof value === 'string' && !/alias/iu.test(value)) {
        for (const alias of aliases) {
          if (new RegExp(`(?<![\\w-])${alias}(?![\\w-])`, 'u').test(value)) out.push(`${unit} ${path.join('/')} ${alias}`);
        }
      }
    };
    walk(manifest, []);
  }
  return out;
}

test('the reference names no dated event alias as what an element sends', () => {
  const fresh = findings().filter((line) => !KNOWN.has(line));
  assert.deepEqual(fresh, []);
});

test('sf-menu-context and sf-header-site name their current events', () => {
  const menu = JSON.parse(readFileSync(new URL('menu-context/smart.manifest.json', root), 'utf8'));
  assert.match(menu.methods.chooseTab.summary, /sf-menu-context-tab/u);
  assert.match(menu.methods.requestClose.summary, /sf-menu-context-close/u);
  const header = JSON.parse(readFileSync(new URL('header-site/smart.manifest.json', root), 'utf8'));
  assert.match(header.methods.open.summary, /sf-header-site-open/u);
  assert.match(header.methods.close.summary, /sf-header-site-close/u);
  const docs = readFileSync(new URL('menu-context/docs/docs.md', root), 'utf8');
  assert.doesNotMatch(docs, /addEventListener\('sf-context-menu-/u);
});
