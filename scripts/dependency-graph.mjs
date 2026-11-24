#!/usr/bin/env node
// Usage:
//   node scripts/dependency-graph.mjs build --out <file> [--rev <rev>] [--release <ui-xxxxxxxxxxxx>]
//   node scripts/dependency-graph.mjs check [--rev <rev>] [--previous <inventory.json> | --releases <dir>] [--json]
//   node scripts/dependency-graph.mjs impact [--rev <rev>] [--previous <inventory.json> | --releases <dir>] [<unit id> ...] [--json]
//   node scripts/dependency-graph.mjs debt --write [--rev <rev>]      (records today's mismatches; a person's decision)
//
// The dependency graph of SIMAI Framework (owner decisions C249-C251,
// 2026-11-16): one graph, built at every pair from what the source declares and
// what it really draws, shipped beside the unit inventory
// (ui/contracts/releases/ui-<12>.graph.json, written by `linkage.mjs inventory`),
// and two gates over it:
//
// - C249, the graph. Nodes are units (component, smart, utility, plugin and the
//   foundations they name) with their versions; edges are
//     depends   a unit passport's `dependencies` (src/{component,utility,plugin}/*/passport.json)
//     uses      a Smart manifest's `composition.uses` (src/smart/*/smart.manifest.json)
//     relation  the Loader's relations (src/smart/*/component.json, src/component/*/rule.js),
//               rule names resolved to units through the dated forwards
//     loads     what a Smart component's code really imports, places as <sf-tag> or draws as a
//               plain sf-* class (shared helpers followed; `via_shared` when only a shared helper draws it)
//     twin      a plain component and its Smart twin (contracts/graph/twins.json; C251)
//   Every node carries its reverse links (`used_by`), so "who is hit when X
//   changes" is one walk.
//
// - C250, declared against loaded. A Smart component that draws a unit its
//   manifest does not declare (`missing`), or declares one it never draws
//   (`unused`), is a mismatch. The mismatches of 2026-11-16 are dated debt in
//   contracts/graph/dependency-debt.json. The gate fails on a mismatch that is
//   not debt, and on debt that is no longer true (fixed: remove the entry in the
//   same change).
//
// - C251, twins. A plain component and its Smart twin are one look in two
//   models; Smart is the default model (C224). The gate fails when a twin pair
//   shows a divergence that is not recorded debt (contracts/graph/twin-debt.json),
//   when recorded divergence is gone, and -- against the previous pair's
//   inventory -- when one twin's files changed and the other's did not, unless
//   contracts/graph/twin-intent.json marks that change (unit and version) as
//   intended for one side only.
//
// The impact list: for every unit that changed since the previous pair, the
// Smart components and plain components that reach it, their probes
// (tests/browser) and, with UI_DOC_ROOT, the documentation pages that show them.
//
// The source is read at a git ref (HEAD by default), never from the working
// tree: what is checked is what a release builds. The contracts/graph files are
// read from the working tree, as the other contract files are.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {collectUnits, compareInventories, inventoryOf, readCommittedTree, rehashInventory} from './linkage.mjs';

export const GRAPH_SCHEMA = 'simai.framework.dependency-graph';
export const GRAPH_SCHEMA_VERSION = 1;
export const OWNER = 'simai/ui-source';
export const DEBT_FILE = 'contracts/graph/dependency-debt.json';
export const TWINS_FILE = 'contracts/graph/twins.json';
export const TWIN_DEBT_FILE = 'contracts/graph/twin-debt.json';
export const TWIN_INTENT_FILE = 'contracts/graph/twin-intent.json';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORWARDS = 'src/core/contracts/smart-rule-forwards.v1.json';
// Folders of src/smart that are no component: code the components share.
const SHARED_SMART = new Set(['helpers', 'field-renderers']);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// The graph.

/**
 * Builds the graph from a tree (path -> Buffer of every file under src/, as
 * linkage.mjs reads it). `units` (collectUnits) supplies the versions of the
 * units that have no passport of their own folder (tokens, core, icons).
 */
