#!/usr/bin/env node
// The layer and the audience of every name in
// src/core/contracts/public-js-api.json (owner decision D17, 2026-11-11: the
// documentation's Functions section lists the Framework's own functions,
// grouped by layer; a component's script API is documented on its component's
// page; an internal name is not listed for authors).
//
//   layer  where the name comes from: core (core.js), loader (the Loader, at
//          sf-loader-init), smart-base (the Smart base and the shared Smart
//          runtime modules), component (a component's or a Smart component's
//          script API, documented on that component's page).
//   audience  public -- listed for authors (in Functions when the layer is
//          not component, on the component's page when it is); internal --
//          not listed for authors.
//
// Beside them each name carries an author line (one sentence for authors,
// present tense, no history) and, when the documentation has a page for it,
// doc: the page's slug (language-neutral, an anchor after #). Those two are
// written by hand; this script derives the layer and the audience only.
//
// Both are derived: the layer from loaded_by, the audience from status, and
// the exceptions below say why a name differs from its rule. The fields are
// written right after "status" so a change to a summary elsewhere in an entry
// does not touch the same lines.
//
// Usage: node scripts/generate-public-js-api-layers.mjs [--write | --check]
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const CONTRACT = fileURLToPath(new URL('../src/core/contracts/public-js-api.json', import.meta.url));
export const LAYERS = ['core', 'loader', 'smart-base', 'component'];
export const AUDIENCES = ['public', 'internal'];

// A name whose layer is not what its loaded_by says, and why.
export const LAYER_EXCEPTIONS = {
  // Source src/core/js/theme-palette.js: a core module the Loader loads on
  // demand as the plugin theme-palette (sf-theme-generator imports it too).
  // A theme from one colour is a Framework function, not a component's API.
  'SF.ThemePalette': 'core',
  // Source src/smart/field-renderers: the shared field renderer set every
  // Smart table, record and filter draws its cells with, asked for through
  // the Loader's SF.whenFieldRenderers. It has no component page; it belongs
  // with the Smart base.
  'SF.fieldRenderers': 'smart-base',
};

// A name whose audience is not its status, and why.
export const AUDIENCE_EXCEPTIONS = {};

export function layerOf(entry) {
  if (LAYER_EXCEPTIONS[entry.name]) return LAYER_EXCEPTIONS[entry.name];
  const by = entry.loaded_by;
  if (by === 'core') return 'core';
  if (by === 'core-loader') return 'loader';
  if (by === 'smart-base') return 'smart-base';
  if (/^(?:component|smart)\//u.test(by)) return 'component';
  throw new Error(`${entry.name}: no layer for loaded_by "${by}"`);
}

export function audienceOf(entry) {
  return AUDIENCE_EXCEPTIONS[entry.name] ?? (entry.status === 'internal' ? 'internal' : 'public');
}

// Rewrites the text in place: each entry's "layer" and "audience" lines sit right
// after its "status" line, in the entry's own indentation.
export function render(text) {
  const contract = JSON.parse(text);
  const lines = text.split('\n');
  const out = [];
  let index = -1;
  let inGlobals = false;
  for (const line of lines) {
    if (/^ {2}"globals": \[/u.test(line)) inGlobals = true;
    if (inGlobals && /^ {6}"(?:layer|audience)": /u.test(line)) continue;
    out.push(line);
    const status = inGlobals && line.match(/^( {6})"status": /u);
    if (status) {
      index += 1;
      const entry = contract.globals[index];
      out.push(`${status[1]}"layer": ${JSON.stringify(layerOf(entry))},`);
      out.push(`${status[1]}"audience": ${JSON.stringify(audienceOf(entry))},`);
    }
  }
  if (index + 1 !== contract.globals.length) throw new Error(`status lines ${index + 1}, entries ${contract.globals.length}`);
  const result = out.join('\n');
  JSON.parse(result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--check';
  const text = readFileSync(CONTRACT, 'utf8');
  const next = render(text);
  if (mode === '--write') {
    writeFileSync(CONTRACT, next);
    console.log(`public-js-api: layer and audience written for ${JSON.parse(next).globals.length} names`);
  } else if (next !== text) {
    console.error('public-js-api: layer or audience out of date; run node scripts/generate-public-js-api-layers.mjs --write');
    process.exit(1);
  } else {
    console.log(`public-js-api: layer and audience current for ${JSON.parse(text).globals.length} names`);
  }
}
