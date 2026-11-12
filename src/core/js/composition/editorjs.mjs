// Editor.js and the Composition model (2026-11-10 composition review, F2.4):
// an import/export adapter, not a native format. Editor.js keeps a flat list
// of blocks with HTML in strings; the Document keeps a tree with inline JSON.
//
//   fromEditorJs(output, {id})   -> Promise<{value: Document, losses}>
//   toEditorJs(document)         -> Promise<{value: {blocks}, losses}>
//
// Standard tools map to content types: paragraph, header, list (2.x),
// quote, code, delimiter, table, image, warning, raw. A Document node goes to
// a standard tool only when that tool brings it back unchanged, ids
// included; otherwise it goes to the tool `sf-<type>` (type without
// `content.`) whose data is the node, so SIMAI -> Editor.js -> SIMAI is equal
// including ids. Any other Editor.js block is kept as content.foreign
// {source: editorjs, raw: the block as JSON}, and comes back as the same
// value. A foreign block of another source goes out in the tool `sf-foreign`.
// Losses are {code, path, what}, as in markdown.mjs: not_expressible,
// form_normalized, foreign_hash_mismatch.
//
// Inline HTML in a block's text: b/strong, i/em, s/strike/del, code, a[href],
// br, and the entities &amp; &lt; &gt; &quot; &#39; &nbsp; and numeric ones;
// the adapter writes b, i, s, code class="inline-code", a href, br. Another
// tag keeps its text and is reported.

import { breakSegment, fromSegments, normalizeInline, safeHref, toSegments } from './inline-model.mjs';
import { foreignNode, mismatchedForeign, settleHashes, stable } from './foreign.mjs';

class Unsupported extends Error {}
const fail = (what) => { throw new Unsupported(what); };
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sameKeys = (value, keys) => isObject(value) && Object.keys(value).every((key) => keys.includes(key));

// ---------------------------------------------------------------------------
// Inline HTML

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const TAG_MARKS = { b: 'strong', strong: 'strong', i: 'em', em: 'em', s: 'strike', strike: 'strike', del: 'strike', code: 'code' };

function decode(text) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z0-9#]{2,8});/giu, (whole, name) => {
    if (/^#x/iu.test(name)) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (/^#\d/u.test(name) && name !== '#39') return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function readInline(html, path, losses) {
  const segments = [];
  const stack = [];
  let href = null;
  const marks = () => stack.filter((entry) => entry.mark).map((entry) => entry.mark);
  const pattern = /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/giu;
  let at = 0;
  const text = (value) => { if (value) segments.push({ text: decode(value), marks: marks(), href }); };
  for (const match of String(html ?? '').matchAll(pattern)) {
    text(html.slice(at, match.index).replace(/[<>]/gu, (char) => { losses.push({ code: 'not_expressible', path, what: `bare ${char}` }); return char; }));
    at = match.index + match[0].length;
    const [, closing, rawName, attributes] = match;
    const name = rawName.toLowerCase();
    if (name === 'br') { segments.push(breakSegment(marks(), href)); continue; }
    if (closing) {
      const index = stack.map((entry) => entry.name).lastIndexOf(name);
      if (index < 0) { losses.push({ code: 'not_expressible', path, what: `</${name}>` }); continue; }
      const [entry] = stack.splice(index, 1);
      if (entry.link) href = null;
      continue;
    }
    if (name === 'a') {
      const target = /\shref="([^"]*)"/iu.exec(attributes);
      const value = target ? decode(target[1]) : null;
      if (value && safeHref(value) && href === null) { href = value; stack.push({ name, link: true }); continue; }
      losses.push({ code: 'not_expressible', path, what: 'a link without a safe address' });
      stack.push({ name });
      continue;
    }
    if (TAG_MARKS[name]) { stack.push({ name, mark: TAG_MARKS[name] }); continue; }
    losses.push({ code: 'not_expressible', path, what: `<${name}>` });
    stack.push({ name });
  }
  text(String(html ?? '').slice(at));
  return fromSegments(segments);
}

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(' ', '&nbsp;');
const OPEN = { strike: '<s>', strong: '<b>', em: '<i>', code: '<code class="inline-code">' };
const CLOSE = { strike: '</s>', strong: '</b>', em: '</i>', code: '</code>' };
const ORDER = ['strike', 'strong', 'em', 'code'];

