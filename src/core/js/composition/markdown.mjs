// Markdown and the Composition model (2026-11-10 composition review, F2.4).
//
// One parser and one printer for structured content and for a single text
// area, in Docara's authoring form: CommonMark with GFM tables and strike,
// and Docara's directives (`:::alert {type=warning}` ... `:::`, inline
// `:kbd[K]`). Markdown is a projection of the model, not its exchange form:
//
//   fromMarkdown(text, {id})        -> Promise<{value: Document, losses}>
//   toMarkdown(document, {ids})     -> Promise<{value: string, losses}>
//
// A loss is {code, path, what} and is never silent:
//   not_expressible              the other side has no place for it (node
//                                ids, presentation, figure size, a type with
//                                no Markdown form, a Markdown block the model
//                                cannot hold, which is kept as content.foreign)
//   form_normalized              the source used another spelling of the same
//                                content (a `*` bullet, `~~~` fences, a blank
//                                line too many); the printer writes its one form
//   docara_alert_title_required  a content.alert without a title, written
//                                without one (Docara requires it; it is never
//                                invented)
//   foreign_hash_mismatch        a content.foreign whose hash does not match
//                                its raw; it is not written
//
// The guarantee: a Markdown block the model cannot hold exactly is kept as
// content.foreign {source: markdown, raw} with its source bytes, so text that
// comes back from fromMarkdown with no form_normalized loss prints back to
// the same bytes. Every block is checked by printing it and reading it back.
//
// Vocabulary (decision 12): the Document uses the Framework's names; this
// module maps Docara's: alert `type` <-> `status`, `variant` <-> `appearance`,
// `clear` <-> neutral (no status), `danger` <-> `error`, the first heading <->
// `data.title`; details `layout=outline` <-> no layout, its first heading <->
// `data.summary`; steps hold one ordered list; tabs are `###` sections.

import { breakSegment, fromSegments, INLINE_COMPONENTS, normalizeInline, safeHref, toSegments } from './inline-model.mjs';
import { foreignNode, mismatchedForeign, normalizedTree, settleHashes, stable, withoutIds } from './foreign.mjs';

