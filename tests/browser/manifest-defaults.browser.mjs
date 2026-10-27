#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/smart /absolute/path/to/distr
// A manifest default is what the component does when the attribute is absent:
// every Smart component is rendered with no attributes and each manifest
// default is compared with the value its template receives (else its getter,
// else getProp). Exemptions are in contracts/manifest-defaults.json.
import {resolve, join, dirname} from 'node:path';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[3]) throw new Error('Smart output root and distr root are required');
const smartRoot = resolve(process.argv[2]);
const distrRoot = resolve(process.argv[3]);
const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'manifest-defaults.json'), 'utf8'));
const listed = new Map([...contract.derived, ...contract.pending].map((entry) => [`${entry.component}.${entry.prop}`, entry]));
const names = readdirSync(smartRoot).filter((name) =>
  existsSync(join(smartRoot, name, 'js', `${name}.js`)) && existsSync(join(smartRoot, name, 'smart.manifest.json')));

const empty = (value) => value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length);
const same = (manifest, actual) => {
  if (empty(manifest) && empty(actual)) return true;
  if (Array.isArray(actual) && typeof manifest === 'string') return manifest === JSON.stringify(actual) || manifest === actual.join(',');
  if (typeof manifest === 'object' || typeof actual === 'object') return JSON.stringify(manifest) === JSON.stringify(actual);
  return String(manifest) === String(actual);
};

const browser = await chromium.launch();
const failures = [];
const differing = new Set();
let compared = 0;
try {
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(smartRoot, name, 'smart.manifest.json'), 'utf8'));
    const tag = manifest.custom_element?.tag || manifest.custom_element;
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({path: join(distrRoot, 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smartRoot, name, 'js', `${name}.js`)});
    const result = await page.evaluate(async ({tag, inputs}) => {
      const Ctor = customElements.get(tag);
      if (!Ctor) return {error: `${tag} is not defined`};
      // sf-resizer draws nothing: a plain element made from its component.json
      // (standard 1.3.8), not the Smart base, so its defaults are its manifest's by construction.
      // The editors (sf-sortable, sf-inline-editor, sf-composition-overlay) are
      // plain elements of the composition modules over their component.json
      // (core/js/composition/manifest-host.mjs): no Smart base, no template;
      // their settings are checked by their probe.json.
      if (typeof Ctor.normalizePropConfig !== 'function') return {rows: []};
      const element = document.createElement(tag);
      document.body.append(element);
      await new Promise((settle) => setTimeout(settle, 0));
      const getter = (key) => {
        for (let proto = Ctor.prototype; proto && proto.constructor.name !== 'SfBaseElement' && proto !== HTMLElement.prototype; proto = Object.getPrototypeOf(proto)) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, key);
          if (descriptor) return typeof descriptor.get === 'function';
        }
        return false;
      };
      const context = element.templateContext ? element.templateContext() : {};
      const rows = [];
      for (const [key, config] of Object.entries(Ctor.props || {})) {
        const attribute = element.resolveAttributeName(Ctor.normalizePropConfig(key, config)) || key;
        const spec = inputs[attribute] || inputs[key];
        if (!spec || !('default' in spec)) continue;
        const actual = key in context ? context[key] : getter(key) ? element[key] : element.getProp(key);
        rows.push({key, attribute, manifest: spec.default, actual: actual instanceof Object && !Array.isArray(actual) && actual.constructor !== Object ? String(actual) : actual});
      }
      element.remove();
      return {rows};
    }, {tag, inputs: manifest.inputs?.properties || {}});
    await page.close();
    if (result.error) { failures.push(`${name}: ${result.error}`); continue; }
    for (const row of result.rows) {
      compared += 1;
      if (same(row.manifest, row.actual)) continue;
      const id = `${name}.${row.key}`;
      differing.add(id);
      if (listed.has(id)) continue;
      failures.push(`${id} [${row.attribute}]: manifest says ${JSON.stringify(row.manifest)}, the component does ${JSON.stringify(row.actual)}`);
    }
  }
} finally {
  await browser.close();
}
for (const id of listed.keys()) if (!differing.has(id)) failures.push(`${id}: listed in contracts/manifest-defaults.json but no longer differs; remove it`);
if (compared < 500) failures.push(`only ${compared} defaults compared; the check is not reaching the manifests`);
console.log(JSON.stringify({components: names.length, compared, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
