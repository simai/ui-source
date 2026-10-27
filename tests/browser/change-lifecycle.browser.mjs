#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Two things only the built classes can say. Every attribute and value alias a
// Smart component still answers to has a record in contracts/changes/journal.json,
// so nothing is kept for compatibility without a date to leave by. And a page
// that uses a legacy name gets it noted in SF.deprecations, with no console
// output unless it opted in.
import {resolve, join, dirname} from 'node:path';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const smart = join(out, 'smart', 'smart');
const journal = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'changes', 'journal.json'), 'utf8'));
const recorded = new Set(journal.records.flatMap((record) => record.items.map((item) => `${item.component || ''}|${item.from}`)));
const names = readdirSync(smart).filter((name) => existsSync(join(smart, name, 'js', `${name}.js`)) && existsSync(join(smart, name, 'smart.manifest.json')));
const failures = [];
let aliases = 0;
const browser = await chromium.launch();
try {
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(smart, name, 'smart.manifest.json'), 'utf8'));
    const tag = manifest.custom_element?.tag || manifest.custom_element;
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({path: join(out, 'core', 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smart, name, 'js', `${name}.js`)});
    const declared = await page.evaluate((tag) => {
      const Ctor = customElements.get(tag);
      if (!Ctor) return [];
      // sf-resizer draws nothing: a plain element made from its component.json
      // (standard 1.3.8), not the Smart base, so its old names are rows of its aliases.json.
      // The editors (sf-sortable, sf-inline-editor, sf-composition-overlay) are
      // plain elements of the composition modules over their component.json
      // (core/js/composition/manifest-host.mjs): no Smart base, no template;
      // their settings are checked by their probe.json.
      if (typeof Ctor.normalizePropConfig !== 'function') return [];
      const rows = [];
      for (const [key, config] of Object.entries(Ctor.props || {})) {
        const normal = Ctor.normalizePropConfig(key, config);
        for (const alias of normal.aliases || []) rows.push(alias);
        for (const legacy of Object.values(normal.valueAliases || {})) rows.push(...[].concat(legacy).map(String));
      }
      return rows;
    }, tag);
    await page.close();
    for (const from of declared) {
      aliases += 1;
      if (!recorded.has(`${tag}|${from}`) && !recorded.has(`|${from}`)) failures.push(`${tag}: alias ${from} has no record in the change journal`);
    }
  }

  // The note itself, on a real component: sf-button with the legacy type.
  for (const optIn of [false, true]) {
    const page = await browser.newPage();
    const warnings = [];
    page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
    await page.goto('about:blank');
    if (optIn) await page.evaluate(() => { document.documentElement.dataset.sfDeprecations = 'warn'; });
    await page.addScriptTag({path: join(out, 'core', 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smart, 'button', 'js', 'button.js')});
    const seen = await page.evaluate(async () => {
      document.body.innerHTML = '<sf-button type="outline" text="A"></sf-button><sf-button type="outline" text="B"></sf-button>';
      await new Promise((settle) => setTimeout(settle, 200));
      return {list: globalThis.SF?.deprecations?.list?.() ?? null, appearance: document.querySelector('.sf-button')?.className || ''};
    });
    await page.close();
    const where = optIn ? 'opted in' : 'by default';
    const note = (seen.list || []).find((entry) => entry.component === 'sf-button' && entry.from === 'type');
    if (!note) failures.push(`${where}: sf-button type= is not noted in SF.deprecations (${JSON.stringify(seen.list)})`);
    else if (note.to !== 'appearance') failures.push(`${where}: the note names ${note.to}, expected appearance`);
    if (!seen.appearance.includes('sf-button--outline')) failures.push(`${where}: the legacy name stopped working (${seen.appearance})`);
    const ours = warnings.filter((text) => text.includes('legacy name'));
    if (!optIn && ours.length) failures.push(`by default: ${ours.length} console warning(s), expected none`);
    if (optIn && ours.length !== 1) failures.push(`opted in: ${ours.length} console warnings for two uses, expected one: ${JSON.stringify(ours)}`);
  }

  // Every legacy name the button still answers to is noted, and a legacy
  // status still paints: danger and critical drew a primary button, and
  // icon-left, icon-right and tightness worked without a note (documentation
  // trial 6, 2026-10-18).
  {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({path: join(out, 'core', 'core', 'js', 'smart-base.js')});
    await page.addScriptTag({path: join(smart, 'button', 'js', 'button.js')});
    const seen = await page.evaluate(async () => {
      document.body.innerHTML = '<sf-button id="d" status="danger" text="A"></sf-button><sf-button id="c" status="critical" text="B"></sf-button>'
        + '<sf-button icon-left="add" icon-right="close" tightness="low" text="C"></sf-button>';
      await new Promise((settle) => setTimeout(settle, 200));
      return {list: globalThis.SF?.deprecations?.list?.() ?? [], danger: document.querySelector('#d .sf-button')?.className || '', critical: document.querySelector('#c .sf-button')?.className || ''};
    });
    await page.close();
    for (const [kind, from, to] of [['value', 'danger', 'error'], ['value', 'critical', 'error'], ['attribute', 'icon-left', 'icon-start'], ['attribute', 'icon-right', 'icon-end'], ['attribute', 'tightness', 'spacing']]) {
      // A renamed attribute of a component built from its component.json is noted
      // by the dated aliases as a setting (standard 1.3.8 §16.20).
      if (!seen.list.some((entry) => entry.component === 'sf-button' && (entry.kind === kind || (kind === 'attribute' && entry.kind === 'setting')) && entry.from === from && entry.to === to)) failures.push(`sf-button ${from} is not noted as ${to} (${JSON.stringify(seen.list)})`);
    }
    if (!seen.danger.includes('sf-button--error') || !seen.critical.includes('sf-button--error')) failures.push(`sf-button status danger/critical does not paint error (${seen.danger} / ${seen.critical})`);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({components: names.length, aliases, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
