#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/smart /absolute/path/to/distr
// A Smart template reads the value its component resolved, not the raw
// attribute. Each component is rendered with no attribute and with each
// declared attribute set in turn to each value its manifest allows (an
// arbitrary value where it names none); every key the template reads from its
// context, where the component defines a getter of that name, must equal the
// getter. Empty values (null, undefined, '', false) count as equal.
// Exemptions, each with its reason, are in contracts/template-context.json; one
// that no longer differs fails too, so the list cannot go stale.
//
// The sibling rule, on the same classes: a component reads a declared prop
// through something it defines (a getter, a method) or getProp(), never off
// this bare. static props creates no accessor, so such a read is undefined
// whatever the attribute says. Known defects are listed with their owner under
// undefined_reads.
import {resolve, join, dirname} from 'node:path';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[3]) throw new Error('Smart output root and distr root are required');
const smartRoot = resolve(process.argv[2]);
const distrRoot = resolve(process.argv[3]);
const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'template-context.json'), 'utf8'));
const exempt = new Set(contract.exemptions.map(({component, prop}) => `${component}.${prop}`));
const bareExempt = new Set((contract.undefined_reads || []).map(({component, prop}) => `${component}.${prop}`));
const bareSeen = new Set();
const names = readdirSync(smartRoot).filter((name) =>
  existsSync(join(smartRoot, name, 'js', `${name}.js`)) && existsSync(join(smartRoot, name, 'smart.manifest.json')));

const browser = await chromium.launch();
const failures = [];
const differing = new Set();
let checked = 0;
try {
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(smartRoot, name, 'smart.manifest.json'), 'utf8'));
    const tag = manifest.custom_element?.tag || manifest.custom_element;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('about:blank');
    await page.addScriptTag({path: join(distrRoot, 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smartRoot, name, 'js', `${name}.js`)});
    const result = await page.evaluate(async ({tag, inputs}) => {
      const Ctor = customElements.get(tag);
      if (!Ctor) return {error: `${tag} is not defined`};
      const ownGetter = (key) => {
        for (let proto = Ctor.prototype; proto && proto !== HTMLElement.prototype; proto = Object.getPrototypeOf(proto)) {
          if (proto.constructor.name === 'SfBaseElement') return false;
          const descriptor = Object.getOwnPropertyDescriptor(proto, key);
          if (descriptor) return typeof descriptor.get === 'function';
        }
        return false;
      };
      const empty = (value) => value === null || value === undefined || value === '' || value === false;
      const same = (a, b) => (empty(a) && empty(b)) || JSON.stringify(a) === JSON.stringify(b);
      const diffs = [];
      const read = new Set();
      let checked = 0;
      const entries = Object.entries(Ctor.props || {});
      // Set one attribute at a time, render, and compare every key the template
      // read that the component resolves with a getter: a value often resolves
      // from another attribute (kind sets type, line sets size), and a template
      // may read a resolved name that is not a declared prop at all.
      for (const [key, config] of entries) {
        const attribute = (config && typeof config === 'object' && config.attribute)
          || key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        const spec = inputs[attribute] || inputs[key] || {};
        const values = key === entries[0][0] ? [null] : [];
        values.push(...(spec.enum || ['x']), ...(spec.type === 'boolean' ? ['', 'false'] : []));
        for (const value of values) {
          const element = document.createElement(tag);
          if (value !== null) element.setAttribute(attribute, value);
          document.body.append(element);
          await new Promise((settle) => setTimeout(settle, 0));
          const keys = new Set();
          let context;
          const build = element.templateContext;
          element.templateContext = function recordReads(...args) {
            context = build.apply(this, args);
            return new Proxy(context, {get(target, name, receiver) {
              if (typeof name === 'string') keys.add(name);
              return Reflect.get(target, name, receiver);
            }});
          };
          try {
            element.template();
          } catch (error) {
            diffs.push({key: '(template)', attribute, value, error: error.message});
          }
          delete element.templateContext;
          for (const resolvedKey of keys) {
            if (!ownGetter(resolvedKey)) continue;
            read.add(resolvedKey);
            checked += 1;
            let resolved;
            try { resolved = element[resolvedKey]; } catch (error) { diffs.push({key: resolvedKey, attribute, value, error: error.message}); continue; }
            if (!same(context[resolvedKey], resolved)) diffs.push({key: resolvedKey, attribute, value, template: context[resolvedKey], resolved});
          }
          element.remove();
        }
      }
      const definedAnywhere = (key) => {
        for (let proto = Ctor.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
          if (Object.getOwnPropertyDescriptor(proto, key)) return true;
        }
        return false;
      };
      const own = [];
      for (let proto = Ctor.prototype; proto && proto.constructor.name !== 'SfBaseElement' && proto !== HTMLElement.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const name of Object.getOwnPropertyNames(proto)) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, name);
          for (const fn of [descriptor.value, descriptor.get, descriptor.set]) if (typeof fn === 'function') own.push(fn.toString());
        }
      }
      own.push(Ctor.toString());
      const source = own.join('\n');
      const probe = document.createElement(tag);
      const bare = [];
      for (const key of entries.map(([name]) => name)) {
        if (definedAnywhere(key) || Object.prototype.hasOwnProperty.call(probe, key)) continue;
        const pattern = key.replace(/\$/g, '\\$');
        if (new RegExp(`\\bthis\\??\\.${pattern}\\b(?!\\s*=(?!=))`).test(source)
          || new RegExp(`\\{[^}]*\\b${pattern}\\b[^}]*\\}\\s*=\\s*this\\b`).test(source)) bare.push(key);
      }
      return {checked, diffs, read: [...read], bare};
    }, {tag, inputs: manifest.inputs?.properties || {}});
    await page.close();
    if (result.error) { failures.push(`${name}: ${result.error}`); continue; }
    if (errors.length) failures.push(`${name}: page errors — ${errors.slice(0, 2).join(' | ')}`);
    checked += result.checked;
    for (const key of result.bare) {
      const id = `${name}.${key}`;
      bareSeen.add(id);
      if (!bareExempt.has(id)) failures.push(`${id}: read off this, where nothing defines it, so it is undefined; read it with getProp('${key}') or define a getter`);
    }
    const first = new Map();
    for (const diff of result.diffs) {
      const id = `${name}.${diff.key}`;
      differing.add(id);
      if (exempt.has(id)) continue;
      const entry = first.get(id) || {diff, count: 0};
      entry.count += 1;
      first.set(id, entry);
    }
    for (const [id, {diff, count}] of first) {
      const where = diff.value === null ? 'with no attribute' : `with ${diff.attribute}=${JSON.stringify(diff.value)}`;
      const more = count > 1 ? ` (and ${count - 1} more cases)` : '';
      failures.push(diff.error
        ? `${id} ${where}: ${diff.error}${more}`
        : `${id} ${where}: template reads ${JSON.stringify(diff.template)}, the component resolved ${JSON.stringify(diff.resolved)}${more}`);
    }
  }
} finally {
  await browser.close();
}
for (const id of bareExempt) if (!bareSeen.has(id)) failures.push(`${id}: listed under undefined_reads but no longer read bare; remove it`);
for (const id of exempt) if (!differing.has(id)) failures.push(`${id}: exempt in contracts/template-context.json but no longer differs; remove the exemption`);
console.log(JSON.stringify({components: names.length, checked, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
