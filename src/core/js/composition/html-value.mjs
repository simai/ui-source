// html@1 values and the Composition model (inline model 1.2.0, 2026-11-10).
//
// An html@1 value (the subset of html-subset.mjs: p h2 h3 h4 strong em a[href]
// ul ol li blockquote br) maps to a structured-content Document and back:
//
//   p                 content.paragraph
//   h2, h3, h4        content.heading, level 2..4
//   ul, ol            content.list (ordered for ol) of content.list-item
//   li                its first line is the item's content; a nested list and
//                     any later line are blocks of the item's default slot
//   blockquote        content.quote
//   strong, em        the marks strong and em
//   a[href]           a link
//   br                a break, with the marks and link of its place
//
// The model never removes a break; the value projection applies the html@1
// edge rule (value mode of the cleaner, idempotent since 2026-11-10), so for
// every valid stored value v, toHtml(fromHtml(v).value).value
// === v. What html@1 cannot hold (other types, the marks code and strike,
// atoms, headings of level 1, 5 and 6) is reported as the loss
// not_expressible, never dropped silently. Each call returns
// {value, losses: [{code, path, what}]}.
//
// No DOM: the string is read by the subset's own reader (parseHtml), so a
// server or a test gets the same Document as the browser.

import { cleanTree, parseHtml, sanitizeRichText, serialize } from './html-subset.mjs';
import { breakSegment, fromSegments, toSegments } from './inline-model.mjs';

const BREAK = (strong, em, href) => ({ kind: 'br', strong, em, href });

function inlineFromLeaves(leaves) {
  return fromSegments(leaves.map((leaf) => {
    const marks = [...(leaf.strong ? ['strong'] : []), ...(leaf.em ? ['em'] : [])];
    return leaf.kind === 'br' ? breakSegment(marks, leaf.href || null) : { text: leaf.value, marks, href: leaf.href || null };
  }));
}

/**
 * An html@1 value to a structured-content Document. The value is cleaned
 * first (value mode), so any string is accepted; options.id names the
 * Document (default "html"), and block ids are made in order (b1, b2, ...).
 */
export function fromHtml(html, { id = 'html' } = {}) {
  const blocks = cleanTree(parseHtml(typeof html === 'string' ? html : ''), { mode: 'value' });
  let counter = 0;
  const next = () => `b${(counter += 1)}`;
  const item = (entry) => {
    const [first, ...rest] = entry.children;
    const lead = first?.type === 'inline' ? first : null;
    const children = (lead ? rest : entry.children).map((part) => (part.type === 'inline'
      ? { id: next(), type: 'content.paragraph', data: { content: inlineFromLeaves(part.leaves) } }
      : list(part)));
    return { id: next(), type: 'content.list-item', data: { content: lead ? inlineFromLeaves(lead.leaves) : [] }, ...(children.length ? { slots: { default: children } } : {}) };
  };
  const list = (block) => {
    const node = { id: next(), type: 'content.list', ...(block.type === 'ol' ? { props: { ordered: true } } : {}) };
    node.slots = { items: block.items.map(item) };
    return node;
  };
  const block = (entry) => {
    if (entry.type === 'blockquote') return { id: next(), type: 'content.quote', slots: { default: entry.blocks.map(block) } };
    if (entry.type === 'ul' || entry.type === 'ol') return list(entry);
    if (entry.type === 'p') return { id: next(), type: 'content.paragraph', data: { content: inlineFromLeaves(entry.leaves) } };
    return { id: next(), type: 'content.heading', data: { level: Number(entry.type.slice(1)), content: inlineFromLeaves(entry.leaves) } };
  };
  const children = blocks.map(block);
  return {
    value: {
      schema: 'simai.composition.document',
      schema_version: 1,
      id,
      profile: 'structured-content',
      root: { id: 'root', type: 'content.document', ...(children.length ? { slots: { default: children } } : {}) },
    },
    losses: [],
  };
}

/** A Document (structured content, or any node tree) to its html@1 value. */
export function toHtml(document) {
  const losses = [];
  const lose = (path, what) => losses.push({ code: 'not_expressible', path, what });
  const leaves = (content, path) => {
    const out = [];
    toSegments(content).forEach((segment, index) => {
      if (segment.node) {
        lose(`${path}[${index}]`, segment.node.type === 'component' ? `inline component ${segment.node.name}` : `inline ${segment.node.type}`);
        return;
      }
      for (const mark of segment.marks) if (mark !== 'strong' && mark !== 'em') lose(`${path}[${index}]`, `mark ${mark}`);
      const strong = segment.marks.includes('strong');
      const em = segment.marks.includes('em');
      out.push(segment.break ? BREAK(strong, em, segment.href) : { kind: 'text', value: segment.text, strong, em, href: segment.href });
    });
    return out;
  };
  const inlineParts = (parts) => {
    // Two lines in a row in an item are one line with a break between them.
    const joined = [];
    for (const part of parts) {
      const last = joined.at(-1);
      if (part.type === 'inline' && last?.type === 'inline') last.leaves = [...last.leaves, BREAK(false, false, null), ...part.leaves];
      else joined.push(part);
    }
    return joined;
  };
  const listOf = (node, path) => ({
    type: node.props?.ordered === true ? 'ol' : 'ul',
    items: (node.slots?.items || []).map((entry, index) => {
      const at = `${path}.slots.items[${index}]`;
      if (entry?.type !== 'content.list-item') {
        lose(at, `type ${entry?.type} in a list`);
        return { children: [] };
      }
      const parts = [{ type: 'inline', leaves: leaves(entry.data?.content, `${at}.data.content`) }];
      (entry.slots?.default || []).forEach((child, childIndex) => {
        const childPath = `${at}.slots.default[${childIndex}]`;
        if (child?.type === 'content.paragraph') parts.push({ type: 'inline', leaves: leaves(child.data?.content, `${childPath}.data.content`) });
        else if (child?.type === 'content.list') parts.push(listOf(child, childPath));
        else lose(childPath, `type ${child?.type}`);
      });
      return { children: inlineParts(parts.filter((part) => part.type !== 'inline' || part.leaves.length)) };
    }),
  });
  const blocks = (nodes, path) => (nodes || []).flatMap((node, index) => {
    const at = `${path}[${index}]`;
    switch (node?.type) {
      case 'content.paragraph':
        return [{ type: 'p', leaves: leaves(node.data?.content, `${at}.data.content`) }];
      case 'content.heading': {
        const level = Number.isInteger(node.data?.level) ? node.data.level : 2;
        if (level < 2 || level > 4) lose(`${at}.data.level`, `heading level ${level}`);
        return [{ type: `h${Math.min(4, Math.max(2, level))}`, leaves: leaves(node.data?.content, `${at}.data.content`) }];
      }
      case 'content.list':
        return [listOf(node, at)];
      case 'content.quote':
        return [{ type: 'blockquote', blocks: blocks(node.slots?.default, `${at}.slots.default`) }];
      default:
        lose(at, `type ${node?.type}`);
        return [];
    }
  });
  const root = document?.root;
  const top = root?.type === 'content.document' ? blocks(root.slots?.default, '$.root.slots.default') : blocks(root ? [root] : [], '$.root');
  // The value projection: the html@1 edge rule, as the cleaner's value mode.
  return { value: sanitizeRichText(serialize(top), { mode: 'value', document: null }), losses };
}

export default { toHtml, fromHtml };
