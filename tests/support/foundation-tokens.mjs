// Foundations standard (owner decision C181 (4), 2026-11-14): each theme of
// docs/foundation-*.md carries a "Numbers" table, and its contract test
// resolves every row against the built sheets, so the document and the
// tokens cannot drift apart.
//
// This is a small cascade for custom properties, enough for the tokens: it
// reads plain built CSS (no nesting), honours @layer order, @media width
// conditions, selector specificity and inheritance, and matches simple
// selectors against a chain of elements (html > optional density region >
// optional element with classes). It does not lay anything out.

import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT_PX = 16;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/* ---------- where the built sheets are ---------- */

// The candidate's sheets: UI_CORE_ROOT (the pair build sets it), else the
// distribution beside the source, as the other built-sheet tests read it.
export function builtCore() {
  const explicit = process.env.UI_CORE_ROOT;
  const base = explicit ?? resolve(root, '../ui');
  return {explicit: Boolean(explicit), base, distr: resolve(base, 'distr')};
}

export function readBuilt(files) {
  const {distr} = builtCore();
  const paths = files.map((file) => resolve(distr, file));
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length) return {css: null, missing};
  return {css: paths.map((path) => readFileSync(path, 'utf8')).join('\n'), missing: []};
}

/* ---------- parse ---------- */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//gu, '');
}

// Split at a separator outside parentheses, brackets and quotes.
function splitTop(text, separator) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === '\'') quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '\\') i++;
    else if (depth === 0 && c === separator) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

// Index of the brace that closes the block opened at `open`.
function closeOf(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === '\'') quote = c;
    else if (c === '\\') i++;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return text.length;
}

// Rules: {selectors, media: [conditions], layer: name|null, order, declarations: [[name, value]]}
export function parseSheet(input) {
  const css = stripComments(input);
  const rules = [];
  const layerOrder = [];
  let order = 0;
  const declareLayer = (name) => { if (name && !layerOrder.includes(name)) layerOrder.push(name); };

  function walk(text, media, layer) {
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/u.test(text[i])) i++;
      if (i >= text.length) break;
      // a prelude ends at { or ; (statement)
      let j = i;
      let quote = null;
      let paren = 0;
      while (j < text.length) {
        const c = text[j];
        if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; j++; continue; }
        if (c === '"' || c === '\'') quote = c;
        else if (c === '(') paren++;
        else if (c === ')') paren--;
        else if (c === '\\') j++;
        else if (paren === 0 && (c === '{' || c === ';')) break;
        j++;
      }
      const prelude = text.slice(i, j).trim();
      if (j >= text.length) break;
      if (text[j] === ';') {
        const statement = prelude.match(/^@layer\s+(.+)$/u);
        if (statement) for (const name of statement[1].split(',')) declareLayer(qualify(layer, name.trim()));
        i = j + 1;
        continue;
      }
      const end = closeOf(text, j);
      const body = text.slice(j + 1, end);
      i = end + 1;
      if (prelude.startsWith('@media')) walk(body, [...media, prelude.slice(6).trim()], layer);
      else if (prelude.startsWith('@layer')) {
        const name = qualify(layer, prelude.slice(6).trim() || `anonymous-${order}`);
        declareLayer(name);
        walk(body, media, name);
      } else if (prelude.startsWith('@supports')) walk(body, media, layer);
      else if (prelude.startsWith('@')) continue; // @font-face, @keyframes, @property, @container ...
      else {
        const declarations = [];
        for (const part of splitTop(body, ';')) {
          const colon = part.indexOf(':');
          if (colon < 0) continue;
          const name = part.slice(0, colon).trim().replace(/\\/gu, '');
          if (!name.startsWith('--')) continue;
          declarations.push([name, part.slice(colon + 1).trim()]);
        }
        if (declarations.length) rules.push({selectors: splitTop(prelude, ',').map((s) => s.trim()), media, layer, order: order++, declarations});
      }
    }
  }
  walk(css, [], null);
  return {rules, layerOrder};
}

function qualify(parent, name) {
  return parent ? `${parent}.${name}` : name;
}

/* ---------- media ---------- */

function lengthPx(text) {
  const m = text.trim().match(/^(-?[\d.]+)(px|rem|em)?$/u);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? ROOT_PX : 1);
}

