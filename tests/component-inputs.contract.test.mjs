// Every property a component accepts must be described in its manifest, because
// the manifest is what the registry publishes and what a consumer reads. Round
// four of the dataview table added three translatable labels and declared none
// of them, so the consumer found them only by reading our source and passed
// them through a host data attribute instead. A property nobody can discover is
// a property they have to guess.
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../src/smart/', import.meta.url).pathname;

// A prop's attribute is the name a consumer writes in markup. When a component
// does not name one, the attribute is the kebab-case of the property.
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();

// `templateName` is the one property whose manifest name differs by convention:
// every component takes it as `template`.
const ALIASES = new Map([['templateName', 'template']]);

const declaredProps = (source) => {
  const block = source.match(/static get props\(\)[^{]*\{([\s\S]*?)\n {4}\}/u);
  if (!block) return [];
  const props = [];
  const pattern = /^\s{6,14}([A-Za-z][A-Za-z0-9]*):\s*\{([\s\S]*?)\}/gmu;
  let match;
  while ((match = pattern.exec(block[1]))) {
    const [, name, body] = match;
    const attribute = body.match(/attribute:\s*["']([^"']+)["']/u);
    props.push({name, attribute: attribute?.[1] ?? null});
  }
  return props;
};

const components = readdirSync(root, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(root, name, 'smart.manifest.json'))
    && existsSync(join(root, name, 'index.js')));

test('every declared property is described in the component manifest', () => {
  assert.ok(components.length > 30, `expected the whole Smart set, found ${components.length}`);
  const undocumented = [];
  for (const name of components) {
    const manifest = JSON.parse(readFileSync(join(root, name, 'smart.manifest.json'), 'utf8'));
    const described = new Set(Object.keys(manifest.inputs?.properties ?? {}));
    for (const prop of declaredProps(readFileSync(join(root, name, 'index.js'), 'utf8'))) {
      const candidates = new Set([
        prop.name,
        kebab(prop.name),
        ALIASES.get(prop.name) ?? prop.name,
        ...(prop.attribute ? [prop.attribute] : []),
      ]);
      if (![...candidates].some((candidate) => described.has(candidate))) {
        undocumented.push(`${name}: ${prop.attribute ?? kebab(prop.name)}`);
      }
    }
  }
  assert.deepEqual(undocumented, [], `undocumented inputs:\n  ${undocumented.join('\n  ')}`);
});