function writeInline(content, path, losses) {
  const segments = toSegments(normalizeInline(Array.isArray(content) ? content : []));
  let out = '';
  let stack = [];
  let link = null;
  const closeTo = (keep) => {
    const index = stack.findIndex((name) => !keep.includes(name));
    if (index < 0) return;
    for (const name of stack.slice(index).reverse()) out += CLOSE[name];
    stack = stack.slice(0, index);
  };
  segments.forEach((segment, index) => {
    const href = segment.node ? null : segment.href;
    if (href !== link) {
      closeTo([]);
      if (link !== null) out += '</a>';
      if (href !== null) out += `<a href="${escapeHtml(href).replaceAll('"', '&quot;')}">`;
      link = href;
    }
    if (segment.node) {
      losses.push({ code: 'not_expressible', path: `${path}[${index}]`, what: segment.node.type === 'component' ? `inline component ${segment.node.name}` : `inline ${segment.node.type}` });
      return;
    }
    const known = segment.marks.filter((name) => ORDER.includes(name));
    for (const name of segment.marks) if (!known.includes(name)) losses.push({ code: 'not_expressible', path: `${path}[${index}]`, what: `mark ${name}` });
    closeTo(known);
    for (const name of ORDER) if (known.includes(name) && !stack.includes(name)) { out += OPEN[name]; stack.push(name); }
    out += segment.break ? '<br>' : escapeHtml(segment.text);
  });
  closeTo([]);
  if (link !== null) out += '</a>';
  return out;
}

// ---------------------------------------------------------------------------
// Blocks

function ids(blockId) {
  let counter = 0;
  return () => { counter += 1; return `${blockId}-${counter}`; };
}

function readBlock(block, id, path, losses) {
  const data = isObject(block.data) ? block.data : fail('data');
  const next = ids(id);
  const inline = (html, at) => readInline(html, `${path}.data.${at}`, losses);
  switch (block.type) {
    case 'paragraph':
      if (!sameKeys(data, ['text'])) fail('paragraph data');
      return { id, type: 'content.paragraph', data: { content: inline(data.text, 'text') } };
    case 'header':
      if (!sameKeys(data, ['text', 'level']) || !Number.isInteger(data.level) || data.level < 1 || data.level > 6) fail('header data');
      return { id, type: 'content.heading', data: { level: data.level, content: inline(data.text, 'text') } };
    case 'list': {
      if (!sameKeys(data, ['style', 'meta', 'items']) || !['ordered', 'unordered'].includes(data.style) || !Array.isArray(data.items)) fail('list data');
      const ordered = data.style === 'ordered';
      if (ordered ? !sameKeys(data.meta ?? {}, ['start', 'counterType']) || (data.meta?.counterType ?? 'numeric') !== 'numeric' : !sameKeys(data.meta ?? {}, [])) fail('list meta');
      const start = ordered ? data.meta?.start ?? 1 : 1;
      if (!Number.isInteger(start) || start < 1) fail('list start');
      const list = (items, style, first) => ({
        id: next(),
        type: 'content.list',
        ...(style === 'ordered' ? { props: first > 1 ? { ordered: true, start: first } : { ordered: true } } : {}),
        slots: { items: items.map((item, index) => {
          // List 1.x keeps items as strings; 2.x as {content, meta, items}.
          const entry = typeof item === 'string' ? { content: item, meta: {}, items: [] } : item;
          if (!sameKeys(entry, ['content', 'meta', 'items']) || !sameKeys(entry.meta ?? {}, []) || !Array.isArray(entry.items ?? [])) fail('list item');
          const node = { id: next(), type: 'content.list-item', data: { content: inline(entry.content, `items[${index}].content`) } };
          if (entry.items?.length) node.slots = { default: [list(entry.items, style, 1)] };
          return node;
        }) },
      });
      const result = list(data.items, data.style, start);
      result.id = id;
      return result;
    }
    case 'quote':
      if (!sameKeys(data, ['text', 'caption', 'alignment']) || (data.caption ?? '') !== '' || (data.alignment ?? 'left') !== 'left') fail('quote data');
      return { id, type: 'content.quote', slots: { default: [{ id: next(), type: 'content.paragraph', data: { content: inline(data.text, 'text') } }] } };
    case 'code':
      if (!sameKeys(data, ['code']) || typeof data.code !== 'string') fail('code data');
      return { id, type: 'content.code', data: { code: data.code } };
    case 'delimiter':
      if (!sameKeys(data, [])) fail('delimiter data');
      return { id, type: 'content.divider' };
    case 'table': {
      if (!sameKeys(data, ['withHeadings', 'stretched', 'content']) || data.stretched === true || !Array.isArray(data.content) || !data.content.length) fail('table data');
      return {
        id,
        type: 'content.table',
        ...(data.withHeadings === true ? {} : { props: { header: 'none' } }),
        data: { rows: data.content.map((row, rowIndex) => (Array.isArray(row) ? row : fail('table row')).map((cell, column) => inline(cell, `content[${rowIndex}][${column}]`))) },
      };
    }
    case 'image': {
      if (!sameKeys(data, ['file', 'caption', 'withBorder', 'stretched', 'withBackground']) || !sameKeys(data.file, ['url']) || typeof data.file.url !== 'string' || !safeHref(data.file.url)) fail('image data');
      if (data.withBorder === true || data.stretched === true || data.withBackground === true) fail('image look');
      const caption = data.caption ? inline(data.caption, 'caption') : null;
      return { id, type: 'content.figure', data: { src: data.file.url, alt: '', ...(caption?.length ? { caption } : {}) } };
    }
    case 'warning': {
      if (!sameKeys(data, ['title', 'message'])) fail('warning data');
      const title = inline(data.title, 'title');
      return { id, type: 'content.alert', props: { status: 'warning' }, ...(title.length ? { data: { title } } : {}), slots: { default: [{ id: next(), type: 'content.paragraph', data: { content: inline(data.message, 'message') } }] } };
    }
    case 'raw':
      if (!sameKeys(data, ['html']) || typeof data.html !== 'string') fail('raw data');
      return { id, type: 'content.html', data: { markup: data.html } };
    default:
      if (/^sf-[a-z][a-z0-9-]*$/u.test(block.type) && data.type === `content.${block.type.slice(3)}`) return { id, ...data };
      fail(`tool ${block.type}`);
  }
}