function mediaMatches(condition, width) {
  // "a and b", "a, b" (any), "not ..." (rare: no match)
  return splitTop(condition, ',').some((alternative) => {
    const text = alternative.trim();
    if (/^not\b/u.test(text) || /^only\b/u.test(text)) return false;
    return text.split(/\s+and\s+/u).every((feature) => featureMatches(feature.trim(), width));
  });
}

function featureMatches(feature, width) {
  if (feature === 'screen' || feature === 'all') return true;
  if (feature === 'print') return false;
  const f = feature.replace(/^\(|\)$/gu, '').trim();
  let m = f.match(/^(min|max)-width\s*:\s*(.+)$/u);
  if (m) {
    const px = lengthPx(m[2]);
    return m[1] === 'min' ? width >= px : width <= px;
  }
  m = f.match(/^width\s*(>=|<=|>|<)\s*(.+)$/u);
  if (m) {
    const px = lengthPx(m[2]);
    return {'>=': width >= px, '<=': width <= px, '>': width > px, '<': width < px}[m[1]];
  }
  if (/^prefers-reduced-motion\s*:\s*no-preference$/u.test(f)) return true;
  return false; // colour scheme, hover, pointer, reduce ... : the plain case
}

/* ---------- selectors ---------- */

// An element of the chain: {tag, root, classes:Set, attrs:Map, parent}
export function element({tag = 'div', root: isRoot = false, classes = [], attrs = {}, parent = null} = {}) {
  return {tag, root: isRoot, classes: new Set(classes), attrs: new Map(Object.entries(attrs)), parent};
}

// Parse one compound selector into simple parts; null when it holds
// something this cascade does not model (pseudo-elements, state classes).
function compound(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '.') {
      const m = text.slice(i + 1).match(/^((?:\\.|[\w-])+)/u);
      parts.push({type: 'class', value: m[1].replace(/\\/gu, '')});
      i += 1 + m[1].length;
    } else if (c === '[') {
      const close = text.indexOf(']', i);
      if (close < 0) return null;
      const inner = text.slice(i + 1, close);
      const m = inner.match(/^([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?$/u);
      if (!m) return null;
      parts.push({type: 'attr', name: m[1], value: m[2] ?? m[3] ?? m[4] ?? null});
      i = close + 1;
    } else if (c === ':') {
      if (text[i + 1] === ':') return null;
      const m = text.slice(i + 1).match(/^([\w-]+)/u);
      const name = m[1];
      i += 1 + name.length;
      if (text[i] === '(') {
        let depth = 0;
        let j = i;
        for (; j < text.length; j++) {
          if (text[j] === '(') depth++;
          else if (text[j] === ')') { depth--; if (depth === 0) break; }
        }
        const argument = text.slice(i + 1, j);
        i = j + 1;
        if (!['not', 'is', 'where'].includes(name)) return null;
        const list = splitTop(argument, ',').map((s) => complex(s.trim()));
        parts.push({type: name, list});
      } else if (name === 'root') parts.push({type: 'root'});
      else return null; // :hover, :defined, :focus-visible ...
    } else if (c === '*') i++;
    else {
      const m = text.slice(i).match(/^([\w-]+)/u);
      if (!m) return null;
      parts.push({type: 'tag', value: m[1].toLowerCase()});
      i += m[1].length;
    }
  }
  return parts;
}

// A complex selector: compounds joined by descendant or child combinators.
function complex(text) {
  // split at combinators outside parentheses and brackets
  const tokens = [];
  let depth = 0;
  let current = '';
  const flush = () => { if (current) tokens.push(current); current = ''; };
  for (const c of text.trim()) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (depth === 0 && /\s/u.test(c)) { flush(); continue; }
    if (depth === 0 && (c === '>' || c === '+' || c === '~')) { flush(); tokens.push(c); continue; }
    current += c;
  }
  flush();
  const steps = [];
  let combinator = ' ';
  for (const token of tokens) {
    if (token === '>' || token === '+' || token === '~') { combinator = token; continue; }
    const parts = compound(token);
    steps.push({parts, combinator});
    combinator = ' ';
  }
  return steps;
}

