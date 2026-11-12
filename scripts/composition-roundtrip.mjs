#!/usr/bin/env node
// Usage: node scripts/composition-roundtrip.mjs [--json] <checkout>...
//
// Backward compatibility of the editing operations (composition F3.1): every
// Composition Document stored in the given checkouts still validates as it
// did and goes through an editing session unchanged. The checkouts are only
// read: the files git tracks are scanned for JSON objects whose schema is
// simai.composition.document (whole JSON files, JSON inside HTML, Markdown,
// PHP or script text, HTML-escaped or backslash-escaped).
//
// For each Document (once per distinct content):
//   validate   - Composition.validate before and after the session: the same
//                diagnostics (unknown product types are reported, not fixed);
//   open       - createSession(document).document is byte-identical;
//   no-op      - setText with the stored content of every text field (islands
//                excepted: they take no typing) changes
//                nothing (or only normalizes: counted apart);
//   undo       - for every node: removeNode then undo, and for every text
//                field: an edit then undo, give the stored bytes back;
//   copy/paste - each top-level child copied, pasted after itself, undone.
// Exit 1 when any Document fails open, undo, copy/paste or validation parity.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Composition from '../src/core/js/composition/index.mjs';
import { textFields } from '../src/core/js/composition/composed.mjs';
import { normalizeInline } from '../src/core/js/composition/inline-model.mjs';
import { copyNodes, createSession, islandOf, pasteNodes, removeNode, setText } from '../src/core/js/composition/operations.mjs';
import { walk } from '../src/core/js/composition/tree.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EXTENSIONS = /\.(json|html?|md|php|mjs|js|ts|tsx|vue|txt|yml|yaml)$/u;
const MARKER = 'simai.composition.document';

// The built-in types plus the sample kits of the core, as the editor tests use them.
export function registry() {
  const kits = join(ROOT, 'src/core/kits/block');
  const extra = existsSync(kits) ? readdirSync(kits).map((name) => join(kits, name, 'type.json')).filter(existsSync).map((path) => JSON.parse(readFileSync(path, 'utf8'))) : [];
  return Composition.extendRegistry(extra);
}

const unescapeHtml = (text) => text.replace(/&quot;/gu, '"').replace(/&#34;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
const unescapeSlashes = (text) => text.replace(/\\(["\\/])/gu, '$1');

// The balanced {...} that starts at `start`, honouring JSON and JS strings.
function balanced(text, start) {
  let depth = 0;
  let inString = '';
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === inString) inString = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') inString = char;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

/** Composition Documents in a text: {documents, literals} (literals: markers inside text no JSON parse reaches, e.g. a JS object literal). */
export function harvest(text) {
  const documents = [];
  let literals = 0;
  for (const variant of new Set([text, unescapeHtml(text), unescapeSlashes(text), unescapeSlashes(unescapeHtml(text))])) {
    let from = 0;
    while ((from = variant.indexOf(MARKER, from)) !== -1) {
      let found = null;
      let brace = from;
      for (let tries = 0; tries < 400 && brace > 0 && !found; tries += 1) {
        brace = variant.lastIndexOf('{', brace - 1);
        if (brace === -1) break;
        const candidate = balanced(variant, brace);
        if (!candidate || candidate.length < from - brace) continue;
        for (const read of [JSON.parse, literal]) {
          if (found) break;
          try {
            const value = read(candidate);
            if (value && typeof value === 'object' && String(value.schema ?? '').startsWith(MARKER) && value.root && typeof value.root === 'object') found = value;
          } catch {
            // not data at this brace: try the next reading, then the brace before
          }
        }
      }
      if (found) documents.push(found);
      else if (variant === text) literals += 1;
      from += MARKER.length;
    }
  }
  return { documents, literals };
}

// A JavaScript object literal written as data (bare keys, single quotes,
// trailing commas) read as JSON; one that calls code or names variables
// stays unread and is counted as built by code.
function literal(candidate) {
  let out = '';
  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (char === "'" || char === '`') {
      let value = '';
      index += 1;
      while (index < candidate.length && candidate[index] !== char) {
        if (candidate[index] === '\\') { value += candidate[index + 1] === char ? char : candidate[index] + candidate[index + 1]; index += 2; continue; }
        if (char === '`' && candidate[index] === '$' && candidate[index + 1] === '{') throw new Error('template');
        value += candidate[index] === '"' ? '\\"' : candidate[index];
        index += 1;
      }
      out += `"${value}"`;
    } else if (char === '"') {
      const end = (() => { let at = index + 1; while (at < candidate.length && candidate[at] !== '"') at += candidate[at] === '\\' ? 2 : 1; return at; })();
      out += candidate.slice(index, end + 1);
      index = end;
    } else out += char;
  }
  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)\s*:/gu, '$1"$2":').replace(/,(\s*[}\]])/gu, '$1');
  return JSON.parse(out);
}

const json = (value) => JSON.stringify(value);
const codes = (result) => (result?.diagnostics ?? []).map((entry) => `${entry.code} ${entry.path}`).sort();