function standardBlock(node, losses, path) {
  const data = node.data || {};
  const text = (content, at) => writeInline(content, `${path}.data.${at}`, losses);
  const only = (keys) => Object.keys(node).every((key) => ['id', 'type', ...keys].includes(key));
  switch (node.type) {
    case 'content.paragraph':
      return only(['data']) ? { type: 'paragraph', data: { text: text(data.content, 'content') } } : null;
    case 'content.heading':
      return only(['data']) ? { type: 'header', data: { text: text(data.content, 'content'), level: data.level ?? 2 } } : null;
    case 'content.list': {
      const item = (entry, index, at) => ({ content: writeInline(entry.data?.content, `${at}.slots.items[${index}].data.content`, losses), meta: {}, items: (entry.slots?.default?.[0]?.slots?.items || []).map((child, childIndex) => item(child, childIndex, `${at}.slots.items[${index}].slots.default[0]`)) });
      const ordered = node.props?.ordered === true;
      return { type: 'list', data: { style: ordered ? 'ordered' : 'unordered', meta: ordered ? { start: node.props?.start ?? 1, counterType: 'numeric' } : {}, items: (node.slots?.items || []).map((entry, index) => item(entry, index, path)) } };
    }
    case 'content.quote':
      return { type: 'quote', data: { text: text(node.slots?.default?.[0]?.data?.content, 'content'), caption: '', alignment: 'left' } };
    case 'content.code':
      return only(['data']) ? { type: 'code', data: { code: data.code } } : null;
    case 'content.divider':
      return only([]) ? { type: 'delimiter', data: {} } : null;
    case 'content.table':
      return { type: 'table', data: { withHeadings: (node.props?.header ?? 'row') === 'row', stretched: false, content: (data.rows || []).map((row, rowIndex) => row.map((cell, column) => writeInline(cell, `${path}.data.rows[${rowIndex}][${column}]`, losses))) } };
    case 'content.figure':
      return { type: 'image', data: { file: { url: data.src }, caption: data.caption ? text(data.caption, 'caption') : '', withBorder: false, stretched: false, withBackground: false } };
    case 'content.alert':
      return { type: 'warning', data: { title: text(data.title, 'title'), message: writeInline(node.slots?.default?.[0]?.data?.content, `${path}.slots.default[0].data.content`, losses) } };
    case 'content.html':
      return only(['data']) ? { type: 'raw', data: { html: data.markup } } : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// The two calls

/** Editor.js output ({blocks}, as editor.save() gives it) to a Document. */
export async function fromEditorJs(output, { id = 'editorjs' } = {}) {
  const losses = [];
  const blocks = Array.isArray(output?.blocks) ? output.blocks : [];
  for (const key of Object.keys(isObject(output) ? output : {})) if (key !== 'blocks') losses.push({ code: 'not_expressible', path: `$.${key}`, what: `Editor.js ${key}` });
  const seen = new Set();
  const nodes = blocks.map((block, index) => {
    const path = `$.root.slots.default[${index}]`;
    let nodeId = isObject(block) && typeof block.id === 'string' && ID.test(block.id) && !seen.has(block.id) ? block.id : null;
    if (!nodeId) {
      nodeId = `e${index + 1}`;
      while (seen.has(nodeId)) nodeId = `${nodeId}x`;
      if (isObject(block) && block.id !== undefined) losses.push({ code: 'not_expressible', path: `${path}.id`, what: 'Editor.js block id that is not a node id' });
    }
    seen.add(nodeId);
    const mark = losses.length;
    try {
      if (!sameKeys(block, ['id', 'type', 'data'])) fail('block keys');
      const node = readBlock(block, nodeId, path, losses);
      if (losses.length > mark) return node;
      // The block must come back as it came, or it is kept as it is.
      const back = toBlock(node, [], path);
      if (stable(back) !== stable(block)) {
        const again = readBlock(back, nodeId, path, []);
        if (stable(again) !== stable(node)) fail('reads back otherwise');
        losses.push({ code: 'form_normalized', path, what: 'Editor.js form' });
      }
      return node;
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
      losses.length = mark;
      return foreignNode(nodeId, 'editorjs', JSON.stringify(block));
    }
  });
  const root = { id: 'root', type: 'content.document', ...(nodes.length ? { slots: { default: nodes } } : {}) };
  await settleHashes(root);
  return { value: { schema: 'simai.composition.document', schema_version: 1, id, profile: 'structured-content', root }, losses };
}

function toBlock(node, losses, path) {
  if (node.type === 'content.foreign') {
    losses.push({ code: 'not_expressible', path, what: `foreign ${node.data?.source} block, written in the tool sf-foreign` });
  }
  const scratch = [];
  const standard = standardBlock(node, scratch, path);
  if (standard) {
    const block = { id: node.id, ...standard };
    let again = null;
    try { again = readBlock(block, node.id, path, []); } catch (error) { if (!(error instanceof Unsupported)) throw error; }
    if (again && stable(again) === stable(node) && !scratch.length) return block;
  }
  const { id, ...rest } = node;
  return { id, type: `sf-${node.type.replace(/^content\./u, '')}`, data: rest };
}

/** A Document (or one node) to Editor.js output {blocks}. */
export async function toEditorJs(document) {
  const losses = [];
  const root = document?.root ?? document;
  const nodes = root?.type === 'content.document' ? root.slots?.default || [] : root ? [root] : [];
  const blocks = [];
  for (const [index, node] of nodes.entries()) {
    const path = root?.type === 'content.document' ? `$.root.slots.default[${index}]` : '$.root';
    if (!isObject(node) || typeof node.type !== 'string' || !node.type.startsWith('content.')) {
      losses.push({ code: 'not_expressible', path, what: `type ${node?.type}` });
      continue;
    }
    const mismatched = await mismatchedForeign(node, path);
    if (mismatched.size) {
      for (const at of mismatched.keys()) losses.push({ code: 'foreign_hash_mismatch', path: `${at}.data.hash`, what: 'the hash does not match raw; the block is not written' });
      continue;
    }
    if (node.type === 'content.foreign' && node.data?.source === 'editorjs') {
      let block = null;
      try { block = JSON.parse(node.data.raw); } catch { /* carried below */ }
      // The block goes out as it came when it brings its node id back;
      // otherwise the node goes in the carrier, so the id is kept.
      const comesBack = isObject(block) && (block.id === undefined ? node.id === `e${blocks.length + 1}` : block.id === node.id);
      if (comesBack) { blocks.push(block); continue; }
      const { id, ...rest } = node;
      blocks.push({ id, type: 'sf-foreign', data: rest });
      continue;
    }
    blocks.push(toBlock(node, losses, path));
  }
  return { value: { blocks }, losses };
}

export default { fromEditorJs, toEditorJs };
