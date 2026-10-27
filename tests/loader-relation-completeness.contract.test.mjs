import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// Three questions are asked of a rule's relation list, and this file asks the
// third. loader-relations asks whether every relation points at a rule that
// exists. runtime-relations asks whether it agrees with the manifest's
// composition.uses. Neither notices when both are incomplete in the same way,
// which is how the admin menu came to render four Smart elements it never
// fetched: a page that loaded it on demand got them only because something else
// on the page happened to pull them in, and Docara carried a hand-written
// dependency map to make up the difference.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ruleKeyOf = (source) =>
  source.match(/SF\.RuleLoader(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z0-9_-]+))/u)?.slice(1).find(Boolean) ?? null;
const relationsOf = (source) => new Set([...source.matchAll(/name:\s*['"]([^'"]+)['"]/gu)].map((m) => m[1]));

// A rule that only forwards: a Smart folder renamed by standard 1.3.8 §3, §21
// keeps its former bundle name as a dated rule with no tags of its own whose one
// relation is the new name (src/smart/input/rule.js: cl-inputs -> cl-input).
// The Loader follows it, so naming the former key fetches the new one.
const forwardingRules = () => {
  const forwards = new Map();
  for (const entry of readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})) {
    const rule = resolve(root, `src/smart/${entry.name}/rule.js`);
    if (!entry.isDirectory() || !existsSync(rule)) continue;
    for (const match of readFileSync(rule, 'utf8').matchAll(/SF\.RuleLoader\[['"]([^'"]+)['"]\] = \{\s*tags: \[\],[\s\S]*?relation: \[\{ name: '([^']+)' \}\]/gu)) forwards.set(match[1], match[2]);
  }
  return forwards;
};
const followed = (relation, forwards = forwardingRules()) => new Set([...relation, ...[...relation].map((name) => forwards.get(name)).filter(Boolean)]);

const smartDirectories = () =>
  readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

// Which Smart component owns each custom element, so a rendered tag can be
// traced back to the rule that loads it.
const tagOwners = () => {
  const owners = new Map();
  for (const name of smartDirectories()) {
    const manifestPath = `src/smart/${name}/smart.manifest.json`;
    if (!existsSync(resolve(root, manifestPath))) continue;
    const tag = JSON.parse(read(manifestPath)).custom_element;
    if (tag) owners.set(tag, name);
  }
  return owners;
};

const ruleKeys = () => {
  const keys = new Map();
  for (const name of smartDirectories()) {
    const rulePath = `src/smart/${name}/rule.js`;
    if (!existsSync(resolve(root, rulePath))) continue;
    const key = ruleKeyOf(read(rulePath));
    if (key) keys.set(name, key);
  }
  return keys;
};

const renderedTags = (name) => {
  const templates = resolve(root, `src/smart/${name}/js/templates`);
  const sources = [];
  if (existsSync(templates)) {
    for (const file of readdirSync(templates)) {
      if (file.endsWith('.js')) sources.push(read(`src/smart/${name}/js/templates/${file}`));
    }
  }
  const entry = `src/smart/${name}/index.js`;
  if (existsSync(resolve(root, entry))) sources.push(read(entry));
  return new Set([...sources.join('\n').matchAll(/<(sf-[a-z0-9-]+)/gu)].map((m) => m[1]));
};

test('a rule fetches every Smart element its own templates render', () => {
  const owners = tagOwners();
  const keys = ruleKeys();
  const gaps = [];

  for (const name of smartDirectories()) {
    const rulePath = `src/smart/${name}/rule.js`;
    const manifestPath = `src/smart/${name}/smart.manifest.json`;
    if (!existsSync(resolve(root, rulePath)) || !existsSync(resolve(root, manifestPath))) continue;

    const own = JSON.parse(read(manifestPath)).custom_element;
    const relation = followed(relationsOf(read(rulePath)));
    for (const tag of renderedTags(name)) {
      if (tag === own) continue;
      const owner = owners.get(tag);
      // A tag no Smart component owns is not something the Loader can fetch.
      if (!owner) continue;
      const key = keys.get(owner);
      if (!key || relation.has(key)) continue;
      gaps.push(`smart.${name}: renders ${tag} and does not fetch it (${key})`);
    }
  }

  assert.deepEqual(
    gaps,
    [],
    'a component that renders another one has to fetch it, or a page that loads it on demand is missing a part',
  );
});