export function buildGraph(tree, {revision = null, release = null, units = null, twins = null} = {}) {
  const files = [...tree.keys()].sort(byText);
  const fileSet = new Set(files);
  const cache = new Map();
  const text = (p) => {
    if (!cache.has(p)) cache.set(p, tree.has(p) ? tree.get(p).toString('utf8') : null);
    return cache.get(p);
  };
  const json = (p) => { const t = text(p); return t == null ? null : JSON.parse(t); };
  const dirsOf = (root) => [...new Set(files.filter((p) => p.startsWith(root) && p.slice(root.length).includes('/')).map((p) => p.slice(root.length).split('/')[0]))];
  const unitVersions = new Map((units ?? collectUnits(tree).units).map((unit) => [unit.id, unit.passport?.version ?? null]));

  const nodes = new Map();
  const edges = [];
  const node = (id, extra = {}) => {
    if (!nodes.has(id)) nodes.set(id, {id, type: id.split('.')[0], version: unitVersions.get(id) ?? null, declared: false, ...extra});
    else Object.assign(nodes.get(id), extra);
    return nodes.get(id);
  };
  const edge = (from, to, kind, source, props = {}) => { node(to); edges.push({from, to, kind, source, ...props}); };

  // Unit passports: component and plugin always; a utility when something names it.
  const utilityPassports = new Map();
  for (const p of files.filter((x) => /^src\/(component|plugin|utility)\/[^/]+\/passport\.json$/u.test(x))) {
    const pp = json(p);
    if (pp.kind === 'utility') { utilityPassports.set(pp.id, {p, pp}); continue; }
    node(pp.id, {type: pp.kind, version: pp.version, declared: true, source: p, dir: path.posix.dirname(p)});
    for (const d of pp.dependencies || []) edge(pp.id, d.id, 'depends', p, {range: d.range});
  }

  // Smart manifests.
  const smartDirs = dirsOf('src/smart/').filter((d) => !SHARED_SMART.has(d));
  const smartByDir = new Map();
  const smartByTag = new Map();
  const tagOf = new Map();
  for (const d of smartDirs) {
    const mp = `src/smart/${d}/smart.manifest.json`;
    const m = json(mp);
    if (!m) continue;
    const c = json(`src/smart/${d}/component.json`);
    const tag = m.custom_element || c?.tag || null;
    node(m.id, {type: 'smart', version: m.version, declared: true, source: mp, dir: `src/smart/${d}`, ...(tag ? {tag} : {}), ...(c?.family ? {family: c.family} : {})});
    smartByDir.set(d, m.id);
    if (tag) { smartByTag.set(tag, m.id); tagOf.set(m.id, tag); }
    for (const u of m.composition?.uses || []) edge(m.id, u, 'uses', mp);
    const al = json(`src/smart/${d}/aliases.json`);
    if (al?.component && al.component !== tag) smartByTag.set(al.component, m.id);
  }

  // Rule names -> unit ids (the Loader's names), through the dated forwards.
  const forwards = json(FORWARDS)?.forwards || {};
  const aliases = [];
  const ruleToId = new Map();
  const plainClassRoots = new Map(); // sf-x -> component id
  const ruleFiles = files.filter((p) => /^src\/(component|smart)\/[^/]+\/rule\.js$/u.test(p));
  for (const p of ruleFiles) {
    const t = text(p);
    const [, area, d] = p.split('/');
    const id = area === 'component' ? (nodes.get(`component.${d}`)?.declared ? `component.${d}` : null) : smartByDir.get(d);
    if (!id) continue;
    for (const m of t.matchAll(/RuleLoader(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z0-9_-]+))\s*=/gu)) ruleToId.set(m[1] || m[2], id);
    if (area === 'component') {
      const re = t.match(/regex:\s*([\s\S]*?)(?:,\s*\n\s*(?:type|css|js|relation|tags)\b|,\s*type\b)/u);
      for (const m of (re ? re[1] : '').matchAll(/sf-[a-z0-9-]*[a-z0-9]/gu)) if (!plainClassRoots.has(m[0])) plainClassRoots.set(m[0], id);
    }
  }
  for (const [from, f] of Object.entries(forwards).sort(([a], [b]) => byText(a, b))) {
    const to = ruleToId.get(f.to);
    if (to) { ruleToId.set(from, to); aliases.push({from, to, rule: f.to, since: f.since, remove_after: f.remove_after}); }
  }
  const resolveRule = (name) => {
    if (ruleToId.has(name)) return ruleToId.get(name);
    if (name.includes('/')) {
      const id = `utility.${name.split('/')[0]}`;
      const up = utilityPassports.get(id);
      if (up && !nodes.get(id)?.declared) {
        node(id, {type: 'utility', version: up.pp.version, declared: true, source: up.p, dir: path.posix.dirname(up.p)});
        for (const d of up.pp.dependencies || []) edge(id, d.id, 'depends', up.p, {range: d.range});
      }
      return id;
    }
    if (name.startsWith('cl-')) return `smart.${name.slice(3)}`; // an unresolved Smart rule, kept as named
    return `component.${name}`;
  };

  // Relations: a Smart component's component.json (its rule is generated from it) and a plain rule.js.
  for (const d of smartDirs) {
    const id = smartByDir.get(d);
    if (!id) continue;
    const cp = `src/smart/${d}/component.json`;
    for (const r of json(cp)?.relations || []) edge(id, resolveRule(r.name), 'relation', cp, {rule: r.name, ...(r.lazy ? {lazy: true} : {})});
  }
  for (const p of ruleFiles.filter((x) => x.startsWith('src/component/'))) {
    const id = `component.${p.split('/')[2]}`;
    if (!nodes.get(id)?.declared) continue;
    const rel = text(p).match(/relation:\s*\[([\s\S]*?)\]/u);
    if (!rel) continue;
    for (const m of rel[1].matchAll(/\{\s*name:\s*['"]([^'"]+)['"]([^}]*)\}/gu)) edge(id, resolveRule(m[1]), 'relation', p, {rule: m[1], ...(/lazy:\s*true/u.test(m[2]) ? {lazy: true} : {})});
  }

  // Plain class roots from the sheets: a class counts when it extends a Loader
  // root or names its own folder; the folder that writes it most owns it.
  const cssRootOwner = new Map();
  for (const p of files.filter((x) => /^src\/component\/[^/]+\/.*\.scss$/u.test(x))) {
    const id = `component.${p.split('/')[2]}`;
    if (!nodes.get(id)?.declared) continue;
    for (const m of text(p).matchAll(/\.(sf-[a-z0-9-]*[a-z0-9])(?![a-z0-9-])/gu)) {
      const base = m[1].replace(/--.*$/u, '').replace(/__.*$/u, '');
      if (!cssRootOwner.has(base)) cssRootOwner.set(base, new Map());
      const own = cssRootOwner.get(base);
      own.set(id, (own.get(id) || 0) + 1);
    }
  }
  const regexRoots = [...plainClassRoots.keys()];
  for (const [base, own] of [...cssRootOwner].sort(([a], [b]) => byText(a, b))) {
    if (plainClassRoots.has(base)) continue;
    const ownerDirs = [...own.keys()].map((k) => k.slice('component.'.length));
    if (!regexRoots.some((r) => base.startsWith(`${r}-`)) && !ownerDirs.some((d) => base === `sf-${d}` || base === `sf-${d.replace(/s$/u, '')}` || base.startsWith(`sf-${d.replace(/s$/u, '')}-`))) continue;
    plainClassRoots.set(base, [...own.entries()].sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))[0][0]);
  }
  const rootsSorted = [...plainClassRoots.keys()].sort((a, b) => b.length - a.length || byText(a, b));
  const classRoot = (token) => {
    const base = token.replace(/--.*$/u, '').replace(/__.*$/u, '');
    if (plainClassRoots.has(base)) return base;
    for (const r of rootsSorted) if (base.startsWith(`${r}-`)) return r;
    return null;
  };
  const classOwner = (token) => { const r = classRoot(token); return r ? plainClassRoots.get(r) : null; };

  // What the Smart code really draws.
  const EVENT_SUFFIX = /-(change|select|open|close|closed|opened|render|input|toggle|click|ready|reset|submit|commit|update|changed|selected|request|cancel|confirm|action|remove|add|done)$/u;
  const stripComments = (t) => t.replace(/\/\*[\s*]?[\s\S]*?\*\//gu, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
  const TAG_CTX = /(?:createElement|whenDefined|customElements\.get|querySelector(?:All)?|closest|matches|tagSelector|localName|tagName|nodeName)\s*(?:\(|[!=]==?)\s*['"`]$/iu;
  const scanSource = (source, ownTag) => {
    const tags = new Set();
    const classes = new Map();
    const t = stripComments(source);
    for (const m of t.matchAll(/<\/?(sf-[a-z0-9-]*[a-z0-9])\b/gu)) tags.add(m[1]);
    const tagLits = new Set();
    for (const m of t.matchAll(/(['"`])(sf-[a-z0-9-]*[a-z0-9])\1/gu)) {
      if (smartByTag.has(m[2]) && TAG_CTX.test(t.slice(Math.max(0, m.index - 40), m.index + 1))) { tags.add(m[2]); tagLits.add(m.index + 1); }
    }
    for (const m of t.matchAll(/(^|[^a-z0-9<\/@-])(sf-[a-z0-9-]*[a-z0-9])(?![a-z0-9:-])/gu)) {
      if (tagLits.has(m.index + m[1].length)) continue;
      // A tag followed by an attribute is markup written as words (a note's `to`), not a class.
      if (/^\s+[a-z][a-z-]*=/u.test(t.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
      if (smartByTag.has(m[2]) && !plainClassRoots.has(m[2]) && m[1] !== '.') { tags.add(m[2]); continue; }
      if (EVENT_SUFFIX.test(m[2])) continue;
      if (/(?:CustomEvent|EventListener|dispatch\w*|emit\w*|fire\w*|on)\(\s*['"`]$/u.test(t.slice(Math.max(0, m.index - 30), m.index + 1))) continue;
      // The element's own part names (sf-tag-*), unless a plain sheet owns that exact class.
      if (ownTag && (m[2] === ownTag || m[2].startsWith(`${ownTag}-`)) && (classRoot(m[2]) || '').length < ownTag.length) continue;
      const own = classOwner(m[2]);
      if (own) classes.set(own, (classes.get(own) || []).concat(m[2]));
    }
    tags.delete(ownTag);
    return {tags, classes};
  };
  const withExt = (p) => [p, `${p}.js`, `${p}.mjs`, `${p}/index.js`].find((c) => fileSet.has(c)) ?? null;
  const loaded = new Map();
  for (const d of smartDirs) {
    const id = smartByDir.get(d);
    if (!id) continue;
    const tag = tagOf.get(id);
    const own = files.filter((p) => p.startsWith(`src/smart/${d}/`) && /\.(js|mjs)$/u.test(p) && !/\/(rule|meta)\.(js|mjs)$/u.test(p) && !/\.test\./u.test(p));
    const seen = new Set();
    const queue = own.map((f) => ({f, via: null}));
    const found = {components: new Map(), smart: new Map()};
    const note = (map, key, why) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(why); };
    while (queue.length) {
      const {f, via} = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      const source = text(f);
      if (source == null) continue;
      const where = via ? `via ${via}` : f.replace(`src/smart/${d}/`, '');
      for (const m of source.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/gu)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
        const seg = target.split('/');
        if (seg[1] === 'component' && seg[2]) {
          const cid = `component.${seg[2].replace(/\.js$/u, '')}`;
          if (nodes.get(cid)?.declared) note(found.components, cid, `import ${where}`);
        }
        if (seg[1] === 'smart' && seg[2] && seg[2] !== d) {
          if (SHARED_SMART.has(seg[2])) { const w = withExt(target); if (w) queue.push({f: w, via: via || seg.slice(2).join('/')}); }
          else if (smartByDir.has(seg[2])) note(found.smart, smartByDir.get(seg[2]), `import ${where}`);
        }
      }
      const s = scanSource(source, tag);
      for (const t of s.tags) if (smartByTag.has(t)) { const sid = smartByTag.get(t); if (sid !== id) note(found.smart, sid, `<${t}> ${where}`); }
      for (const [cid, toks] of s.classes) note(found.components, cid, `.${toks[0]} ${where}`);
    }
    // The element's own sheets restyling plain classes.
    const restyles = new Map();
    for (const p of files.filter((x) => x.startsWith(`src/smart/${d}/`) && /\.(scss|css)$/u.test(x))) {
      for (const m of text(p).matchAll(/\.(sf-[a-z0-9-]*[a-z0-9])/gu)) { const o = classOwner(m[1]); if (o) restyles.set(o, (restyles.get(o) || 0) + 1); }
    }
    loaded.set(id, {found, restyles});
  }
  for (const [id, l] of loaded) {
    for (const x of [...new Set([...l.found.components.keys(), ...l.found.smart.keys()])].sort(byText)) {
      const evidence = [...(l.found.components.get(x) || l.found.smart.get(x))];
      edge(id, x, 'loads', `${nodes.get(id).dir}/**`, {evidence: evidence.slice(0, 3), ...(evidence.every((w) => / via /u.test(w)) ? {via_shared: true} : {})});
    }
  }

  // C250: declared against loaded.
  const outgoing = (id, kinds) => edges.filter((e) => e.from === id && kinds.includes(e.kind)).map((e) => e.to);
  const declaredVsLoaded = [];
  for (const [id, l] of loaded) {
    const uses = new Set(outgoing(id, ['uses']));
    const detected = new Set([...l.found.components.keys(), ...l.found.smart.keys()]);
    const evidenceOf = (x) => [...(l.found.components.get(x) || l.found.smart.get(x))];
    const direct = (x) => evidenceOf(x).some((w) => !/ via /u.test(w));
    const missingAll = [...detected].filter((x) => !uses.has(x)).sort(byText);
    const missing = missingAll.filter(direct);
    const unusedAll = [...uses].filter((x) => !detected.has(x)).sort(byText);
    // Reachable through a declared Smart part (the part declares or draws it itself).
    const reach = new Set();
    const q = [...uses].filter((x) => x.startsWith('smart.'));
    while (q.length) {
      const y = q.shift();
      if (reach.has(y)) continue;
      reach.add(y);
      for (const e of edges) if (e.from === y && (e.kind === 'uses' || e.kind === 'loads')) { reach.add(e.to); if (e.to.startsWith('smart.')) q.push(e.to); }
    }
    declaredVsLoaded.push({
      id, missing,
      missing_evidence: Object.fromEntries(missing.map((x) => [x, evidenceOf(x).slice(0, 2)])),
      missing_via_shared: missingAll.filter((x) => !direct(x)),
      unused: unusedAll.filter((x) => !reach.has(x)),
      unused_covered_by_parts: unusedAll.filter((x) => reach.has(x)),
      restyles: Object.fromEntries([...l.restyles].sort(([a], [b]) => byText(a, b))),
    });
  }
  declaredVsLoaded.sort((a, b) => byText(a.id, b.id));

  // C251: twins. The pairs are declared (contracts/graph/twins.json); the
  // heuristic finds candidates, so a new pair cannot pass unnamed.
  const MANUAL_TWINS = {
    close: 'button-close', 'context-menu': 'menu-context', datepicker: 'input-date', 'download-file': 'file-download',
    clipboard: 'button-copy', 'range-slider': 'slider-range', step: 'steps', 'country-code': 'input-country', textarea: 'input-textarea', pagination: 'pager',
  };
  const twinCandidate = (plain) => {
    for (const c of [MANUAL_TWINS[plain], plain, forwards[`cl-${plain}`]?.to?.slice(3), plain.replace(/s$/u, ''), `input-${plain}`, `input-${plain.replace(/s$/u, '')}`]) {
      if (c && smartByDir.has(c)) return smartByDir.get(c);
    }
    return null;
  };
  const twinCandidates = [...nodes.values()].filter((n) => n.type === 'component' && n.declared)
    .map((n) => ({plain: n.id, smart: twinCandidate(n.id.slice('component.'.length))})).filter((x) => x.smart).sort((a, b) => byText(a.plain, b.plain));
  const twinPairs = (twins ?? twinCandidates).filter((t) => nodes.get(t.plain)?.declared && nodes.get(t.smart)?.declared);
  const scssOf = (cid) => files.filter((x) => x.startsWith(`${nodes.get(cid).dir}/`) && x.endsWith('.scss'));
  const modifiers = (cid, kind) => {
    const vals = new Set();
    for (const p of scssOf(cid)) {
      for (const m of text(p).matchAll(/\.sf-[a-z0-9-]+?--([a-z0-9-]+(?:\\\/[0-9]+)?)/gu)) {
        const v = m[1].replace(/\\\//gu, '/');
        if (kind === 'size') { const s = v.match(/^size-([0-9/]+)$/u); if (s) vals.add(s[1]); } else vals.add(v);
      }
      // Sizes written through the field ladder (ladder.size-class in @each over ladder.$outer or $sizes).
      if (kind === 'size' && /ladder\.size-class\(/u.test(text(p))) {
        const lists = {outer: ['1/3', '3'], sizes: ['1/3', '1/2', '1', '2', '3']};
        for (const m of text(p).matchAll(/@each \$size in ladder\.\$(outer|sizes)\b/gu)) for (const v of lists[m[1]]) vals.add(v);
      }
    }
    return vals;
  };
  const twinChecks = [];
  for (const {plain, smart} of twinPairs) {
    const name = plain.slice('component.'.length);
    const c = json(`${nodes.get(smart).dir}/component.json`) || {};
    const set = c.settings || {};
    const flags = [];
    if (!edges.some((e) => e.from === smart && e.kind === 'uses' && e.to === plain)) flags.push({code: 'twin-not-declared', text: `${smart} does not declare ${plain} in composition.uses`});
    if (!loaded.get(smart)?.found.components.has(plain)) flags.push({code: 'twin-not-drawing', text: `${smart} draws no ${name} class: its markup and look are its own`});
    const sizeSmart = (set.size?.values || []).filter(Boolean);
    const sizePlain = [...modifiers(plain, 'size')].sort(byText);
    if (sizeSmart.length && sizePlain.length) {
      const onlyS = sizeSmart.filter((v) => !sizePlain.includes(v));
      const onlyP = sizePlain.filter((v) => !sizeSmart.includes(v));
      if (onlyS.length || onlyP.length) flags.push({code: 'size-ladder', text: `sizes only in Smart: ${onlyS.join(', ') || '-'}; only in plain: ${onlyP.join(', ') || '-'}`});
    }
    const app = set.appearance;
    const plainMods = modifiers(plain, 'all');
    if (app?.values) {
      const missingPlain = app.values.filter((v) => v !== app.default && v !== 'default' && !plainMods.has(v));
      if (missingPlain.length) flags.push({code: 'appearance-values', text: `Smart appearance values with no plain modifier: ${missingPlain.join(', ')}`});
    }
    const bordered = scssOf(plain).some((p) => /border-color:\s*var\(--sf-[a-z-]+-border-color,\s*var\(--sf-outline\)\)/u.test(text(p)));
    const fieldLike = c.family === 'input' || (app?.values || []).includes('filled');
    if (bordered && fieldLike && (!app || (app.default && app.default !== 'bordered' && app.default !== 'outline'))) {
      flags.push({code: 'default-look', text: `plain default draws an outline border; Smart ${app ? `default appearance is ${app.default}` : 'has no appearance setting'}`});
    }
    const restyle = loaded.get(smart)?.restyles.get(plain) || 0;
    if (restyle) flags.push({code: 'smart-own-sheet', text: `${smart} has its own sheet restyling ${name} classes (${restyle} selectors)`});
    twinChecks.push({plain, smart, flags});
    edges.push({from: plain, to: smart, kind: 'twin', source: TWINS_FILE});
  }

  // Reverse links (twin edges are a pairing, not a use).
  for (const n of nodes.values()) { n.uses = []; n.used_by = []; }
  for (const e of edges) {
    if (e.kind === 'twin') continue;
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a.uses.includes(e.to)) a.uses.push(e.to);
    if (!b.used_by.includes(e.from)) b.used_by.push(e.from);
  }
  for (const n of nodes.values()) { n.uses.sort(byText); n.used_by.sort(byText); }
  for (const {plain, smart} of twinChecks) { nodes.get(plain).twin = smart; nodes.get(smart).twin = plain; }

  const kindOrder = ['depends', 'uses', 'relation', 'loads', 'twin'];
  edges.sort((a, b) => byText(a.from, b.from) || kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || byText(a.to, b.to) || byText(a.source, b.source));
  const count = (list, key) => Object.fromEntries([...list.reduce((m, x) => m.set(x[key], (m.get(x[key]) || 0) + 1), new Map())].sort(([a], [b]) => byText(a, b)));
  const nodeList = [...nodes.values()].sort((a, b) => byText(a.id, b.id));
  return {
    schema: GRAPH_SCHEMA,
    schema_version: GRAPH_SCHEMA_VERSION,
    $comment: 'Built by ui-source scripts/dependency-graph.mjs from the committed source (owner decisions C249-C251). Mirai Graph: a node is an object (id, type, version), an edge a relation (from, to, kind) citing its source file at `revision`.',
    source: OWNER,
    revision,
    release,
    stats: {
      nodes: nodeList.length,
      edges: edges.length,
      by_type: count(nodeList, 'type'),
      by_kind: count(edges, 'kind'),
      smart_checked: declaredVsLoaded.length,
      missing: declaredVsLoaded.reduce((s, a) => s + a.missing.length, 0),
      missing_via_shared: declaredVsLoaded.reduce((s, a) => s + a.missing_via_shared.length, 0),
      unused: declaredVsLoaded.reduce((s, a) => s + a.unused.length, 0),
      twins: twinChecks.length,
      twins_diverging: twinChecks.filter((t) => t.flags.length).length,
    },
    nodes: nodeList,
    edges,
    aliases,
    class_roots: Object.fromEntries([...plainClassRoots].sort(([a], [b]) => byText(a, b))),
    checks: {declared_vs_loaded: declaredVsLoaded, twins: twinChecks, twin_candidates: twinCandidates},
  };
}

// ---------------------------------------------------------------------------
// Contract files.

const readJson = (root, file, fallback) => (existsSync(path.join(root, file)) ? JSON.parse(readFileSync(path.join(root, file), 'utf8')) : fallback);
export function readContracts(root = repositoryRoot) {
  return {
    debt: readJson(root, DEBT_FILE, {missing: [], unused: []}),
    twins: readJson(root, TWINS_FILE, {pairs: []}),
    twinDebt: readJson(root, TWIN_DEBT_FILE, {divergences: []}),
    twinIntent: readJson(root, TWIN_INTENT_FILE, {marks: []}),
  };
}

// ---------------------------------------------------------------------------
// The gates.

/**
 * C250 and C251 over a graph. `changes` is linkage's change report against the
 * previous pair (compareInventories), or null when there is no previous pair.
 * Returns {problems: [{code, id, message}], notes: [string]}.
 */
export function checkGraph(graph, contracts, {changes = null} = {}) {
  const problems = [];
  const notes = [];
  const key = (a, b) => `${a} -> ${b}`;

  // C250.
  const now = {missing: new Map(), unused: new Map()};
  for (const row of graph.checks.declared_vs_loaded) {
    for (const x of row.missing) now.missing.set(key(row.id, x), row.missing_evidence[x]?.join('; ') ?? '');
    for (const x of row.unused) now.unused.set(key(row.id, x), '');
  }
  for (const list of ['missing', 'unused']) {
    const debt = new Map((contracts.debt[list] ?? []).map((d) => [key(d.smart, d.unit), d]));
    for (const [k, evidence] of now[list]) {
      if (debt.has(k)) continue;
      const [smart, unit] = k.split(' -> ');
      problems.push(list === 'missing'
        ? {code: 'graph-new-missing', id: smart, message: `${smart} draws ${unit} (${evidence}) but its smart.manifest.json composition.uses does not declare it: declare it`}
        : {code: 'graph-new-unused', id: smart, message: `${smart} declares ${unit} in composition.uses but its code never draws it: remove it, or draw it`});
    }
    for (const [k, d] of debt) {
      if (now[list].has(k)) continue;
      problems.push({code: 'graph-debt-fixed', id: d.smart, message: `${k} (${list}, debt since ${d.since}) is fixed: remove it from ${DEBT_FILE}`});
    }
  }

  // C251: the declared pairs against the candidates the source suggests.
  const declared = new Map((contracts.twins.pairs ?? []).map((p) => [p.plain, p.smart]));
  for (const c of graph.checks.twin_candidates) {
    if (declared.get(c.plain) === c.smart) continue;
    if (declared.has(c.plain)) continue; // a person named another twin
    problems.push({code: 'twin-undeclared', id: c.plain, message: `${c.plain} looks like the plain twin of ${c.smart}: add the pair to ${TWINS_FILE} (or {"plain", "smart": null, "reason"} when it is none)`});
  }
  const nodeIds = new Set(graph.nodes.filter((n) => n.declared).map((n) => n.id));
  for (const p of contracts.twins.pairs ?? []) {
    if (p.smart && (!nodeIds.has(p.plain) || !nodeIds.has(p.smart))) problems.push({code: 'twin-stale', id: p.plain, message: `${TWINS_FILE} pairs ${p.plain} with ${p.smart}, and one of them is gone`});
  }
  const flagsNow = new Map();
  for (const t of graph.checks.twins) for (const f of t.flags) flagsNow.set(`${t.plain} | ${t.smart} | ${f.code}`, f.text);
  const twinDebt = new Map((contracts.twinDebt.divergences ?? []).flatMap((d) => d.codes.map((code) => [`${d.plain} | ${d.smart} | ${code}`, d])));
  for (const [k, textOf] of flagsNow) {
    if (twinDebt.has(k)) continue;
    const [plain, smart, code] = k.split(' | ');
    problems.push({code: 'twin-new-divergence', id: plain, message: `${plain} and ${smart} diverge (${code}: ${textOf}): align them (Smart is the default model, C224) or record the decision in ${TWIN_DEBT_FILE}`});
  }
  for (const [k, d] of twinDebt) {
    if (flagsNow.has(k)) continue;
    problems.push({code: 'twin-divergence-fixed', id: d.plain, message: `${k} (debt since ${d.since}) no longer diverges: remove the code from ${TWIN_DEBT_FILE}`});
  }

  // C251: a change to one twin needs a change to the other or an intended mark.
  if (changes) {
    const changed = new Map([...changes.changed, ...changes.added.map((a) => ({id: a.id, to_version: a.version}))].map((c) => [c.id, c]));
    const versionOf = new Map(graph.nodes.map((n) => [n.id, n.version]));
    const marks = contracts.twinIntent.marks ?? [];
    for (const t of graph.checks.twins) {
      const a = changed.has(t.plain);
      const b = changed.has(t.smart);
      if (a === b) continue;
      const [moved, other] = a ? [t.plain, t.smart] : [t.smart, t.plain];
      const version = versionOf.get(moved);
      if (marks.some((m) => m.unit === moved && m.twin === other && m.version === version)) {
        notes.push(`twin ${moved} ${version} changed alone, marked intended for ${other}`);
        continue;
      }
      const from = changed.get(moved).from_version;
      problems.push({code: 'twin-one-sided-change', id: moved, message: `${moved} changed${from ? ` ${from} -> ${version}` : ''} since ${changes.from.release ?? changes.from.revision?.slice(0, 12)} and its twin ${other} did not: change ${other} in this pair, or mark the change intended in ${TWIN_INTENT_FILE} ({"unit": "${moved}", "version": "${version}", "twin": "${other}", "reason", "decision"})`});
    }
  } else {
    notes.push('no previous pair inventory: the one-sided twin change check did not run');
  }
  problems.sort((x, y) => byText(x.code, y.code) || byText(x.message, y.message));
  return {problems, notes};
}

// ---------------------------------------------------------------------------
// The impact list.

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir).sort(byText)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walkFiles(p, acc); else acc.push(p);
  }
  return acc;
}

/** The documentation index of a ui-doc working tree, or null. */
export function readDocs(uiDocRoot) {
  if (!uiDocRoot || !existsSync(path.join(uiDocRoot, 'content'))) return null;
  const pages = walkFiles(path.join(uiDocRoot, 'content/ru')).filter((p) => p.endsWith('.md')).map((p) => {
    const t = readFileSync(p, 'utf8');
    return {page: `/${path.relative(path.join(uiDocRoot, 'content'), p).split(path.sep).join('/').replace(/(\/index)?\.md$/u, '/')}`, t, ex: [...t.matchAll(/:::example\s*\{id="([^"]+)"/gu)].map((m) => m[1])};
  });
  const examples = walkFiles(path.join(uiDocRoot, 'examples')).filter((p) => /\.(html|md|json|js)$/u.test(p) && statSync(p).size < 2e6)
    .map((p) => ({id: path.relative(path.join(uiDocRoot, 'examples'), p).split(path.sep).join('/'), t: readFileSync(p, 'utf8')}));
  return {pages, examples};
}

function docsFor(docs, tokens) {
  if (!docs || !tokens.length) return [];
  const res = tokens.map((tok) => new RegExp(`(?<![A-Za-z0-9_-])${tok}(?:--[a-z0-9-]+)?(?![A-Za-z0-9_-])`, 'u'));
  const hit = docs.examples.filter((e) => res.some((r) => r.test(e.t))).map((e) => e.id);
  return docs.pages.filter((p) => res.some((r) => r.test(p.t)) || p.ex.some((id) => hit.some((h) => h.startsWith(`${id}/`) || h.startsWith(`${id}.`))))
    .map((p) => p.page).sort(byText);
}

/** Who is hit when `id` changes: Smart and plain components, by depth. */
export function reverseClosure(graph, id) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map();
  const q = [[id, 0]];
  while (q.length) {
    const [at, depth] = q.shift();
    for (const from of byId.get(at)?.used_by ?? []) {
      if (out.has(from) || from === id) continue;
      // Only a shared helper's branch for another host draws it: not a use.
      if (!graph.edges.some((e) => e.from === from && e.to === at && e.kind !== 'twin' && !e.via_shared)) continue;
      out.set(from, {depth: depth + 1, via: at});
      q.push([from, depth + 1]);
    }
  }
  return out;
}

/** Browser probes (tests/browser/*.browser.mjs) named after a unit. */
export function probesFor(ids, root = repositoryRoot) {
  const dir = path.join(root, 'tests', 'browser');
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((f) => f.endsWith('.browser.mjs')).map((f) => f.slice(0, -'.browser.mjs'.length));
  const stems = new Set(ids.map((id) => id.split('.').slice(1).join('.')));
  return names.filter((n) => [...stems].some((s) => n === s || n.startsWith(`${s}-`))).sort(byText);
}

export function impactOf(graph, ids, {docs = null, root = repositoryRoot} = {}) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const roots = Object.entries(graph.class_roots);
  return ids.filter((id) => byId.has(id)).sort(byText).map((id) => {
    const hit = reverseClosure(graph, id);
    const smart = [...hit].filter(([k]) => k.startsWith('smart.')).map(([k, v]) => ({id: k, ...v})).sort((a, b) => a.depth - b.depth || byText(a.id, b.id));
    const plain = [...hit].filter(([k]) => k.startsWith('component.')).map(([k, v]) => ({id: k, ...v})).sort((a, b) => a.depth - b.depth || byText(a.id, b.id));
    const twin = byId.get(id).twin ?? null;
    const name = id.split('.').slice(1).join('.');
    const ownRoots = roots.filter(([r, owner]) => owner === id && (r === `sf-${name}` || r === `sf-${name.replace(/s$/u, '')}`)).map(([r]) => r);
    const tokens = id.startsWith('smart.') ? [byId.get(id).tag].filter(Boolean) : ownRoots;
    const pagesDirect = docsFor(docs, tokens);
    const tags = [...smart.map((s) => byId.get(s.id).tag), twin && byId.get(twin).tag].filter(Boolean);
    const pagesViaSmart = docsFor(docs, tags).filter((p) => !pagesDirect.includes(p));
    return {
      id, version: byId.get(id).version, twin,
      smart: smart.map((s) => s.id), plain: plain.map((p) => p.id),
      probes: probesFor([id, ...(twin ? [twin] : []), ...smart.map((s) => s.id)], root),
      ...(docs ? {pages_direct: pagesDirect, pages_via_smart: pagesViaSmart} : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// The previous pair.

/**
 * The inventory of the newest released pair whose source revision is an
 * ancestor of `revision`, from a directory of ui-<12>.inventory.json files
 * (ui/contracts/releases), or null.
 */
export function findPreviousInventory(releasesDir, revision, root = repositoryRoot) {
  if (!releasesDir || !existsSync(releasesDir)) return null;
  const inventories = new Map();
  for (const f of readdirSync(releasesDir).filter((x) => x.endsWith('.inventory.json'))) {
    try {
      const inv = JSON.parse(readFileSync(path.join(releasesDir, f), 'utf8'));
      if (inv.revision && !inventories.has(inv.revision)) inventories.set(inv.revision, inv);
    } catch { /* not an inventory */ }
  }
  if (!inventories.size) return null;
  const ancestry = execFileSync('git', ['-C', root, 'rev-list', '--first-parent', revision], {encoding: 'utf8', maxBuffer: 1 << 28}).split('\n');
  for (const rev of ancestry) if (inventories.has(rev)) return inventories.get(rev);
  // A pair cut from a side branch: any ancestor, newest first.
  for (const rev of execFileSync('git', ['-C', root, 'rev-list', revision], {encoding: 'utf8', maxBuffer: 1 << 28}).split('\n')) if (inventories.has(rev)) return inventories.get(rev);
  return null;
}

const defaultReleasesDir = (root) => {
  if (process.env.UI_RELEASES_ROOT) return process.env.UI_RELEASES_ROOT;
  const ui = process.env.UI_ROOT || path.join(root, '..', 'ui');
  return path.join(ui, 'contracts', 'releases');
};

/**
 * The graph and its gates over a tree linkage.mjs has read and collected:
 * what `linkage.mjs passports --check` and `inventory` run at every pair.
 */
export function graphGate({tree, revision, collected, release = null, previous = null, releasesDir = null, root = repositoryRoot, docsRoot = null}) {
  const contracts = readContracts(root);
  const twins = (contracts.twins.pairs ?? []).filter((p) => p.smart);
  const graph = buildGraph(tree, {revision, release, units: collected.units, twins: twins.length ? twins : null});
  const before = rehashInventory(previous ?? (releasesDir === false ? null : findPreviousInventory(releasesDir ?? defaultReleasesDir(root), revision, root)), root);
  const changes = before ? compareInventories(before, inventoryOf(collected, {revision})) : null;
  const {problems, notes} = checkGraph(graph, contracts, {changes});
  const changedIds = changes ? [...changes.changed.map((c) => c.id), ...changes.added.map((a) => a.id)] : [];
  const impact = impactOf(graph, changedIds, {docs: readDocs(docsRoot ?? defaultDocsRoot()), root});
  return {graph, contracts, changes, problems, notes, impact};
}

const defaultDocsRoot = () => process.env.UI_DOC_ROOT || (existsSync(path.join(repositoryRoot, '..', 'ui-doc')) ? path.join(repositoryRoot, '..', 'ui-doc') : null);

/** Everything the gates need at a revision of this repository. */
export function graphAt({root = repositoryRoot, rev = 'HEAD', release = null, previous = null, releasesDir = null} = {}) {
  const {revision, tree} = readCommittedTree(root, rev);
  return {revision, ...graphGate({tree, revision, collected: collectUnits(tree), release, previous, releasesDir, root})};
}

// ---------------------------------------------------------------------------
// Debt recording (a person's decision: run, read the diff, commit).

export function debtOf(graph, {since, revision}) {
  const missing = [];
  const unused = [];
  for (const row of graph.checks.declared_vs_loaded) {
    for (const x of row.missing) missing.push({smart: row.id, unit: x, since, evidence: row.missing_evidence[x]?.[0] ?? null});
    for (const x of row.unused) unused.push({smart: row.id, unit: x, since});
  }
  return {
    schema: 'simai.framework.dependency-debt', schema_version: 1,
    $comment: 'Owner decision C250 (2026-11-16): the mismatches between what a Smart component declares (smart.manifest.json composition.uses) and what its code draws, recorded as dated debt at the revision named. scripts/dependency-graph.mjs check fails on a mismatch not listed here and on an entry that is no longer true (remove it in the change that fixes it). Never add an entry to pass a gate: declare the unit, or stop drawing it.',
    recorded_at: revision, missing, unused,
  };
}

export function twinDebtOf(graph, {since, revision}) {
  return {
    schema: 'simai.framework.twin-debt', schema_version: 1,
    $comment: 'Owner decision C251 (2026-11-16): the plain/Smart twin pairs that diverge, by divergence code, recorded as dated debt at the revision named. Smart is the default model (C224): align the plain twin to it, then remove the code here. scripts/dependency-graph.mjs check fails on a divergence not listed and on a listed one that is gone.',
    recorded_at: revision,
    divergences: graph.checks.twins.filter((t) => t.flags.length).map((t) => ({plain: t.plain, smart: t.smart, since, codes: t.flags.map((f) => f.code), notes: t.flags.map((f) => f.text)})),
  };
}

// ---------------------------------------------------------------------------
// The command line.

export function formatImpact(rows) {
  const lines = [];
  for (const r of rows) {
    lines.push(`  impact ${r.id} ${r.version ?? ''}${r.twin ? ` (twin ${r.twin})` : ''}: ${r.smart.length} Smart, ${r.plain.length} plain${r.pages_direct ? `, ${r.pages_direct.length + r.pages_via_smart.length} doc pages` : ''}`);
    if (r.smart.length) lines.push(`    smart: ${r.smart.join(' ')}`);
    if (r.plain.length) lines.push(`    plain: ${r.plain.join(' ')}`);
    if (r.pages_direct?.length || r.pages_via_smart?.length) lines.push(`    pages: ${[...r.pages_direct, ...r.pages_via_smart].join(' ')}`);
    if (r.probes.length) lines.push(`    probes: ${r.probes.join(',')}`);
  }
  const probes = [...new Set(rows.flatMap((r) => r.probes))].sort(byText);
  if (probes.length) lines.push(`  rerun: node scripts/run-browser-probes.mjs <build output> --only ${probes.join(',')}`);
  return lines;
}

function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => rest.includes(name);
  const option = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : null);
  const usage = 'Usage: node scripts/dependency-graph.mjs build --out <file> [--rev <rev>] [--release <id>]\n'
    + '       node scripts/dependency-graph.mjs check [--rev <rev>] [--previous <inventory.json> | --releases <dir>] [--json]\n'
    + '       node scripts/dependency-graph.mjs impact [--rev <rev>] [--previous <inventory.json> | --releases <dir>] [<unit id> ...] [--json]\n'
    + '       node scripts/dependency-graph.mjs debt --write [--rev <rev>] [--since <yyyy-mm-dd>]';
  const previous = option('--previous') ? JSON.parse(readFileSync(option('--previous'), 'utf8')) : null;
  const load = () => graphAt({rev: option('--rev') || 'HEAD', release: option('--release'), previous, releasesDir: option('--releases')});

  if (command === 'build' && option('--out')) {
    const {graph} = load();
    writeFileSync(option('--out'), `${JSON.stringify(graph, null, 1)}\n`);
    console.log(`graph: ${graph.stats.nodes} nodes, ${graph.stats.edges} edges at ${graph.revision.slice(0, 12)} -> ${option('--out')}`);
    return 0;
  }
  if (command === 'check' || command === 'impact') {
    const ids = rest.filter((arg, i) => !arg.startsWith('--') && !['--rev', '--previous', '--releases', '--release'].includes(rest[i - 1]));
    const result = load();
    const {graph, changes, problems, notes} = result;
    const docs = readDocs(defaultDocsRoot());
    const impact = ids.length ? impactOf(graph, ids, {docs}) : result.impact;
    if (command === 'impact') {
      if (flag('--json')) console.log(JSON.stringify({revision: graph.revision, since: changes?.from ?? null, impact}, null, 2));
      else {
        console.log(`graph impact at ${graph.revision.slice(0, 12)}${changes && !ids.length ? ` since ${changes.from.release ?? changes.from.revision.slice(0, 12)}` : ''}: ${impact.length} unit(s)${docs ? '' : ' (no UI_DOC_ROOT: no doc pages)'}`);
        for (const line of formatImpact(impact)) console.log(line);
      }
      return 0;
    }
    if (flag('--json')) console.log(JSON.stringify({revision: graph.revision, stats: graph.stats, problems, notes, impact}, null, 2));
    else console.log(formatCheck(graph, {problems, notes, changes, impact}).join('\n'));
    return problems.length ? 1 : 0;
  }
  if (command === 'debt' && flag('--write')) {
    const {graph} = load();
    const since = option('--since') || new Date().toISOString().slice(0, 10);
    const write = (file, data) => writeFileSync(path.join(repositoryRoot, file), `${JSON.stringify(data, null, 2)}\n`);
    write(DEBT_FILE, debtOf(graph, {since, revision: graph.revision}));
    write(TWIN_DEBT_FILE, twinDebtOf(graph, {since, revision: graph.revision}));
    console.log(`graph debt at ${graph.revision.slice(0, 12)}: ${graph.stats.missing} missing, ${graph.stats.unused} unused, ${graph.stats.twins_diverging} diverging twins -> ${DEBT_FILE}, ${TWIN_DEBT_FILE}`);
    return 0;
  }
  console.error(usage);
  return 2;
}

export function formatCheck(graph, {problems, notes, changes, impact}) {
  const s = graph.stats;
  const lines = [`graph: ${s.nodes} nodes, ${s.edges} edges at ${graph.revision.slice(0, 12)}; ${s.missing} missing + ${s.unused} unused (C250), ${s.twins} twins, ${s.twins_diverging} diverging (C251)${changes ? `; since ${changes.from.release ?? changes.from.revision.slice(0, 12)}: ${changes.changed.length + changes.added.length} unit(s) changed` : ''}`];
  for (const p of problems) lines.push(`  ${p.code}: ${p.message}`);
  for (const n of notes) lines.push(`  note: ${n}`);
  lines.push(...formatImpact(impact ?? []));
  lines.push(problems.length ? `graph: ${problems.length} problem(s)` : 'graph: no new mismatch, no fixed debt left listed');
  return lines;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