/** Runs the checks on one Document: {ok, normalizes, diagnostics, failures}. */
export function roundtrip(document, types = registry()) {
  const failures = [];
  const stored = json(document);
  const before = codes(Composition.validate(JSON.parse(stored), types));
  const context = { registry: types };
  const session = createSession({ document: JSON.parse(stored), context, history: { now: () => 0 } });
  if (json(session.document) !== stored) failures.push('open changed the Document');
  let normalizes = 0;
  const textNodes = [];
  const nodes = [];
  walk(session.document.root, (node, parent) => {
    if (parent) nodes.push(node.id);
    // An island takes no typing (the operations refuse it): its text is not edited here.
    if (islandOf(node, types)) return !types.types.has(node.type) ? false : true;
    for (const key of textFields(types.types.get(node.type))) if (Array.isArray(node.data?.[key])) textNodes.push([node.id, key, node.data[key]]);
    return true;
  });
  for (const [id, key, content] of textNodes) {
    const result = session.apply(setText, id, key, content);
    if (!result.ok) failures.push(`setText ${id}/${key} refused: ${result.reason}`);
    else if (!result.same) {
      if (json(normalizeInline(content)) === json(result.state.document && session.node(id)?.data?.[key])) normalizes += 1;
      else failures.push(`setText ${id}/${key} changed more than normalization`);
      session.undo();
    }
  }
  if (json(session.document) !== stored) failures.push('the no-op pass did not return the stored bytes');
  for (const id of nodes) {
    const removed = session.apply(removeNode, id);
    if (removed.ok) {
      session.undo();
      if (json(session.document) !== stored) failures.push(`remove+undo ${id} did not return the stored bytes`);
    }
  }
  for (const [id, key] of textNodes) {
    const edited = session.apply(setText, id, key, [{ type: 'text', value: 'edited' }]);
    if (edited.ok && !edited.same) {
      session.undo();
      if (json(session.document) !== stored) failures.push(`edit+undo ${id}/${key} did not return the stored bytes`);
    }
  }
  for (const [slot, children] of Object.entries(session.document.root.slots ?? {})) {
    (Array.isArray(children) ? children : []).forEach((child, index) => {
      const copied = copyNodes(session.state, [child.id], context);
      if (!copied.ok) return;
      const pasted = session.apply(pasteNodes, copied.clipboard, { parent: session.document.root.id, slot, index: index + 1 });
      if (pasted.ok) {
        session.undo();
        if (json(session.document) !== stored) failures.push(`copy+paste+undo ${child.id} did not return the stored bytes`);
      }
    });
  }
  const after = codes(Composition.validate(JSON.parse(json(session.document)), types));
  if (json(before) !== json(after)) failures.push('validation changed after the session');
  return { ok: failures.length === 0, normalizes, diagnostics: before, failures, nodes: nodes.length, texts: textNodes.length };
}

function filesOf(checkout) {
  try {
    return execFileSync('git', ['-C', checkout, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter((path) => EXTENSIONS.test(path));
  } catch {
    return [];
  }
}

/** Scans one checkout: the counts and the failures of its stored Documents. */
export function scan(checkout, types = registry()) {
  const revision = (() => { try { return execFileSync('git', ['-C', checkout, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
  const seen = new Map();
  let files = 0;
  let literals = 0;
  for (const path of filesOf(checkout)) {
    let text;
    try { text = readFileSync(join(checkout, path), 'utf8'); } catch { continue; }
    if (!text.includes(MARKER)) continue;
    files += 1;
    const found = harvest(text);
    literals += found.literals;
    for (const document of found.documents) {
      const key = json(document);
      if (!seen.has(key)) seen.set(key, { document, paths: [] });
      seen.get(key).paths.push(path);
    }
  }
  const documents = [...seen.values()].map(({ document, paths }) => ({ paths, ...roundtrip(document, types) }));
  return {
    checkout, revision, files, literals, documents: documents.length,
    failed: documents.filter((entry) => !entry.ok).length,
    valid: documents.filter((entry) => !entry.diagnostics.length).length,
    normalizes: documents.filter((entry) => entry.normalizes).length,
    nodes: documents.reduce((sum, entry) => sum + entry.nodes, 0),
    texts: documents.reduce((sum, entry) => sum + entry.texts, 0),
    diagnosticCodes: [...new Set(documents.flatMap((entry) => entry.diagnostics.map((line) => line.split(' ')[0])))].sort(),
    failures: documents.filter((entry) => !entry.ok).map((entry) => ({ paths: entry.paths, failures: entry.failures })),
    paths: documents.map((entry) => entry.paths[0]).sort(),
  };
}

function main(argv) {
  const asJson = argv.includes('--json');
  const types = registry();
  const report = argv.filter((arg) => !arg.startsWith('--')).map((checkout) => scan(checkout, types));
  if (asJson) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else for (const entry of report) process.stdout.write(`${entry.checkout} ${entry.revision}: ${entry.documents} documents from ${entry.files} files (${entry.literals} markers not JSON), ${entry.valid} valid as they are, ${entry.normalizes} normalized by a no-op setText, ${entry.failed} failed; ${entry.nodes} nodes, ${entry.texts} text fields${entry.diagnosticCodes.length ? `; diagnostics ${entry.diagnosticCodes.join(', ')}` : ''}\n`);
  return report.some((entry) => entry.failed) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