class Unsupported extends Error {}
const fail = (what) => { throw new Unsupported(what); };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;
const BLANK = /^[ \t]*$/u;
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/u;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/u;
const THEMATIC = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/u;
const DIRECTIVE = /^(:{3,})([a-z][a-z0-9_-]*)(?:[ \t]*\{(.*)\})?[ \t]*$/u;
const LIST_MARKER = /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+|$)/u;
const QUOTE = /^ {0,3}>/u;
const HTML_BLOCK = /^ {0,3}<(?:[A-Za-z/!?])/u;
const INDENTED = /^(?: {4}|\t)/u;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/u;
const PUNCT = /^[!-/:-@[-`{-~]$/u;

// ---------------------------------------------------------------------------
// Attributes: {k=v k="v w" #id}

function parseAttributes(source) {
  const out = { id: null, values: new Map(), order: [] };
  if (source === undefined) return out;
  const pattern = /[ \t]*(?:#([A-Za-z0-9][A-Za-z0-9._:-]*)|([a-z][a-z0-9_-]*)=(?:"([^"]*)"|([^\s"}]+)))/uy;
  let at = 0;
  while (at < source.length) {
    if (/^[ \t]*$/u.test(source.slice(at))) break;
    pattern.lastIndex = at;
    const match = pattern.exec(source);
    if (!match) fail('attribute');
    if (match[1]) {
      if (out.id) fail('attribute');
      out.id = match[1];
    } else {
      if (out.values.has(match[2])) fail('attribute');
      out.values.set(match[2], match[3] ?? match[4]);
      out.order.push(match[2]);
    }
    at = pattern.lastIndex;
  }
  return out;
}

function printAttributes(pairs, id) {
  const parts = [];
  if (id) parts.push(`#${id}`);
  for (const [key, value] of pairs) {
    if (value === undefined || value === null) continue;
    const text = String(value);
    parts.push(/^[A-Za-z0-9_./-]+$/u.test(text) ? `${key}=${text}` : `${key}="${text}"`);
  }
  return parts.length ? ` {${parts.join(' ')}}` : '';
}

function takeAttributes(attributes, allowed) {
  for (const key of attributes.order) if (!allowed.includes(key)) fail(`attribute ${key}`);
  return (key) => attributes.values.get(key);
}

const integer = (value, min, max) => {
  if (value === undefined) return undefined;
  if (!/^\d{1,9}$/u.test(value) || Number(value) < min || Number(value) > max) fail('integer');
  return Number(value);
};
const oneOf = (value, list) => {
  if (value === undefined) return undefined;
  if (!list.includes(value)) fail('value');
  return value;
};
const boolean = (value) => {
  if (value === undefined) return undefined;
  if (value !== 'true' && value !== 'false') fail('boolean');
  return value === 'true';
};
const props = (entries) => {
  const out = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
  return Object.keys(out).length ? out : undefined;
};
const node = (id, type, { data, props: parameters, slots } = {}) => ({
  id,
  type,
  ...(parameters ? { props: parameters } : {}),
  ...(data ? { data } : {}),
  ...(slots ? { slots } : {}),
});

// ---------------------------------------------------------------------------
// Inline

const ATOM_FORMS = {
  kbd: { label: 'text', attributes: {} },
  badge: { label: 'text', attributes: { variant: 'appearance', scheme: 'scheme', size: 'size', status: 'status', icon: 'icon' } },
  icon: { label: 'icon', attributes: { size: 'size', label: 'label', filled: 'filled' } },
};
const ATOM_PROPERTY = /^[a-z0-9][a-z0-9_/-]{0,63}$/u;

function parseInline(source, { html = false } = {}) {
  const segments = [];
  const push = (text, marks, href) => { if (text) segments.push({ text, marks: [...marks], href }); };
  const mark = (marks, name) => {
    if (marks.includes(name)) fail('nested mark');
    return [...marks, name];
  };
  const spaceAt = (at) => at < 0 || at >= source.length || /\s/u.test(source[at]);
  const wordAt = (at) => at >= 0 && at < source.length && /[\p{L}\p{N}]/u.test(source[at]);
  // run() reads until its closing delimiter; it returns where it ended and
  // whether the delimiter was found, so an unclosed one is read as text.
  const run = (at, end, marks, href, close) => {
    let text = '';
    const flush = () => { push(text, marks, href); text = ''; };
    while (at < end) {
      if (close && source.startsWith(close.delimiter, at) && close.ok(at)) {
        flush();
        return { at: at + close.delimiter.length, closed: true };
      }
      const char = source[at];
      if (char === '\\') {
        const next = source[at + 1];
        if (next === '\n') { flush(); segments.push(breakSegment(marks, href)); at += 2; continue; }
        if (next !== undefined && PUNCT.test(next)) { text += next; at += 2; continue; }
        text += char; at += 1; continue;
      }
      if (char === '\n') {
        if (/ {2,}$/u.test(text)) { text = text.replace(/ +$/u, ''); flush(); segments.push(breakSegment(marks, href)); at += 1; continue; }
        text = `${text.replace(/[ \t]+$/u, '')}\n`;
        at += 1;
        continue;
      }
      if (char === '`') {
        const ticks = /^`+/u.exec(source.slice(at))[0];
        let search = at + ticks.length;
        let found = -1;
        while (search < end) {
          const next = source.indexOf(ticks, search);
          if (next < 0 || next >= end) break;
          if (source[next + ticks.length] !== '`' && source[next - 1] !== '`') { found = next; break; }
          search = next + 1;
        }
        if (found < 0) { text += ticks; at += ticks.length; continue; }
        let code = source.slice(at + ticks.length, found).replace(/\n/gu, ' ');
        if (code.length > 1 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
        flush();
        push(code, mark(marks, 'code'), href);
        at = found + ticks.length;
        continue;
      }
      if (char === '*' || char === '_' || (char === '~' && source[at + 1] === '~')) {
        const double = source[at + 1] === char;
        if (char === '~' && source[at + 2] === '~') fail('strike delimiter');
        const delimiter = double ? char + char : char;
        const opens = !spaceAt(at + delimiter.length) && !(char === '_' && wordAt(at - 1));
        if (opens) {
          const name = char === '~' ? 'strike' : double ? 'strong' : 'em';
          // A single delimiter closes unless it starts a double one: `a***`
          // closes em, then strong; `a**b` does not close em.
          const ok = (position) => !spaceAt(position - 1) && !(char === '_' && wordAt(position + delimiter.length))
            && (double || source[position + 1] !== char || source[position + 2] === char);
          flush();
          const saved = segments.length;
          const inner = run(at + delimiter.length, end, mark(marks, name), href, { delimiter, ok });
          if (inner.closed && segments.length > saved) { at = inner.at; continue; }
          segments.length = saved;
        }
        text += delimiter;
        at += delimiter.length;
        continue;
      }
      if (char === '!' && source[at + 1] === '[') fail('inline image');
      if (char === '[') {
        const link = readLink(source, at, end);
        if (link) {
          if (href !== null) fail('link in link');
          if (!safeHref(link.href)) fail('link address');
          flush();
          const inner = run(link.textStart, link.textEnd, marks, link.href, null);
          if (inner.at !== link.textEnd) fail('link text');
          at = link.end;
          continue;
        }
        text += char; at += 1; continue;
      }
      if (char === '<') {
        const tag = /^<br[ \t]*\/?>/iu.exec(source.slice(at, end));
        if (tag) {
          flush();
          segments.push(breakSegment(marks, href));
          at += tag[0].length;
          continue;
        }
        const auto = /^<(https?:\/\/[^\s<>]+)>/u.exec(source.slice(at, end));
        if (auto) {
          if (href !== null || !safeHref(auto[1])) fail('autolink');
          flush();
          push(auto[1], marks, auto[1]);
          at += auto[0].length;
          continue;
        }
        if (/^<[A-Za-z/!?]/u.test(source.slice(at, end))) fail('inline html');
        text += char; at += 1; continue;
      }
      if (char === '&' && /^&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/iu.test(source.slice(at, end))) fail('entity');
      if (char === ':') {
        const atom = /^:([a-z][a-z0-9-]*)(?:\[((?:\\.|[^\]\\\n])*)\])?(\{[^}\n]*\})?/u.exec(source.slice(at, end));
        if (atom && (atom[2] !== undefined || atom[3] !== undefined)) {
          flush();
          segments.push({ text: '￼', marks: [], href: null, node: readAtom(atom) });
          at += atom[0].length;
          continue;
        }
      }
      text += char;
      at += 1;
    }
    flush();
    return { at, closed: false };
  };
  const result = run(0, source.length, [], null, null);
  if (result.at !== source.length) fail('inline');
  return fromSegments(segments);
}

function readAtom(match) {
  const [, name, label, braces] = match;
  const form = ATOM_FORMS[name];
  if (!form) fail(`inline directive ${name}`);
  const attributes = parseAttributes(braces === undefined ? undefined : braces.slice(1, -1));
  if (attributes.id) fail('inline id');
  const get = takeAttributes(attributes, Object.keys(form.attributes));
  const parameters = {};
  if (label !== undefined) parameters[form.label] = label.replace(/\\(.)/gu, '$1');
  for (const [from, to] of Object.entries(form.attributes)) {
    const value = get(from);
    if (value === undefined) continue;
    if (to === 'filled') parameters[to] = boolean(value);
    else if (to === 'label') parameters[to] = value;
    else if (!ATOM_PROPERTY.test(value)) fail('inline value');
    else parameters[to] = value;
  }
  if (name === 'kbd' && typeof parameters.text !== 'string') fail('kbd text');
  if (name === 'icon' && !ATOM_PROPERTY.test(parameters.icon || '')) fail('icon name');
  if (!INLINE_COMPONENTS[name]) fail(`inline component ${name}`);
  return { type: 'component', name, ...(Object.keys(parameters).length ? { props: parameters } : {}) };
}

function readLink(source, at, end) {
  let depth = 0;
  let index = at;
  for (; index < end; index += 1) {
    const char = source[index];
    if (char === '\\') { index += 1; continue; }
    if (char === '`') {
      const ticks = /^`+/u.exec(source.slice(index))[0];
      const close = source.indexOf(ticks, index + ticks.length);
      if (close > 0 && close < end) index = close + ticks.length - 1;
      else index += ticks.length - 1;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') { depth -= 1; if (depth === 0) break; }
  }
  if (index >= end || source[index + 1] !== '(') return null;
  const target = /^\(([^\s()<>]*)\)/u.exec(source.slice(index + 1, end));
  if (!target) fail('link target');
  return { textStart: at + 1, textEnd: index, href: target[1].replace(/\\([!-/:-@[-`{-~])/gu, '$1'), end: index + 1 + target[0].length };
}

function printAtom(entry, path, losses) {
  const form = ATOM_FORMS[entry.name];
  if (!form) {
    losses.push({ code: 'not_expressible', path, what: `inline component ${entry.name}` });
    return '';
  }
  const parameters = entry.props || {};
  const label = parameters[form.label];
  const pairs = [];
  for (const [from, to] of Object.entries(form.attributes)) if (parameters[to] !== undefined) pairs.push([from, parameters[to]]);
  for (const key of Object.keys(parameters)) {
    if (key !== form.label && !Object.values(form.attributes).includes(key)) losses.push({ code: 'not_expressible', path, what: `${entry.name} ${key}` });
  }
  // A directive needs its label or its braces: a bare atom is written `{}`.
  const braces = printAttributes(pairs).trimStart() || (label === undefined ? '{}' : '');
  return `:${entry.name}${label === undefined ? '' : `[${String(label).replace(/[\\\]]/gu, '\\$&')}]`}${braces}`;
}

