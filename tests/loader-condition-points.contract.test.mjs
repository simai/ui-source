import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../', import.meta.url).pathname;

/* A utility module is built per condition -- a breakpoint or a state -- and
   the Loader fetches a page's modules by walking a fixed list of those
   conditions. A condition missing from the list is recognised on the page and
   never fetched: `focus-visible:` classes were registered by the rules and
   loaded by nothing, so they worked only from the full utility sheet. Every
   condition folder a utility ships is in the walk. */
test('the Loader walks every condition a utility module is built for', () => {
  const source = readFileSync(join(root, 'src/core/js/loader.js'), 'utf8');
  const walk = source.match(/sortPlugins = function[\s\S]*?const breakpoints = \[([\s\S]*?)\];/u);
  assert.ok(walk, 'sortPlugins declares its list of conditions');
  const walked = new Set([...walk[1].matchAll(/'([a-z-]+)'/gu)].map((match) => match[1]));

  const shipped = new Set();
  const utilities = join(root, 'src/utility');
  for (const name of readdirSync(utilities)) {
    const module = join(utilities, name);
    if (!statSync(module).isDirectory()) continue;
    for (const condition of readdirSync(module)) {
      if (statSync(join(module, condition)).isDirectory()) shipped.add(condition);
    }
  }
  const missing = [...shipped].filter((condition) => !walked.has(condition)).sort();
  assert.deepEqual(missing, [], `conditions built but never fetched: ${missing.join(', ')}`);
});
