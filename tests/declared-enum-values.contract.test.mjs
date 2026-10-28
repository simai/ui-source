import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// A value a component does not know is a value that does nothing, quietly.
//
// sf-button's appearance is one of default, tonal, outline, link, surface and
// ghost. The property view asked nineteen of its buttons for «outlined», which
// is none of them, so each one drew with no border at all -- and because an
// unknown appearance falls back rather than failing, the only sign was that a
// button did not look like a button. The owner found it by eye on the stand,
// three weeks after it was written (owner, 2026-10-09).
//
// Every Smart manifest declares the values its attributes accept. This reads
// those enums and holds first-party sources to them. The fixtures are not
// included: a lab passing size="huge" is a lab checking what the component does
// with a value nobody should pass, which is the opposite of this mistake.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const sources = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  // static/ holds the first-paint snapshots (scripts/snapshot-first-paint.mjs):
  // what the templates draw, generated; the templates are the sources.
  if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'static' ? [] : sources(path);
  return ['.js', '.mjs', '.css', '.html'].includes(extname(entry.name)) ? [path] : [];
});

const manifests = () => {
  const declared = new Map();
  const known = new Map();
  for (const entry of readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(resolve(root, 'src/smart', entry.name, 'smart.manifest.json'), 'utf8'));
    } catch { continue; }
    const tag = manifest.custom_element;
    if (!tag) continue;
    const names = new Set(Object.keys(manifest.inputs?.properties ?? {}));
    for (const [name, spec] of Object.entries(manifest.inputs?.properties ?? {})) {
      if (Array.isArray(spec?.enum)) declared.set(`${tag}|${name}`, new Set(spec.enum));
    }
    known.set(tag, names);
  }
  return {declared, known};
};

// What any element may carry, whatever it is, plus the four the Smart base
// observes on every component it defines -- half the manifests name them and
// half do not, and which half is an accident of when each was written rather
// than a difference in what the component accepts.
const GLOBAL = new Set([
  'class', 'id', 'style', 'slot', 'title', 'role', 'hidden', 'tabindex', 'lang', 'dir', 'part',
  'template', 'root-class', 'root-style',
]);
const GLOBAL_PREFIX = /^(data|aria|on)-/u;

// A literal attribute on a literal tag. A bound value -- size=${context.size} --
// is not read here: what it holds is a question for the component that sets it.
const TAG = /<(sf-[a-z-]+)\b((?:[^<>])*?)>/gsu;
const ATTRIBUTE = /\b([a-z-]+)="([a-z0-9/._-]+)"/gu;

test('no first-party source asks a component for a value it does not declare', () => {
  const {declared} = manifests();
  assert.ok(declared.size > 50, `expected the manifests to declare enums, found ${declared.size}`);

  const wrong = [];
  for (const file of sources(resolve(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, tag, attributes] of text.matchAll(TAG)) {
      for (const [, name, value] of attributes.matchAll(ATTRIBUTE)) {
        const allowed = declared.get(`${tag}|${name}`);
        if (!allowed || allowed.has(value)) continue;
        wrong.push(`${relative(root, file)}: <${tag} ${name}="${value}"> — ${[...allowed].sort().join(', ')}`);
      }
    }
  }
  assert.deepEqual([...new Set(wrong)].sort(), KNOWN, 'these values are not among the ones the component declares');
});

// What is still wrong and is not this round's subject. sf-tabs asks its buttons
// for appearance="primary" (type="primary" until 2026-10-13), which is not one of the six appearances either; the tabs
// look right because an unknown appearance falls back to default, which is what
// they want anyway. Changing it would change how tabs draw, so it is recorded
// here rather than fixed in a round about the property view (owner, 2026-10-09).
const KNOWN_ATTRIBUTES = [];
const KNOWN = [
  // sf-button's ghost is a dated value alias of link (compatibility.aliases), not an appearance.
  'src/smart/tabs/js/templates/default.js: <sf-button appearance="primary"> — default, link, outline, surface, tonal',
  'src/smart/tabs/js/templates/default.js: <sf-icon-button appearance="primary"> — default, ghost, link, outline, surface, tonal',
];

// And an attribute a component does not declare is the same mistake wearing a
// different hat: the folded bin's chevron was written <sf-icon name="…">, where
// sf-icon reads `icon`, so the glyph came out empty and the row simply had no
// chevron in it. Nothing failed; there was just nothing there (owner,
// 2026-10-09).
test('no first-party source hands a component an attribute it does not declare', () => {
  const {known} = manifests();
  const wrong = [];
  for (const file of sources(resolve(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, tag, attributes] of text.matchAll(TAG)) {
      const names = known.get(tag);
      if (!names) continue;
      for (const [, name] of attributes.matchAll(ATTRIBUTE)) {
        if (names.has(name) || GLOBAL.has(name) || GLOBAL_PREFIX.test(name)) continue;
        wrong.push(`${relative(root, file)}: <${tag} ${name}="…">`);
      }
    }
  }
  assert.deepEqual([...new Set(wrong)].sort(), KNOWN_ATTRIBUTES,
    'these attributes are not among the ones the component declares');
});