function escapeText(text, { cell = false } = {}) {
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const before = text[index - 1];
    const after = text[index + 1];
    const word = (value) => value !== undefined && /[\p{L}\p{N}]/u.test(value);
    if ('\\*`[]'.includes(char)
      || (char === '_' && !(word(before) && word(after)))
      || (char === '~' && (before === '~' || after === '~'))
      || (char === '<' && after !== undefined && /[A-Za-z/!?]/u.test(after))
      || (char === '&' && /^&(?:#\d|#x|[a-z][a-z0-9]*;)/iu.test(text.slice(index)))
      || (char === ':' && /^:[a-z][a-z0-9-]*[[{]/u.test(text.slice(index)))
      || (char === '|' && cell)) out += '\\';
    out += char;
  }
  return out;
}

// One line of a printed paragraph must not read as the start of a block.
function escapeLineStarts(text) {
  return text.split('\n').map((line) => {
    if (/^#{1,6}(?:[ \t]|$)/u.test(line) || /^>/u.test(line) || /^[-+](?:[ \t]|$)/u.test(line) || /^:{3}/u.test(line)
      || /^=+[ \t]*$/u.test(line) || /^-+[ \t]*$/u.test(line) || /^~{3}/u.test(line)) return `\\${line}`;
    return line.replace(/^(\d{1,9})([.)])(?=[ \t]|$)/u, '$1\\$2');
  }).join('\n');
}

const MARK_DELIMITERS = { strike: '~~', strong: '**', em: '*' };
const OPEN_ORDER = ['strike', 'strong', 'em'];

function printInline(content, path, losses, { html = false, cell = false } = {}) {
  const segments = toSegments(normalizeInline(Array.isArray(content) ? content : []));
  let out = '';
  let stack = [];
  let link = null;
  const closeTo = (keep) => {
    while (stack.length && !keep.includes(stack.at(-1))) out += MARK_DELIMITERS[stack.pop()];
    // A mark deeper than one that closes is closed with it and opened again.
    const index = stack.findIndex((name) => !keep.includes(name));
    if (index >= 0) {
      for (const name of stack.slice(index).reverse()) out += MARK_DELIMITERS[name];
      stack = stack.slice(0, index);
    }
  };
  const open = (wanted) => {
    for (const name of OPEN_ORDER) if (wanted.includes(name) && !stack.includes(name)) { out += MARK_DELIMITERS[name]; stack.push(name); }
  };
  segments.forEach((segment, index) => {
    const at = `${path}[${index}]`;
    const href = segment.node ? null : segment.href;
    if (href !== link) {
      closeTo([]);
      if (link !== null) out += `](${link.replace(/[()\\\s]/gu, '\\$&')})`;
      if (href !== null) { out = out.replace(/!$/u, '\\!'); out += '['; }
      link = href;
    }
    if (segment.node) {
      closeTo([]);
      if (segment.node.type === 'component') out += printAtom(segment.node, at, losses);
      else losses.push({ code: 'not_expressible', path: at, what: `inline ${segment.node.type}` });
      return;
    }
    const known = segment.marks.filter((name) => name in MARK_DELIMITERS || name === 'code');
    for (const name of segment.marks) if (!known.includes(name)) losses.push({ code: 'not_expressible', path: at, what: `mark ${name}` });
    closeTo(known);
    open(known);
    if (segment.break) {
      out += html ? '<br>' : '\\\n';
      return;
    }
    if (known.includes('code')) {
      const longest = Math.max(0, ...(segment.text.match(/`+/gu) || []).map((run) => run.length));
      const ticks = '`'.repeat(longest + 1);
      const pad = segment.text.startsWith('`') || segment.text.endsWith('`') || (segment.text.startsWith(' ') && segment.text.endsWith(' ') && segment.text.trim()) ? ' ' : '';
      out += `${ticks}${pad}${segment.text}${pad}${ticks}`;
      return;
    }
    out += escapeText(segment.text, { cell });
  });
  closeTo([]);
  if (link !== null) out += `](${link.replace(/[()\\\s]/gu, '\\$&')})`;
  return out;
}

// ---------------------------------------------------------------------------
// Blocks: reading

function closingDirective(lines, start, colons, name) {
  let depth = 0;
  let fence = null;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = FENCE.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[2][0] === fence[0] && fenceMatch[2].length >= fence.length && !fenceMatch[3].trim()) fence = null;
      continue;
    }
    if (fenceMatch) { fence = fenceMatch[2]; continue; }
    const open = DIRECTIVE.exec(line);
    if (open && open[1].length === colons.length) { depth += 1; continue; }
    if (new RegExp(`^:{${colons.length}}[ \\t]*$`, 'u').test(line)) {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

// Where a block that starts at `start` ends, whatever its kind: the unit a
// failure keeps as content.foreign.
function blockEnd(lines, start) {
  const line = lines[start];
  if (start === 0 && line === '---') {
    const close = lines.indexOf('---', 1);
    if (close > 0) return close + 1;
  }
  const fence = FENCE.exec(line);
  if (fence) {
    for (let index = start + 1; index < lines.length; index += 1) {
      const close = FENCE.exec(lines[index]);
      if (close && close[2][0] === fence[2][0] && close[2].length >= fence[2].length && !close[3].trim()) return index + 1;
    }
    return lines.length;
  }
  const directive = DIRECTIVE.exec(line);
  if (directive) {
    const close = closingDirective(lines, start + 1, directive[1], directive[2]);
    return close < 0 ? lines.length : close + 1;
  }
  if (HEADING.test(line) || THEMATIC.test(line)) return start + 1;
  if (LIST_MARKER.test(line) && !THEMATIC.test(line)) {
    let index = start + 1;
    while (index < lines.length) {
      const current = lines[index];
      if (BLANK.test(current)) {
        let next = index + 1;
        while (next < lines.length && BLANK.test(lines[next])) next += 1;
        if (next < lines.length && (/^[ \t]/u.test(lines[next]) || LIST_MARKER.test(lines[next]))) { index = next; continue; }
        break;
      }
      index += 1;
    }
    return index;
  }
  let index = start + 1;
  while (index < lines.length && !BLANK.test(lines[index])) {
    // A fence or a directive inside the run ends where it ends, blank lines and all.
    if (FENCE.test(lines[index]) || DIRECTIVE.test(lines[index])) { index = blockEnd(lines, index); continue; }
    index += 1;
  }
  return index;
}

function interrupts(line) {
  if (FENCE.test(line) || HEADING.test(line) || THEMATIC.test(line) || QUOTE.test(line) || /^:{3,}/u.test(line) || HTML_BLOCK.test(line)) return true;
  const marker = LIST_MARKER.exec(line);
  return Boolean(marker && marker[3] && (/^[-+*]$/u.test(marker[2]) || /^1[.)]$/u.test(marker[2])) && !BLANK.test(line.slice(marker[0].length)));
}

function parseBlocks(lines, context) {
  const nodes = [];
  let index = 0;
  while (index < lines.length) {
    if (BLANK.test(lines[index])) { index += 1; continue; }
    const result = parseBlock(lines, index, context);
    nodes.push(...result.nodes);
    index = result.end;
  }
  return nodes;
}

function parseBlock(lines, index, context) {
  const line = lines[index];
  const fence = FENCE.exec(line);
  if (fence) return parseFence(lines, index, fence, context);
  const heading = HEADING.exec(line);
  if (heading) {
    return { nodes: [node(context.id(), 'content.heading', { data: { level: heading[1].length, content: parseInline(heading[2] || '', { html: true }) } })], end: index + 1 };
  }
  if (THEMATIC.test(line)) return { nodes: [node(context.id(), 'content.divider')], end: index + 1 };
  const directive = DIRECTIVE.exec(line);
  if (directive) return parseDirective(lines, index, directive, context);
  if (/^:{3,}/u.test(line)) fail('directive');
  if (QUOTE.test(line)) {
    const body = [];
    let end = index;
    while (end < lines.length && QUOTE.test(lines[end])) { body.push(lines[end].replace(/^ {0,3}> ?/u, '')); end += 1; }
    if (end < lines.length && !BLANK.test(lines[end])) fail('lazy quote line');
    return { nodes: [node(context.id(), 'content.quote', { slots: { default: parseBlocks(body, context) } })], end };
  }
  if (LIST_MARKER.test(line)) return parseList(lines, index, context);
  if (line.includes('|') && index + 1 < lines.length && TABLE_DELIMITER.test(lines[index + 1]) && lines[index + 1].includes('-')) return parseTable(lines, index, context);
  if (HTML_BLOCK.test(line)) fail('html block');
  if (INDENTED.test(line)) fail('indented code');
  const paragraph = [line.replace(/^[ \t]+/u, '')];
  let end = index + 1;
  while (end < lines.length && !BLANK.test(lines[end]) && !interrupts(lines[end])) {
    if (/^ {0,3}(?:=+|-+)[ \t]*$/u.test(lines[end])) fail('setext heading');
    if (lines[end].includes('|') && end + 1 < lines.length && TABLE_DELIMITER.test(lines[end + 1])) fail('table after text');
    paragraph.push(lines[end].replace(/^[ \t]+/u, ''));
    end += 1;
  }
  if (end < lines.length && /^ {0,3}-+[ \t]*$/u.test(lines[end])) fail('setext heading');
  const text = paragraph.join('\n').replace(/[ \t]+$/u, '');
  const image = /^!\[((?:\\.|[^\]\\])*)\]\(([^\s()<>]+)\)$/u.exec(text);
  if (image) return { nodes: [figureNode(context.id(), image, undefined)], end };
  return { nodes: [node(context.id(), 'content.paragraph', { data: { content: parseInline(text) } })], end };
}

function figureNode(id, image, parameters, caption) {
  const src = image[2];
  if (!safeHref(src)) fail('image address');
  return node(id, 'content.figure', { props: parameters, data: { src, alt: image[1].replace(/\\(.)/gu, '$1'), ...(caption ? { caption } : {}) } });
}

function parseFence(lines, index, fence, context) {
  const [, indent, marker, info] = fence;
  if (marker[0] === '`' && info.includes('`')) fail('fence info');
  const body = [];
  let end = index + 1;
  let closed = false;
  for (; end < lines.length; end += 1) {
    const close = FENCE.exec(lines[end]);
    if (close && close[2][0] === marker[0] && close[2].length >= marker.length && !close[3].trim()) { closed = true; end += 1; break; }
    body.push(lines[end].replace(new RegExp(`^ {0,${indent.length}}`, 'u'), ''));
  }
  if (!closed) fail('unclosed fence');
  const parts = /^[ \t]*([a-z0-9][a-z0-9+#._-]{0,31})?(?:[ \t]+\{(.*)\})?[ \t]*$/u.exec(info);
  if (!parts) fail('fence info');
  const get = takeAttributes(parseAttributes(parts[2]), ['title', 'numbers']);
  const title = get('title');
  if (title !== undefined && (!title || title.length > 200)) fail('code title');
  const parameters = props([['lang', parts[1]], ['title', title], ['numbers', boolean(get('numbers'))]]);
  return { nodes: [node(context.id(), 'content.code', { props: parameters, data: { code: body.join('\n') } })], end };
}

function parseList(lines, index, context) {
  const first = LIST_MARKER.exec(lines[index]);
  const ordered = /\d/u.test(first[2]);
  const kind = ordered ? first[2].slice(-1) : first[2];
  const start = ordered ? Number(first[2].slice(0, -1)) : null;
  const items = [];
  let at = index;
  while (at < lines.length) {
    const marker = LIST_MARKER.exec(lines[at]);
    if (!marker || THEMATIC.test(lines[at])) break;
    const markerKind = /\d/u.test(marker[2]) ? marker[2].slice(-1) : marker[2];
    if (markerKind !== kind || /\d/u.test(marker[2]) !== ordered) break;
    const rest = lines[at].slice(marker[0].length);
    const spaces = marker[3].replace(/\t/gu, '    ').length;
    const width = marker[1].length + marker[2].length + (BLANK.test(rest) ? 1 : spaces > 4 ? 1 : spaces);
    if (spaces > 4) fail('list item indent');
    const body = [BLANK.test(rest) ? '' : rest];
    let next = at + 1;
    while (next < lines.length) {
      const line = lines[next];
      if (BLANK.test(line)) { body.push(''); next += 1; continue; }
      const indent = /^ */u.exec(line)[0].length;
      if (indent >= width) { body.push(line.slice(width)); next += 1; continue; }
      if (LIST_MARKER.test(line) || body.at(-1) === '') break;
      fail('lazy list line');
    }
    while (body.length > 1 && body.at(-1) === '') { body.pop(); next -= 1; }
    while (next > at + 1 && BLANK.test(lines[next - 1])) next -= 1;
    const blocks = parseBlocks(body, context);
    const lead = blocks[0]?.type === 'content.paragraph' && !BLANK.test(body[0]) ? blocks.shift() : null;
    items.push(node(context.id(), 'content.list-item', { data: { content: lead ? lead.data.content : [] }, slots: blocks.length ? { default: blocks } : undefined }));
    at = next;
    let blank = at;
    while (blank < lines.length && BLANK.test(lines[blank])) blank += 1;
    if (blank < lines.length && LIST_MARKER.test(lines[blank]) && blank > at) at = blank;
    else if (blank > at) break;
  }
  const parameters = props([['ordered', ordered ? true : undefined], ['start', ordered && start !== 1 ? start : undefined]]);
  if (ordered && (start < 1 || start > 1000000)) fail('list start');
  return { nodes: [node(context.id(), 'content.list', { props: parameters, slots: { items } })], end: at };
}

function splitCells(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells = [];
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\' && text[index + 1] === '|') { current += '|'; index += 1; continue; }
    if (text[index] === '|') { cells.push(current.trim()); current = ''; continue; }
    current += text[index];
  }
  cells.push(current.trim());
  return cells;
}

function parseTable(lines, index, context) {
  const head = splitCells(lines[index]);
  const align = splitCells(lines[index + 1]).map((cell) => (cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'end' : 'start'));
  if (align.length !== head.length) fail('table delimiter');
  const rows = [head];
  let end = index + 2;
  while (end < lines.length && !BLANK.test(lines[end]) && lines[end].includes('|')) {
    const cells = splitCells(lines[end]);
    if (cells.length !== head.length) fail('table row');
    rows.push(cells);
    end += 1;
  }
  if (end < lines.length && !BLANK.test(lines[end])) fail('table end');
  const parameters = props([['align', align.some((value) => value !== 'start') ? align : undefined]]);
  return { nodes: [node(context.id(), 'content.table', { props: parameters, data: { rows: rows.map((cells) => cells.map((cell) => parseInline(cell, { html: true }))) } })], end };
}

const ALERT_STATUS = { clear: undefined, info: 'info', success: 'success', warning: 'warning', danger: 'error' };
const ALERT_TYPE = { neutral: 'clear', info: 'info', success: 'success', warning: 'warning', error: 'danger' };
const DIRECTIVES = {
  alert(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['type', 'variant']);
    let type = oneOf(get('type'), Object.keys(ALERT_STATUS));
    if (type === undefined) { type = 'info'; context.lose('form_normalized', 'alert without type (Docara reads info)'); }
    const blocks = parseBlocks(body, context);
    const title = blocks[0]?.type === 'content.heading' && blocks[0].data.level >= 2 && blocks[0].data.level <= 5 ? blocks.shift() : null;
    if (title && title.data.level !== 4) context.lose('form_normalized', `alert title level ${title.data.level}`);
    return node(id, 'content.alert', {
      props: props([['status', ALERT_STATUS[type]], ['appearance', oneOf(get('variant'), ['default', 'outlined', 'flat'])]]),
      data: title ? { title: title.data.content } : undefined,
      slots: blocks.length ? { default: blocks } : undefined,
    });
  },
  details(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['open', 'layout']);
    let layout = oneOf(get('layout'), ['outline', 'surface', 'lines']);
    if (layout === 'outline') { layout = undefined; context.lose('form_normalized', 'details layout=outline is the default'); }
    const blocks = parseBlocks(body, context);
    if (!(blocks[0]?.type === 'content.heading' && blocks[0].data.level >= 2 && blocks[0].data.level <= 4)) fail('details summary');
    const summary = blocks.shift();
    if (summary.data.level !== 2) context.lose('form_normalized', `details summary level ${summary.data.level}`);
    return node(id, 'content.details', { props: props([['open', boolean(get('open'))], ['layout', layout]]), data: { summary: summary.data.content }, slots: blocks.length ? { default: blocks } : undefined });
  },
  steps(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['current', 'layout']);
    const blocks = parseBlocks(body, context);
    if (blocks.length !== 1 || blocks[0].type !== 'content.list' || blocks[0].props?.ordered !== true || blocks[0].props.start !== undefined) fail('steps list');
    const steps = blocks[0].slots.items.map((item) => node(item.id, 'content.step', { data: item.data.content.length ? { title: item.data.content } : undefined, slots: item.slots }));
    return node(id, 'content.steps', { props: props([['current', integer(get('current'), 1, 1000)], ['layout', oneOf(get('layout'), ['timeline', 'list'])]]), slots: { steps } });
  },
  tabs(attributes, body, context, id) {
    takeAttributes(attributes, []);
    const tabs = [];
    let current = null;
    for (const block of parseBlocks(body, context)) {
      if (block.type === 'content.heading' && block.data.level === 3) {
        const label = block.data.content.length === 1 && block.data.content[0].type === 'text' && !block.data.content[0].marks ? block.data.content[0].value : null;
        if (!label || label.length > 120 || label.includes('\n')) fail('tab label');
        current = node(block.id, 'content.tab', { data: { label } });
        tabs.push(current);
        continue;
      }
      if (!current) fail('tabs content before a label');
      current.slots = { default: [...(current.slots?.default || []), block] };
    }
    if (!tabs.length) fail('tabs without a tab');
    return node(id, 'content.tabs', { slots: { tabs } });
  },
  figure(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['ratio', 'fit']);
    const parameters = props([['ratio', oneOf(get('ratio'), ['auto', '1/1', '4/3', '3/2', '16/9', '21/9'])], ['fit', oneOf(get('fit'), ['cover', 'contain'])]]);
    const blocks = parseBlocks(body, context);
    if (blocks[0]?.type !== 'content.figure' || blocks[0].props || blocks.length > 2 || (blocks[1] && blocks[1].type !== 'content.paragraph')) fail('figure body');
    const caption = blocks[1]?.data.content;
    return node(id, 'content.figure', { props: parameters, data: { ...blocks[0].data, ...(caption ? { caption } : {}) } });
  },
  card(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['variant']);
    const blocks = parseBlocks(body, context);
    return node(id, 'content.card', { props: props([['variant', oneOf(get('variant'), ['default', 'plain'])]]), slots: blocks.length ? { default: blocks } : undefined });
  },
  grid(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['columns', 'gap']);
    const blocks = parseBlocks(body, context);
    return node(id, 'content.grid', { props: props([['columns', integer(get('columns'), 1, 12)], ['gap', integer(get('gap'), 0, 12)]]), slots: blocks.length ? { default: blocks } : undefined });
  },
  diagram(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['title']);
    if (!body.length) fail('diagram source');
    return node(id, 'content.diagram', { props: props([['title', get('title')]]), data: { source: body.join('\n') } });
  },
  math(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['label']);
    if (!body.length) fail('math source');
    return node(id, 'content.math', { props: props([['label', get('label')]]), data: { source: body.join('\n') } });
  },
  html(attributes, body, context, id) {
    takeAttributes(attributes, []);
    const blocks = parseBlocks(body, context);
    if (blocks.length !== 1 || blocks[0].type !== 'content.code' || blocks[0].props?.lang !== 'html' || Object.keys(blocks[0].props).length !== 1) fail('html body');
    return node(id, 'content.html', { data: { markup: blocks[0].data.code } });
  },
  // :::preserved {source=…} (C75, owner 2026-11-11): what the model cannot
  // hold, kept byte for byte. No :::foreign alias: that spelling was in no
  // released pair and no page.
  preserved(attributes, body, context, id) {
    const get = takeAttributes(attributes, ['source']);
    const source = oneOf(get('source'), ['markdown', 'editorjs', 'html']);
    if (!source) fail('preserved source');
    const blocks = parseBlocks(body, context);
    if (blocks.length !== 1 || blocks[0].type !== 'content.code') fail('preserved body');
    const carried = foreignNode(id, source, blocks[0].data.code);
    // Read from a carrier, it is printed back in one. A Markdown block that
    // reads as itself without one is written bare unless a neighbour needs it.
    context.carried?.add(carried);
    if (source === 'markdown' && readsAsItself(carried.data.raw)) context.lose('form_normalized', 'a :::preserved carrier the Markdown block may not need');
    return carried;
  },
};