function matchCompound(parts, el) {
  if (!parts) return false;
  return parts.every((p) => {
    switch (p.type) {
      case 'class': return el.classes.has(p.value);
      case 'attr': return el.attrs.has(p.name) && (p.value === null || el.attrs.get(p.name) === p.value);
      case 'root': return el.root;
      case 'tag': return el.tag === p.value;
      case 'not': return !p.list.some((steps) => matchComplex(steps, el));
      case 'is': case 'where': return p.list.some((steps) => matchComplex(steps, el));
      default: return false;
    }
  });
}

function matchComplex(steps, el) {
  if (!steps.length || steps.some((s) => s.combinator === '+' || s.combinator === '~')) return false;
  let index = steps.length - 1;
  if (!matchCompound(steps[index].parts, el)) return false;
  let current = el;
  while (index > 0) {
    const combinator = steps[index].combinator;
    index--;
    if (combinator === '>') {
      current = current.parent;
      if (!current || !matchCompound(steps[index].parts, current)) return false;
    } else {
      current = current.parent;
      while (current && !matchCompound(steps[index].parts, current)) current = current.parent;
      if (!current) return false;
    }
  }
  return true;
}

function specificity(steps) {
  let a = 0; let b = 0; let c = 0;
  const add = (parts) => {
    for (const p of parts || []) {
      if (p.type === 'class' || p.type === 'attr' || p.type === 'root') b++;
      else if (p.type === 'tag') c++;
      else if (p.type === 'not' || p.type === 'is') {
        const best = p.list.map(specificity).sort(compareSpecificity).at(-1) ?? [0, 0, 0];
        a += best[0]; b += best[1]; c += best[2];
      }
    }
  };
  for (const s of steps) add(s.parts);
  return [a, b, c];
}

function compareSpecificity(x, y) {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/* ---------- cascade ---------- */

export function cascade(sheet, width) {
  const {rules, layerOrder} = sheet;
  const rank = (layer) => (layer === null ? Infinity : layerOrder.indexOf(layer));
  const active = rules.filter((rule) => rule.media.every((m) => mediaMatches(m, width)))
    .map((rule) => ({...rule, parsed: rule.selectors.map((s) => complex(s))}));

  const cache = new Map();
  function specified(el) {
    if (cache.has(el)) return cache.get(el);
    const winners = new Map(); // name -> {value, key}
    for (const rule of active) {
      let best = null;
      for (const steps of rule.parsed) {
        if (matchComplex(steps, el)) {
          const s = specificity(steps);
          if (!best || compareSpecificity(s, best) > 0) best = s;
        }
      }
      if (!best) continue;
      const key = [rank(rule.layer), ...best, rule.order];
      for (const [name, value] of rule.declarations) {
        const current = winners.get(name);
        if (!current || compareKeys(key, current.key) >= 0) winners.set(name, {value, key});
      }
    }
    cache.set(el, winners);
    return winners;
  }

  const computedCache = new Map();
  function computed(el, name, seen = new Set()) {
    if (!el) return null;
    let perElement = computedCache.get(el);
    if (!perElement) computedCache.set(el, (perElement = new Map()));
    if (perElement.has(name)) return perElement.get(name);
    const own = specified(el).get(name);
    let value;
    if (!own) value = computed(el.parent, name, seen);
    else {
      const key = `${name}`;
      if (seen.has(key)) return null; // a cycle: invalid
      seen.add(key);
      value = substitute(own.value, (ref) => computed(el, ref, seen));
      seen.delete(key);
    }
    perElement.set(name, value);
    return value;
  }
  return {computed, specified};
}

function compareKeys(x, y) {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// Replace var(--name[, fallback]) through a lookup; null when a bare read finds nothing.
export function substitute(value, lookup) {
  if (value === null || value === undefined) return null;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at < 0) { out += value.slice(i); break; }
    out += value.slice(i, at);
    let depth = 0;
    let j = at + 3;
    for (; j < value.length; j++) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') { depth--; if (depth === 0) break; }
    }
    const inner = value.slice(at + 4, j);
    const comma = splitTop(inner, ',');
    const name = comma[0].trim().replace(/\\/gu, '');
    const fallback = comma.length > 1 ? comma.slice(1).join(',').trim() : null;
    let got = lookup(name);
    if (got === null || got === undefined) got = fallback === null ? null : substitute(fallback, lookup);
    if (got === null) return null;
    out += got;
    i = j + 1;
  }
  return out;
}

