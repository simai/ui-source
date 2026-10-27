import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// A component declares what it is built from twice: `composition.uses` in its
// manifest, which is what a reader and the Studio see, and `relation` in its
// rule, which is what the dynamic Loader actually fetches. Nothing held the two
// together, so they drifted: a page that asked for sf-pagination on demand got
// the component stylesheet and none of the five Smart components its template
// renders, and the rows-per-page dropdown came up empty.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ruleKeyOf = (source) => source.match(/SF\.RuleLoader\[['"]([^'"]+)/u)?.[1] ?? null;
const relationsOf = (source) => new Set([...source.matchAll(/name:\s*['"]([^'"]+)/gu)].map((m) => m[1]));

// A rule that only forwards: a Smart folder renamed by standard 1.3.8 §3, §21
// keeps its former bundle name as a dated Loader forward whose one relation is
// the new name (src/core/contracts/smart-rule-forwards.v1.json: cl-inputs ->
// cl-input). The Loader installs it as a rule, so naming the former key fetches
// the new one.
const forwardingRules = () => new Map(
  Object.entries(JSON.parse(readFileSync(resolve(root, 'src/core/contracts/smart-rule-forwards.v1.json'), 'utf8')).forwards)
    .map(([name, forward]) => [name, forward.to]),
);
const followed = (relation, forwards = forwardingRules()) => new Set([...relation, ...[...relation].map((name) => forwards.get(name)).filter(Boolean)]);

// A used id is matched by the id each manifest declares, not by its directory
// name. The two are the same everywhere but one place, and that place is this
// family: the table's manifest declares `smart.data-view` while living in
// src/smart/table, and the composite around it declares
// `smart.data-view-composite` while living in src/smart/data-view. Keyed by
// directory, sf-data-view's `uses: smart.data-view` resolved to sf-data-view
// itself and the check asked a composite to fetch itself. It stayed invisible
// only because no composite had a rule until sf-property-view needed one.
const layerKeys = (layer) => {
  const keys = new Map();
  for (const entry of readdirSync(resolve(root, `src/${layer}`), {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const rule = `src/${layer}/${entry.name}/rule.js`;
    const manifest = `src/${layer}/${entry.name}/${layer === 'smart' ? 'smart.manifest.json' : 'component.manifest.json'}`;
    if (!existsSync(resolve(root, rule))) continue;
    const key = ruleKeyOf(read(rule));
    if (!key) continue;
    const declared = existsSync(resolve(root, manifest))
      ? JSON.parse(read(manifest)).id
      : null;
    keys.set(declared ?? `${layer === 'smart' ? 'smart' : 'component'}.${entry.name}`, key);
    // The directory-derived name stays accepted, so a manifest that names a
    // component the way its folder is named is still understood.
    const byDirectory = `${layer === 'smart' ? 'smart' : 'component'}.${entry.name}`;
    if (!keys.has(byDirectory)) keys.set(byDirectory, key);
  }
  return keys;
};

test('every rule fetches what its own manifest says the component is built from', () => {
  const keys = new Map([...layerKeys('component'), ...layerKeys('smart')]);
  const gaps = [];

  for (const entry of readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const manifestPath = `src/smart/${entry.name}/smart.manifest.json`;
    const rulePath = `src/smart/${entry.name}/rule.js`;
    if (!existsSync(resolve(root, manifestPath)) || !existsSync(resolve(root, rulePath))) continue;

    const manifest = JSON.parse(read(manifestPath));
    const relation = followed(relationsOf(read(rulePath)));
    for (const used of manifest.composition?.uses ?? []) {
      const key = keys.get(used);
      // A used id with no rule of its own is nothing for the Loader to fetch.
      if (!key || relation.has(key)) continue;
      gaps.push(`${manifest.id}: the rule does not fetch ${used} (${key})`);
    }
  }

  assert.deepEqual(
    gaps,
    [],
    'a component that renders another one has to say so where the Loader reads it, not only where a reader does',
  );
});