function parseDirective(lines, index, match, context) {
  const [, colons, name, braces] = match;
  const close = closingDirective(lines, index + 1, colons, name);
  if (close < 0) fail('unclosed directive');
  const read = DIRECTIVES[name];
  if (!read) fail(`directive ${name}`);
  const attributes = parseAttributes(braces);
  const id = attributes.id || context.id();
  if (attributes.id) context.own(attributes.id);
  const expected = ['grid'].includes(name) ? 4 : 3;
  if (colons.length !== expected) context.lose('form_normalized', `${name} fence of ${colons.length}`);
  return { nodes: [read(attributes, lines.slice(index + 1, close), context, id)], end: close + 1 };
}

// ---------------------------------------------------------------------------
// Blocks: printing

const indent = (text, prefix, first = prefix) => text.split('\n').map((line, index) => (line ? (index ? prefix : first) + line : line)).join('\n');

function printBlocks(nodes, path, context) {
  return (nodes || []).map((child, index) => printNode(child, `${path}[${index}]`, context)).filter((text) => text !== null).join('\n\n');
}

function directive(name, pairs, body, context, child) {
  const colons = name === 'grid' ? '::::' : ':::';
  return `${colons}${name}${printAttributes(pairs, context.ids || context.explicit?.has(child.id) ? child.id : null)}\n${body ? `${body}\n` : ''}${colons}`;
}