/* ---------- numbers ---------- */

// Evaluate a resolved value to a number of px (lengths) or a plain number.
export function evaluate(text) {
  if (text === null || text === undefined) return null;
  const tokens = text.trim().match(/-?\d*\.?\d+(?:e-?\d+)?(?:px|rem|em|%)?|[a-z-]+\(|[()+\-*/,]|\S+/giu) || [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary() {
    const t = next();
    if (t === undefined) throw new Error('end');
    if (t === '(') { const v = sum(); expect(')'); return v; }
    if (/^(calc|min|max|clamp)\($/iu.test(t)) {
      const fn = t.slice(0, -1).toLowerCase();
      const args = [sum()];
      while (peek() === ',') { next(); args.push(sum()); }
      expect(')');
      if (fn === 'calc') return args[0];
      const pick = (list, f) => list.reduce((a, b) => ({n: f(a.n, b.n), unit: a.unit || b.unit}));
      if (fn === 'min') return pick(args, Math.min);
      if (fn === 'max') return pick(args, Math.max);
      return {n: Math.min(Math.max(args[0].n, args[1].n), args[2].n), unit: args[1].unit};
    }
    if (t === '-') { const v = primary(); return {n: -v.n, unit: v.unit}; }
    const m = t.match(/^(-?\d*\.?\d+(?:e-?\d+)?)(px|rem|em|%)?$/iu);
    if (!m) throw new Error(`token ${t}`);
    const n = Number(m[1]);
    const unit = m[2]?.toLowerCase();
    if (unit === 'rem' || unit === 'em') return {n: n * ROOT_PX, unit: 'px'};
    if (unit === '%') throw new Error('percent');
    return {n, unit: unit || null};
  }
  function product() {
    let v = primary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const w = primary();
      v = op === '*' ? {n: v.n * w.n, unit: v.unit || w.unit} : {n: v.n / w.n, unit: v.unit};
    }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const w = product();
      v = {n: op === '+' ? v.n + w.n : v.n - w.n, unit: v.unit || w.unit};
    }
    return v;
  }
  function expect(t) { if (next() !== t) throw new Error(`expected ${t}`); }

  try {
    const v = sum();
    if (pos !== tokens.length) return null;
    return Math.round(v.n * 1000) / 1000;
  } catch {
    return null;
  }
}

/* ---------- the three scenarios of a Numbers table ---------- */

export const WIDTH = {normal: 1440, compact: 1440, phone: 390};

// The chain for a scenario: <html> (with the density on a region inside it
// for compact) and, when `on` names classes, an element carrying them.
export function chain(scenario, on) {
  const html = element({tag: 'html', root: true});
  let host = html;
  if (scenario === 'compact') host = element({parent: html, attrs: {'data-sf-density': 'compact'}});
  if (!on) return host;
  const classes = [...on.matchAll(/\.((?:\\.|[\w/-])+)/gu)].map((m) => m[1].replace(/\\/gu, ''));
  const tag = on.match(/^([a-z][\w-]*)/u)?.[1] ?? 'div';
  return element({tag, classes, parent: host});
}

const cascades = new WeakMap();
export function resolveToken(sheet, scenario, token, on) {
  if (!cascades.has(sheet)) cascades.set(sheet, new Map());
  const perSheet = cascades.get(sheet);
  if (!perSheet.has(WIDTH[scenario])) perSheet.set(WIDTH[scenario], cascade(sheet, WIDTH[scenario]));
  const {computed} = perSheet.get(WIDTH[scenario]);
  const el = chain(scenario, on);
  // A token, or an expression over tokens (`calc(var(--a) + 2 * var(--b))`).
  if (token.startsWith('--')) return evaluate(computed(el, token));
  return evaluate(substitute(token, (name) => computed(el, name)));
}

/* ---------- the documents ---------- */

export function readDoc(name) {
  return readFileSync(resolve(root, 'docs', name), 'utf8');
}

// The section under a "## <title>" heading, up to the next "## ".
export function section(doc, title) {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^## /u.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join('\n');
}

// The rows of the first table in a section, as objects keyed by the header.
export function tableRows(text) {
  const lines = text.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const cells = (line) => splitTop(line.trim().replace(/^\||\|$/gu, ''), '|').map((c) => c.trim());
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(2).map((line) => Object.fromEntries(cells(line).map((c, i) => [header[i], c])));
}

// `--sf-x` -> --sf-x ; `.a.b` -> .a.b ; empty -> null
export function code(cell) {
  const m = (cell || '').match(/`([^`]+)`/u);
  return m ? m[1] : null;
}

export function decisionIds(cell) {
  return [...(cell || '').matchAll(/\bC\d{2,3}\b/gu)].map((m) => m[0]);
}

// Every numbered rule of the "Rules" section names its owner decision.
export function rulesWithoutDecision(doc) {
  const rules = section(doc, 'Rules');
  if (rules === null) return ['no "## Rules" section'];
  const items = [];
  let current = null;
  for (const line of rules.split('\n')) {
    const m = line.match(/^(\d+)\.\s/u);
    if (m) { current = {n: m[1], text: line}; items.push(current); } else if (current && line.trim()) current.text += ` ${line.trim()}`;
  }
  if (!items.length) return ['the Rules section has no numbered rule'];
  return items.filter((item) => decisionIds(item.text).length === 0).map((item) => `rule ${item.n}`);
}

// Check every row of a Numbers table against the sheet. Returns the
// differences as text; an empty list means the document holds the code's numbers.
export function compareNumbers(sheet, doc, title = 'Numbers') {
  const numbers = section(doc, title);
  if (numbers === null) return [`no "## ${title}" section`];
  const rows = tableRows(numbers);
  if (!rows.length) return [`the ${title} section has no table`];
  const problems = [];
  for (const row of rows) {
    const token = code(row.token);
    const on = code(row.on);
    const label = `${row.rule} ${token}${on ? ` on ${on}` : ''}`;
    if (!decisionIds(row.rule).length) problems.push(`${label}: the row names no decision`);
    if (!token) { problems.push(`${label}: no token`); continue; }
    for (const scenario of ['normal', 'compact', 'phone']) {
      const want = row[scenario];
      if (want === undefined || want === '' || want === '—') continue;
      const got = resolveToken(sheet, scenario, token, on);
      if (got === null) problems.push(`${label} (${scenario}): the built sheets do not resolve it`);
      else if (Number(want) !== got) problems.push(`${label} (${scenario}): document ${want}, built ${got}`);
    }
  }
  return problems;
}

// Every repository path the "Check" section names (in backticks) exists.
export function missingCheckPaths(doc) {
  const check = section(doc, 'Check');
  if (check === null) return ['no "## Check" section'];
  const paths = [...check.matchAll(/`((?:tests|scripts|tools|src)\/[^`\s]+)`/gu)].map((m) => m[1]);
  if (!paths.length) return ['the Check section names no test'];
  return paths.filter((path) => !existsSync(resolve(root, path)));
}

// The standard tests of a theme page: rules carry decisions, the Check
// section points at files that exist, the Numbers table holds the built
// numbers. `files` are the built sheets the Numbers table needs, relative to
// distr/. Returns the parsed sheet (or null when there is no build to read)
// for the theme's own tests.
export function registerThemeTests(test, assert, {page, files}) {
  const doc = readDoc(page);
  const {explicit, distr} = builtCore();
  const built = readBuilt(files);
  const sheet = built.css === null ? null : parseSheet(built.css);
  const skip = sheet === null && !explicit && `no built sheets under ${distr}: set UI_CORE_ROOT to the build being graded`;

  test(`${page}: every rule names the owner decision that set it`, () => {
    assert.deepEqual(rulesWithoutDecision(doc), []);
  });

  test(`${page}: every file the Check section names exists`, () => {
    assert.deepEqual(missingCheckPaths(doc), []);
  });

  test(`${page}: the Numbers table holds the built tokens`, {skip}, () => {
    assert.deepEqual(built.missing, [], `UI_CORE_ROOT is set but these built sheets are missing`);
    assert.deepEqual(compareNumbers(sheet, doc), []);
  });

  return {doc, sheet, skip};
}