function fence(code, info = '') {
  const longest = Math.max(2, ...(code.match(/^[ \t]*`{3,}/gmu) || []).map((run) => run.trim().length));
  const marker = '`'.repeat(longest + 1);
  return `${marker}${info}\n${code ? `${code}\n` : ''}${marker}`;
}

function printNode(child, path, context) {
  const lose = (what, at = path) => context.losses.push({ code: 'not_expressible', path: at, what });
  if (!child || typeof child !== 'object') { lose('not a node'); return null; }
  for (const key of ['presentation', 'bindings', 'extensions']) if (child[key] !== undefined) lose(key, `${path}.${key}`);
  const data = child.data || {};
  const parameters = child.props || {};
  const slot = (name) => printBlocks(child.slots?.[name], `${path}.slots.${name}`, context);
  const inline = (content, at, options) => printInline(content, at, context.losses, options);
  switch (child.type) {
    case 'content.paragraph':
      return escapeLineStarts(inline(data.content, `${path}.data.content`));
    case 'content.heading': {
      const level = Number.isInteger(data.level) ? data.level : 2;
      return `${'#'.repeat(level)} ${inline(data.content, `${path}.data.content`, { html: true }).replaceAll('\n', ' ')}`.trimEnd();
    }
    case 'content.divider':
      return '---';
    case 'content.quote':
      return slot('default').split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n');
    case 'content.code': {
      const pairs = [['title', parameters.title], ['numbers', parameters.numbers]];
      const attributes = printAttributes(pairs);
      return fence(data.code || '', `${parameters.lang || ''}${attributes}`);
    }
    case 'content.list':
      return printList(child, path, context);
    case 'content.table': {
      if (parameters.header !== undefined && parameters.header !== 'row') lose(`table header ${parameters.header}`, `${path}.props.header`);
      if (data.caption) lose('table caption', `${path}.data.caption`);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const width = Math.max(1, ...rows.map((row) => row.length));
      const align = Array.isArray(parameters.align) ? parameters.align : [];
      const line = (cells) => `| ${Array.from({ length: width }, (unused, column) => cells[column] ?? '').join(' | ')} |`;
      const printed = rows.map((row, rowIndex) => row.map((cell, column) => inline(cell, `${path}.data.rows[${rowIndex}][${column}]`, { html: true, cell: true }).replaceAll('\n', ' ')));
      const delimiter = Array.from({ length: width }, (unused, column) => ({ center: ':---:', end: '---:' }[align[column]] || '---'));
      return [line(printed[0] || []), line(delimiter), ...printed.slice(1).map(line)].join('\n');
    }
    case 'content.figure': {
      for (const key of ['width', 'height']) if (data[key] !== undefined) lose(`figure ${key}`, `${path}.data.${key}`);
      const image = `![${String(data.alt ?? '').replace(/[\\\]]/gu, '\\$&')}](${data.src})`;
      const pairs = [['ratio', parameters.ratio], ['fit', parameters.fit]];
      if (!pairs.some(([, value]) => value !== undefined) && !data.caption && !context.ids) return image;
      return directive('figure', pairs, [image, data.caption ? escapeLineStarts(inline(data.caption, `${path}.data.caption`)) : null].filter(Boolean).join('\n\n'), context, child);
    }
    case 'content.alert': {
      const title = Array.isArray(data.title) && data.title.length ? `#### ${inline(data.title, `${path}.data.title`, { html: true }).replaceAll('\n', ' ')}` : null;
      if (!title) context.losses.push({ code: 'docara_alert_title_required', path: `${path}.data.title`, what: 'Docara requires an alert title; none is written' });
      return directive('alert', [['type', ALERT_TYPE[parameters.status ?? 'neutral']], ['variant', parameters.appearance]], [title, slot('default')].filter(Boolean).join('\n\n'), context, child);
    }
    case 'content.details':
      return directive('details', [['open', parameters.open], ['layout', parameters.layout]], [`## ${inline(data.summary, `${path}.data.summary`, { html: true }).replaceAll('\n', ' ')}`, slot('default')].filter(Boolean).join('\n\n'), context, child);
    case 'content.steps': {
      const steps = (child.slots?.steps || []).map((step, index) => ({ ...step, type: 'content.list-item', data: { content: step.data?.title || [] } }));
      steps.forEach((step, index) => { if (child.slots.steps[index]?.type !== 'content.step') lose('steps holds only steps', `${path}.slots.steps[${index}]`); });
      return directive('steps', [['current', parameters.current], ['layout', parameters.layout]], printList({ ...child, props: { ordered: true }, slots: { items: steps } }, path, context, 'steps'), context, child);
    }
    case 'content.tabs': {
      if (data.label !== undefined) lose('tabs label', `${path}.data.label`);
      const body = (child.slots?.tabs || []).map((tab, index) => {
        const at = `${path}.slots.tabs[${index}]`;
        const content = printBlocks(tab.slots?.default, `${at}.slots.default`, context);
        return [`### ${escapeText(String(tab.data?.label ?? ''))}`, content].filter(Boolean).join('\n\n');
      }).join('\n\n');
      return directive('tabs', [], body, context, child);
    }
    case 'content.card':
      return directive('card', [['variant', parameters.variant]], slot('default'), context, child);
    case 'content.grid': {
      // Docara writes the cards of a grid one after another, with no blank line.
      const cells = (child.slots?.default || []).map((cell, index) => printNode(cell, `${path}.slots.default[${index}]`, context)).filter((text) => text !== null);
      const together = (child.slots?.default || []).every((cell) => cell?.type === 'content.card');
      return directive('grid', [['columns', parameters.columns], ['gap', parameters.gap]], cells.join(together ? '\n' : '\n\n'), context, child);
    }
    case 'content.diagram':
      if (parameters.engine !== undefined && parameters.engine !== 'mermaid') lose(`diagram engine ${parameters.engine}`, `${path}.props.engine`);
      return directive('diagram', [['title', parameters.title]], data.source || '', context, child);
    case 'content.math':
      return directive('math', [['label', parameters.label]], data.source || '', context, child);
    case 'content.html':
      return directive('html', [], fence(data.markup || '', 'html'), context, child);
    case 'content.foreign': {
      if (context.mismatched.has(path)) {
        context.losses.push({ code: 'foreign_hash_mismatch', path: `${path}.data.hash`, what: 'the hash does not match raw; the block is not written' });
        return null;
      }
      const raw = String(data.raw ?? '');
      // Markdown reads every line end as LF; a CR inside raw is reported.
      if (raw.includes('\r') && !context.reading) lose('a carriage return in a foreign block: Markdown line ends are LF', `${path}.data.raw`);
      // A foreign Markdown block is written as it came only while it reads
      // back as itself, alone and beside its neighbours; otherwise, and for
      // every other source, it goes in the :::preserved carrier, a fenced block
      // nothing next to it can join.
      if (data.source === 'markdown' && !context.carried?.has(child) && readsAsItself(raw)) return raw;
      if (!context.reading) lose(`foreign ${data.source} block, written in a :::preserved carrier`);
      return directive('preserved', [['source', data.source]], fence(raw, { editorjs: 'json', html: 'html', markdown: 'markdown' }[data.source] || ''), context, child);
    }
    default:
      lose(`type ${child.type}`);
      return null;
  }
}

function printList(list, path, context, slotName = 'items') {
  const ordered = list.props?.ordered === true;
  let number = Number.isInteger(list.props?.start) ? list.props.start : 1;
  const out = [];
  const items = list.slots?.items || [];
  items.forEach((item, index) => {
    const at = `${path}.slots.${slotName}[${index}]`;
    if (item?.type !== 'content.list-item') { context.losses.push({ code: 'not_expressible', path: at, what: `type ${item?.type} in a list` }); return; }
    const marker = ordered ? `${number}.` : '-';
    number += 1;
    const width = marker.length + 1;
    const lead = escapeLineStarts(printInline(item.data?.content, slotName === 'steps' ? `${at}.data.title` : `${at}.data.content`, context.losses));
    let text = `${marker}${lead ? ` ${indent(lead, ' '.repeat(width), '')}` : ''}`;
    (item.slots?.default || []).forEach((child, childIndex) => {
      const printed = printNode(child, `${at}.slots.default[${childIndex}]`, context);
      if (printed === null) return;
      text += `${child.type === 'content.list' && lead ? '\n' : '\n\n'}${indent(printed, ' '.repeat(width))}`;
    });
    out.push(text);
  });
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// The two calls

function readContext(prefix) {
  let counter = 0;
  const owned = new Set();
  const explicit = new Set();
  const losses = [];
  return {
    losses,
    explicit,
    carried: new Set(),
    path: '$',
    id: () => { let id; do { counter += 1; id = `${prefix}${counter}`; } while (owned.has(id)); owned.add(id); return id; },
    own: (id) => { if (owned.has(id) || !ID.test(id)) fail('id'); owned.add(id); explicit.add(id); },
    lose(code, what) { losses.push({ code, path: this.path, what }); },
  };
}

function printContext(options = {}) {
  return { losses: [], ids: options.ids === true, explicit: options.explicit, mismatched: options.mismatched || new Map(), carried: options.carried };
}

/**
 * Markdown to a structured-content Document. Each block the model cannot hold
 * exactly is kept as content.foreign with its source text; a spelling the
 * printer writes otherwise is reported as form_normalized.
 */
export async function fromMarkdown(markdown, { id = 'markdown' } = {}) {
  const { nodes, losses } = readMarkdown(typeof markdown === 'string' ? markdown : '');
  const root = { id: 'root', type: 'content.document', ...(nodes.length ? { slots: { default: nodes } } : {}) };
  await settleHashes(root);
  return { value: { schema: 'simai.composition.document', schema_version: 1, id, profile: 'structured-content', root }, losses };
}

// The blocks of a Markdown text and what reading them lost; every block is
// printed and read back, and kept as content.foreign when that differs.
function readMarkdown(source) {
  let text = source;
  const context = readContext('m');
  if (text.includes('\r')) { text = text.replace(/\r\n?/gu, '\n'); context.lose('form_normalized', 'line endings'); }
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const nodes = [];
  let index = 0;
  let separatorOk = true;
  while (index < lines.length) {
    let blank = 0;
    while (index < lines.length && BLANK.test(lines[index])) { index += 1; blank += 1; }
    if (index >= lines.length) { if (blank) separatorOk = false; break; }
    if ((nodes.length && blank !== 1) || (!nodes.length && blank)) separatorOk = false;
    const end = blockEnd(lines, index);
    const raw = lines.slice(index, end).join('\n');
    const path = `$.root.slots.default[${nodes.length}]`;
    context.path = path;
    const mark = context.losses.length;
    let unit;
    try {
      unit = parseBlocks(lines.slice(index, end), context);
      const check = { ...printContext({ explicit: context.explicit, carried: context.carried }), reading: true };
      const again = printBlocks(unit, path, check);
      const back = parseBlocks(again.split('\n'), readContext('check'));
      if (check.losses.some(({ code }) => code === 'not_expressible') || stable(withoutIds(back)) !== stable(withoutIds(unit))) fail('the printed form reads back otherwise');
      if (again !== raw && context.losses.length === mark) context.losses.push({ code: 'form_normalized', path, what: 'Markdown form' });
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
      context.losses.length = mark;
      unit = [foreignNode(context.id(), 'markdown', raw)];
      context.losses.push({ code: 'not_expressible', path, what: `kept as content.foreign: ${error.message}` });
    }
    nodes.push(...unit);
    index = end;
  }
  if (!separatorOk || (lines.length && text.length && !text.endsWith('\n'))) context.losses.push({ code: 'form_normalized', path: '$', what: 'blank lines between blocks' });
  return { nodes, losses: context.losses };
}

// True when raw, read alone, is one foreign Markdown block of the same bytes.
const ITSELF = new Map();
function readsAsItself(raw) {
  if (!ITSELF.has(raw)) {
    let itself = false;
    if (raw && !raw.includes('\r') && !BLANK.test(raw.split('\n')[0]) && !BLANK.test(raw.split('\n').at(-1))) {
      const { nodes } = readMarkdown(raw);
      itself = nodes.length === 1 && nodes[0].type === 'content.foreign' && nodes[0].data.source === 'markdown' && nodes[0].data.raw === raw;
    }
    if (ITSELF.size > 500) ITSELF.clear();
    ITSELF.set(raw, itself);
  }
  return ITSELF.get(raw);
}

// The foreign Markdown nodes of a subtree.
function foreignMarkdown(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.type === 'content.foreign' && node.data?.source === 'markdown') found.push(node);
  for (const children of Object.values(node.slots || {})) if (Array.isArray(children)) for (const child of children) foreignMarkdown(child, found);
  return found;
}

/**
 * A Document (or one node, a single text area) to Markdown. options.ids
 * writes node ids on directive blocks ({#id}); ids of other blocks are always
 * reported as not expressible.
 */
export async function toMarkdown(document, options = {}) {
  const root = document?.root ?? document;
  const nodes = root?.type === 'content.document' ? root.slots?.default || [] : root ? [root] : [];
  const single = root?.type !== 'content.document';
  const pathOf = (index) => (single ? '$.root' : `$.root.slots.default[${index}]`);
  const mismatched = new Map();
  for (const [index, child] of nodes.entries()) await mismatchedForeign(child, pathOf(index), mismatched);
  // Foreign Markdown blocks that must go in the carrier because, written as
  // they came, they would join a neighbour.
  const carried = new Set();
  const expected = stable(withoutIds(normalizedTree(nodes.filter((child, index) => !mismatched.has(pathOf(index))))));
  for (let attempt = 0; ; attempt += 1) {
    const result = printDocument(root, nodes, pathOf, { ...options, mismatched, carried });
    const back = normalizedTree(readMarkdown(result.value).nodes);
    const written = nodes.filter((child, index) => !mismatched.has(pathOf(index)));
    if (stable(withoutIds(back)) === expected) return result;
    // The first block that reads back otherwise, and whether a foreign
    // Markdown block next to it can be carried instead. A block with a loss
    // of its own reads back otherwise by that loss; it only has to stay one
    // block of its type.
    const reported = (index) => { const path = pathOf(nodes.indexOf(written[index])); return result.losses.some((loss) => loss.path === path || loss.path.startsWith(`${path}.`)); };
    let first = 0;
    while (first < written.length && first < back.length && (stable(withoutIds(normalizedTree([written[first]]))) === stable(withoutIds([back[first]])) || (reported(first) && back[first].type === written[first].type))) first += 1;
    if (first >= written.length && back.length === written.length) return result;
    const near = written.slice(Math.max(0, first - 1), first + 2).flatMap((child) => foreignMarkdown(child)).filter((child) => !carried.has(child));
    if (near.length && attempt < 100) { for (const child of near) carried.add(child); continue; }
    // Report what reads back otherwise, unless a loss there already says so.
    const at = nodes.indexOf(written[Math.min(first, written.length - 1)]);
    const path = pathOf(Math.max(0, at));
    if (!result.losses.some((loss) => loss.path !== '$' && (loss.path === path || loss.path.startsWith(`${path}.`)))) {
      result.losses.push({ code: 'not_expressible', path, what: 'the written Markdown reads back otherwise from this block on' });
    }
    return result;
  }
}

function printDocument(root, nodes, pathOf, options) {
  const context = printContext(options);
  if (root?.type === 'content.document' && root.data?.title !== undefined) context.losses.push({ code: 'not_expressible', path: '$.root.data.title', what: 'document title' });
  const blocks = [];
  nodes.forEach((child, index) => {
    const path = pathOf(index);
    const mark = context.losses.length;
    const printed = printNode(child, path, context);
    if (printed === null) return;
    // A block that reads back otherwise is reported, never dropped.
    if (context.losses.length === mark && child.type !== 'content.foreign') {
      try {
        const back = parseBlocks(printed.split('\n'), readContext('check'));
        if (stable(withoutIds(back)) !== stable(withoutIds(normalizedTree([child])))) context.losses.push({ code: 'not_expressible', path, what: 'Markdown reads this block back otherwise' });
      } catch (error) {
        if (!(error instanceof Unsupported)) throw error;
        context.losses.push({ code: 'not_expressible', path, what: `Markdown cannot read this block back: ${error.message}` });
      }
    }
    // Two lists of one kind in a row read back as one list.
    const before = nodes[index - 1];
    if (child.type === 'content.list' && before?.type === 'content.list' && (child.props?.ordered === true) === (before.props?.ordered === true)) {
      context.losses.push({ code: 'not_expressible', path, what: 'a list right after a list of its kind reads back as one list' });
    }
    blocks.push(printed);
  });
  if (blocks.length) context.losses.unshift({ code: 'not_expressible', path: '$', what: options.ids === true ? 'ids of blocks without a directive' : 'block ids' });
  return { value: blocks.length ? `${blocks.join('\n\n')}\n` : '', losses: context.losses };
}

export default { fromMarkdown, toMarkdown };
