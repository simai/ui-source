import { pageText } from '../page-language.js';
import { actionEntry, layoutActionRow, openRowMenu } from '../overflow-row.js';
import { roving } from '../roving.js';
import { defineTagAliases } from '../tag-aliases.js';
import { INLINE_COMPONENTS, INLINE_LIMITS, INLINE_MARKS, INLINE_OBJECT, breakSegment, currentInlineProps, fromSegments, inlineComponentView, inlineExtensions, inlineLength, isInlineComponent, marksIn, normalizeInline, objectAt, replaceRange, safeHref, setLink, sliceInline, toSegments, toggleMark } from './inline-model.mjs';

// In-place editor for the Composition inline content model. The host starts
// it on a rendered heading or paragraph element; the editor exposes only
// normalized content (never HTML) through events. Cancel restores the exact
// original DOM; commit restores it too and lets the host re-render the saved
// value, so the canvas always returns to host-rendered HTML.

// The names sf-editor-inline's component.json declares (standard 1.3.8 §8,
// vocabulary 1.1.5): input while the text changes, change when it is
// committed, cancel when it is put back -- {id, content}, data only. The
// edited element is the host's, which carries no shim, so each event is
// followed here by the name it had under the former tag sf-inline-editor
// (the same detail, until 2027-01-01), then by its former name with its
// former detail ({node_id, content}) until 2026-12-01.
export const INLINE_EVENTS = Object.freeze({
  input: 'sf-editor-inline-input',
  commit: 'sf-editor-inline-change',
  cancel: 'sf-editor-inline-cancel',
});

export const INLINE_EVENTS_FORMER_TAG = Object.freeze({
  input: 'sf-inline-editor-input',
  commit: 'sf-inline-editor-change',
  cancel: 'sf-inline-editor-cancel',
});

export const INLINE_EVENTS_LEGACY = Object.freeze({
  input: 'sf-inline-edit-input',
  commit: 'sf-inline-edit-commit',
  cancel: 'sf-inline-edit-cancel',
});

// next: the text after the caret when Enter starts a new block (enter:
// 'new-block', C172 (2)); the former names' details never carry it.
function emitInline(element, key, id, content, next) {
  const detail = content === undefined ? { id } : next === undefined ? { id, content } : { id, content, next };
  const legacy = content === undefined ? { node_id: id } : { node_id: id, content };
  const frozen = Object.freeze(detail);
  element.dispatchEvent(new globalThis.CustomEvent(INLINE_EVENTS[key], { bubbles: true, composed: true, detail: frozen }));
  element.dispatchEvent(new globalThis.CustomEvent(INLINE_EVENTS_FORMER_TAG[key], { bubbles: true, composed: true, detail: frozen }));
  element.dispatchEvent(new globalThis.CustomEvent(INLINE_EVENTS_LEGACY[key], { bubbles: true, composed: true, detail: Object.freeze(legacy) }));
}

const MESSAGES = {
  ru: { toolbar: 'Форматирование', strong: 'Полужирный', em: 'Курсив', code: 'Код', strike: 'Зачёркнутый', link: 'Ссылка', url: 'Адрес ссылки', apply: 'Применить', unlink: 'Убрать ссылку', editing: '{label}: редактирование. Enter — сохранить, Escape — отменить.', invalid: 'Недопустимый адрес ссылки' },
  en: { toolbar: 'Formatting', strong: 'Bold', em: 'Italic', code: 'Code', strike: 'Strikethrough', link: 'Link', url: 'Link address', apply: 'Apply', unlink: 'Remove link', editing: '{label}: editing. Enter saves, Escape cancels.', invalid: 'Invalid link address' },
};
const SHORTCUTS = { strong: 'b', em: 'i', code: 'e' };
// The marks the toolbar offers when the host names none: strike (inline model
// 1.2.0) is read, kept and drawn, and has a button only where a host asks.
const TOOLBAR_MARKS = Object.freeze(['strong', 'em', 'code']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK', 'IMG', 'SVG', 'OBJECT', 'IFRAME', 'NOSCRIPT']);
const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE', 'BLOCKQUOTE', 'SECTION', 'ARTICLE']);
// While editing, an atom or an opaque node is one element that is not
// editable inside and carries its entry as JSON here, so reading the DOM back,
// and pasting what the editor copied, return the entry exactly.
const NODE_ATTRIBUTE = 'data-sf-inline-node';
const ATOM_TAGS = new Map(Object.entries(INLINE_COMPONENTS).map(([name, entry]) => [entry.tag.toUpperCase(), name]));
const isAtomElement = (node) => node?.nodeType === 1 && node.hasAttribute(NODE_ATTRIBUTE);
// A mark the editor has no element for is drawn as a span carrying its name,
// never as an element of that name, so it survives the DOM read-back.
const MARK_ATTRIBUTE = 'data-sf-inline-mark';
// Editor-copied HTML carries the page's copy token on its wrapper; pasted
// HTML without it loses every data-sf-inline-* attribute first, so another
// page cannot inject entries or marks (2026-11-11 acceptance, L3). The token
// lives on the global, since every bundle carries its own module copy.
const COPY_ATTRIBUTE = 'data-sf-inline-copy';
const COPY_KEY = Symbol.for('simai.composition.inline-copy');
const copyToken = () => {
  if (!globalThis[COPY_KEY]) globalThis[COPY_KEY] = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return globalThis[COPY_KEY];
};
// The extension keys of a text run, a break or a link (inline model,
// 2026-11-11) ride on a wrapper span (or the <a>) as JSON, so the DOM
// read-back keeps them. Foreign paste loses them with the other
// data-sf-inline-* attributes.
const EXTRA_ATTRIBUTE = 'data-sf-inline-extra';
const readExtra = (node) => {
  const json = node?.nodeType === 1 ? node.getAttribute(EXTRA_ATTRIBUTE) : null;
  if (json === null) return null;
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length ? value : null;
  } catch {
    return null;
  }
};
const MARK_TAGS = new Map([['strong', 'strong'], ['em', 'em'], ['code', 'code'], ['strike', 's']]);
// A break the editor drew carries this attribute; any other <br> the browser
// or a paste brings is read as a break too, except the placeholder a browser
// keeps as the last child of an emptied or break-ended line.
const BREAK_ATTRIBUTE = 'data-sf-inline-break';
const isBreakElement = (node) => node?.nodeType === 1 && node.tagName === 'BR' && node.hasAttribute(BREAK_ATTRIBUTE);

/** The entry an atom element holds: its JSON, or for a drawn atom without it, its tag and declared attributes. */
function atomEntry(element) {
  const json = element.getAttribute(NODE_ATTRIBUTE);
  if (json !== null) {
    try {
      const entry = JSON.parse(json);
      // Only atoms and opaque nodes travel this way; text and links are read from the DOM.
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.type === 'string' && entry.type !== 'text' && entry.type !== 'link') return entry;
    } catch { /* not ours: read the element as markup */ }
    return null;
  }
  const name = ATOM_TAGS.get(element.tagName.toUpperCase());
  if (!name) return null;
  const declared = INLINE_COMPONENTS[name].props;
  const props = {};
  if (name === 'kbd') props.text = element.textContent.replace(/\s+/gu, ' ').trim();
  else for (const [key, kind] of Object.entries(declared)) {
    if (!element.hasAttribute(key)) continue;
    props[key] = kind === 'boolean' ? true : element.getAttribute(key);
  }
  // An element read back is written under the current names: a dated alias
  // attribute (sf-badge compact) becomes its new prop (icon-only).
  const current = currentInlineProps(name, props);
  const entry = { type: 'component', name, ...(Object.keys(current).length ? { props: current } : {}) };
  return isInlineComponent(entry) ? entry : null;
}

const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
// The words of sf-editor-inline's language files (lang/<locale>.json,
// runtime), given by its bundle (useInlineEditorWords): the words this module
// does not carry in MESSAGES -- the link window's hint and reasons, «Ещё»,
// the new-block label (owner decision C172) -- live only there.
let shippedWords = null;
export function useInlineEditorWords(lang) {
  shippedWords = lang && typeof lang === 'object' ? lang : null;
}
const dictionary = () => {
  if (!shippedWords) return MESSAGES;
  const merged = {};
  for (const locale of new Set([...Object.keys(MESSAGES), ...Object.keys(shippedWords)])) merged[locale] = { ...(MESSAGES[locale] || {}), ...(shippedWords[locale]?.runtime || {}) };
  return merged;
};
// Words in the page's language through pageText, as every component takes
// them: the editor read <html lang> alone and offered only English or Russian,
// so SF.language.use() and a product's own dictionary never reached it
// (documentation trial, 2026-10-12).
const words = (node) => {
  const all = dictionary();
  return Object.fromEntries(Object.keys(all.en || MESSAGES.en).map((key) => [key, pageText(all, key, node, 'sf-editor-inline')]));
};

/** Reads inline content from any DOM subtree; foreign markup and styles are dropped. */
export function readInlineDom(root, { marks = INLINE_MARKS, links = true, collapse = false } = {}) {
  const segments = [];
  const carry = (extra, linkExtra, href) => ({ ...(extra ? { extra } : {}), ...(href && linkExtra ? { linkExtra } : {}) });
  const visit = (node, active, href, extra = null, linkExtra = null) => {
    if (node.nodeType === 3) {
      let text = node.nodeValue.replace(/\u00a0/gu, ' ').replace(/[\r\n\t\f\v]/gu, ' ');
      if (collapse) text = text.replace(/ {2,}/gu, ' ');
      if (text) segments.push({ text, marks: [...active], href, ...carry(extra, linkExtra, href) });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1 && node !== root) {
      const entry = atomEntry(node);
      if (entry) {
        // An atom is never inside a link, even when pasted inside an <a>.
        segments.push({ text: INLINE_OBJECT, marks: [], href: entry.type === 'component' ? null : href, node: entry, ...(entry.type === 'component' ? {} : carry(null, linkExtra, href)) });
        return;
      }
    }
    if (node.nodeType === 1 && SKIP.has(node.tagName.toUpperCase())) return;
    const tag = node.nodeType === 1 ? node.tagName.toUpperCase() : '';
    const next = new Set(active);
    let nextHref = href;
    if (tag === 'STRONG' || tag === 'B') next.add('strong');
    if (tag === 'EM' || tag === 'I') next.add('em');
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') next.add('code');
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.add('strike');
    // A mark this editor cannot draw rides on its wrapper (renderInlineDom).
    const carried = node.nodeType === 1 ? node.getAttribute(MARK_ATTRIBUTE) : null;
    // Any non-empty name, the inline model's own rule (sortMarks).
    if (carried) next.add(carried);
    if (node.nodeType === 1 && node.style) {
      const weight = node.style.fontWeight;
      if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) next.add('strong');
      if (node.style.fontStyle === 'italic') next.add('em');
    }
    let nextExtra = extra;
    let nextLinkExtra = linkExtra;
    if (tag === 'A' && !href && links) {
      const candidate = node.getAttribute('href');
      if (safeHref(candidate)) {
        nextHref = candidate;
        nextLinkExtra = readExtra(node);
      }
    } else if (node.nodeType === 1 && tag !== 'A') {
      const own = readExtra(node);
      if (own) nextExtra = { ...(extra || {}), ...own };
    }
    if (tag === 'BR') {
      // A line break is a break (inline model 1.2.0), no longer a space. The
      // placeholder <br> a browser leaves as the last child of the edited
      // element (an emptied editor, or the empty line after a final break)
      // is not content; a break the editor drew says so itself.
      if (!node.hasAttribute(BREAK_ATTRIBUTE) && isLastLeaf(node, root)) return;
      segments.push({ ...breakSegment([...active], href, readExtra(node) || extra), ...carry(null, linkExtra, href) });
      return;
    }
    for (const child of node.childNodes) visit(child, next, nextHref, nextExtra, nextLinkExtra);
    // Nested blocks (pasted paragraphs) are separated by one space; the root is not.
    if (BLOCK.has(tag) && node !== root) segments.push({ text: ' ', marks: [], href: null });
  };
  visit(root, new Set(), null);
  // The field's marks limit the known ones; a mark the model does not know is
  // kept as it came, so an edit never drops it (validation still reports it).
  const allowed = new Set(marks);
  const keep = (mark) => allowed.has(mark) || !INLINE_MARKS.includes(mark);
  let content = fromSegments(segments.map((segment) => ({ ...segment, marks: segment.marks.filter(keep), href: links ? segment.href : null })));
  if (collapse) {
    const flat = toSegments(content);
    if (flat.length && !flat[0].node) flat[0] = { ...flat[0], text: flat[0].text.replace(/^ +/u, '') };
    if (flat.length && !flat.at(-1).node) flat[flat.length - 1] = { ...flat.at(-1), text: flat.at(-1).text.replace(/ +$/u, '') };
    content = fromSegments(flat);
  }
  return content;
}

/**
 * Renders inline content with the same element nesting as the Framework
 * renderer. An atom draws its component's element, an opaque node a
 * placeholder; both are not editable inside and carry their entry.
 */
export function renderInlineDom(doc, content) {
  const fragment = doc.createDocumentFragment();
  const object = (entry) => {
    const view = inlineComponentView(entry);
    const element = doc.createElement(view ? view.tag : 'span');
    if (view) {
      for (const [name, value] of view.attributes) element.setAttribute(name, value);
      if (view.text) element.textContent = view.text;
    } else element.textContent = INLINE_OBJECT;
    element.setAttribute('contenteditable', 'false');
    element.setAttribute(NODE_ATTRIBUTE, JSON.stringify(entry));
    return element;
  };
  const run = (entry) => {
    if (entry.type !== 'text' && entry.type !== 'break') return object(entry);
    let node;
    if (entry.type === 'break') {
      node = doc.createElement('br');
      node.setAttribute(BREAK_ATTRIBUTE, '');
    } else node = doc.createTextNode(entry.value);
    for (const mark of entry.marks || []) {
      const wrapper = doc.createElement(MARK_TAGS.get(mark) || 'span');
      if (!MARK_TAGS.has(mark)) wrapper.setAttribute(MARK_ATTRIBUTE, mark);
      wrapper.append(node);
      node = wrapper;
    }
    const extra = inlineExtensions(entry);
    if (extra) {
      const wrapper = doc.createElement('span');
      wrapper.setAttribute(EXTRA_ATTRIBUTE, JSON.stringify(extra));
      wrapper.append(node);
      node = wrapper;
    }
    return node;
  };
  const normalized = normalizeInline(content);
  for (const entry of normalized) {
    if (entry.type === 'link') {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', entry.href);
      const linkExtra = inlineExtensions(entry);
      if (linkExtra) anchor.setAttribute(EXTRA_ATTRIBUTE, JSON.stringify(linkExtra));
      for (const child of entry.children) anchor.append(run(child));
      fragment.append(anchor);
    } else fragment.append(run(entry));
  }
  // A line that ends on a break needs one more <br> to show its empty last
  // line; that one is the placeholder and is not read back.
  const last = normalized.at(-1);
  // It goes inside the marks of that break, so text typed on the new line
  // keeps them, as it would after a break inside a line.
  if (last?.type === 'break' || (last?.type === 'link' && last.children.at(-1)?.type === 'break')) {
    let host = fragment;
    while (host.lastChild?.nodeType === 1 && host.lastChild.tagName !== 'BR') host = host.lastChild;
    host.append(doc.createElement('br'));
  }
  return fragment;
}

// True when node is the last thing inside root: nothing follows it at any level.
function isLastLeaf(node, root) {
  for (let current = node; current && current !== root; current = current.parentNode) if (current.nextSibling) return false;
  return true;
}

// The units of offset inside root, in document order: text nodes outside
// atoms, and atom elements, which hold one unit each.
function units(root) {
  const list = [];
  const visit = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) list.push(child);
      else if (isAtomElement(child) || isBreakElement(child)) list.push(child);
      else if (child.nodeType === 1) visit(child);
    }
  };
  visit(root);
  return list;
}
const unitLength = (unit) => (unit.nodeType === 3 ? unit.nodeValue.length : 1);

/** Offset of a DOM position inside root: characters of text nodes, one per atom. */
export function textOffset(root, container, offset) {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  let total = 0;
  for (const unit of units(root)) {
    if (unit === container) return total + offset;
    // A unit counts once its end is inside [root start, position].
    const [parent, index] = unit.nodeType === 3 ? [unit, unit.nodeValue.length] : [unit.parentNode, [...unit.parentNode.childNodes].indexOf(unit) + 1];
    if (range.comparePoint(parent, index) !== 0) break;
    total += unitLength(unit);
  }
  return total;
}

// The DOM position of an offset: inside a text node where one holds it, else
// beside the atom, so the caret never lands inside one.
function locate(root, offset) {
  let total = 0;
  const list = units(root);
  for (const unit of list) {
    if (unit.nodeType === 3) {
      if (offset <= total + unit.nodeValue.length) return [unit, offset - total];
    } else if (offset <= total) return [unit.parentNode, [...unit.parentNode.childNodes].indexOf(unit)];
    total += unitLength(unit);
  }
  const last = list.at(-1);
  if (!last) return [root, 0];
  return last.nodeType === 3 ? [last, last.nodeValue.length] : [last.parentNode, [...last.parentNode.childNodes].indexOf(last) + 1];
}

/** Selects from anchor to focus (focus may come first: a backward selection). */
function setSelection(root, anchor, focus = anchor) {
  const selection = root.ownerDocument.getSelection();
  const [anchorNode, anchorOffset] = locate(root, anchor);
  const [focusNode, focusOffset] = locate(root, focus);
  selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
}

// When the formatting toolbar shows (owner decision C172 (1), 2026-11-14):
// only while text is selected, over the selection (selection, the default
// since sf-editor-inline 1.9.0), or for the whole edit, over the element
// (session, the default before it, kept for a host that asks for it;
// simai/ui-source#67). On a phone the toolbar is a strip of icons above the
// screen keyboard for the whole edit, whatever the mode (C172 (3)).
export const INLINE_TOOLBAR_MODES = Object.freeze(['selection', 'session']);

// What Enter does (owner decision C172 (2)): save, the default, commits the
// edit; new-block -- a block editor's setting «Enter — новый блок» -- commits
// the text before the caret and gives the text after it as next, for the
// host to make the next block of. Shift+Enter is a line break in both, focus
// leaving saves in both.
export const INLINE_ENTER_MODES = Object.freeze(['save', 'new-block']);

const MARK_ICONS = Object.freeze({ strong: 'format_bold', em: 'format_italic', code: 'code', strike: 'strikethrough_s' });
// The toolbar's rungs: icon buttons 1/2 over the page (C141 (4), C144); on a
// phone the strip's buttons are 2, the touch rung.
const BAR_SIZE = Object.freeze({ float: '1/2', dock: '2' });
// The link window is one small form on one rung (C141 (6)): its field and
// both buttons are 1/2.
const LINK_SIZE = '1/2';
// A row unit that left for «Ещё» (core/js/overflow-row.js, C155).
const OUT = 'sf-inline-editor-out';
// Below the md breakpoint core.css does not declare --sf-breakpoint-md: a
// phone, as sf-input-rich reads it.
const onPhone = (doc) => !doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--sf-breakpoint-md').trim();
const ICON_BUTTON = ['sf-icon-button', 'sf-icon-button--icon', 'sf-icon-button--ghost', 'sf-icon-button--on-surface'];

// Why a link address is refused, as the link window says it under the field
// (owner decision C172 (4)): the word of the reason, which names what to
// change, or null when the address is accepted (safeHref).
export function linkProblem(value) {
  const text = String(value ?? '');
  if (!text) return 'link-empty';
  if (safeHref(text)) return null;
  if (text.length > INLINE_LIMITS.maxHrefLength) return 'link-long';
  if (/\s/u.test(text)) return 'link-spaces';
  if (text.startsWith('//') || text.includes('\\')) return 'link-slashes';
  if (/^[a-z][a-z0-9+.-]*:/iu.test(text)) return 'link-scheme';
  return 'link-start';
}

// The word around an offset (letters, digits, joiners inside a word), as
// [start, end], or null in a space or beside an atom: Ctrl/⌘+K with no
// selection links the word under the caret (C172 (4), IE-3).
export function wordAround(content, offset) {
  const text = toSegments(content).map((segment) => (segment.node || segment.break ? '\u0000' : segment.text)).join('');
  const inWord = (at) => at >= 0 && at < text.length && /[\p{L}\p{N}\p{M}_'’-]/u.test(text[at]);
  let start = offset;
  let end = offset;
  while (inWord(start - 1)) start -= 1;
  while (inWord(end)) end += 1;
  while (start < end && /[-'’_]/u.test(text[start])) start += 1;
  while (end > start && /[-'’_]/u.test(text[end - 1])) end -= 1;
  return start < end ? [start, end] : null;
}

/**
 * Starts in-place editing of a rendered heading or paragraph element.
 * options: {content, nodeId, label, marks, links, messages, toolbar, enter}
 * Returns {commit(), cancel(), value(), element}.
 */
export function startInlineEdit(element, options = {}) {
  if (!(element instanceof globalThis.Element)) throw new TypeError('Inline editing needs an element');
  if (element.hasAttribute('data-sf-inline-editing')) throw new TypeError('inline_edit_active');
  const toolbarMode = options.toolbar ?? 'selection';
  if (!INLINE_TOOLBAR_MODES.includes(toolbarMode)) throw new TypeError(`inline_toolbar_unknown: ${toolbarMode}`);
  const enterMode = options.enter ?? 'save';
  if (!INLINE_ENTER_MODES.includes(enterMode)) throw new TypeError(`inline_enter_unknown: ${enterMode}`);
  const doc = element.ownerDocument;
  const text = { ...words(element), ...(options.messages || {}) };
  // options.marks: the marks the field allows and offers; without it every
  // known mark is kept and the toolbar offers TOOLBAR_MARKS.
  const marks = (options.marks || INLINE_MARKS).filter((mark) => INLINE_MARKS.includes(mark));
  const offered = options.marks ? marks : TOOLBAR_MARKS.filter((mark) => marks.includes(mark));
  const links = options.links !== false;
  const original = { html: element.innerHTML, attributes: ['contenteditable', 'role', 'aria-multiline', 'aria-label', 'spellcheck', 'tabindex'].map((name) => [name, element.getAttribute(name)]) };
  const history = [];
  let historyIndex = -1;
  let composing = false;
  let lastTyping = 0;
  let finished = false;
  const connection = new AbortController();
  const signal = { signal: connection.signal };

  const read = () => readInlineDom(element, { marks, links });
  const selectionOffsets = () => {
    const selection = doc.getSelection();
    if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return [inlineLength(read()), inlineLength(read())];
    const range = selection.getRangeAt(0);
    return [textOffset(element, range.startContainer, range.startOffset), textOffset(element, range.endContainer, range.endOffset)];
  };
  const draw = (content, start, end) => {
    element.replaceChildren(renderInlineDom(doc, content));
    setSelection(element, start, end);
  };
  const snapshot = (merge = false) => {
    const entry = { content: read(), selection: selectionOffsets() };
    if (merge && historyIndex === history.length - 1 && history[historyIndex].typing) history[historyIndex] = { ...entry, typing: true };
    else {
      history.splice(historyIndex + 1);
      history.push({ ...entry, typing: merge });
      historyIndex = history.length - 1;
    }
  };
  const emitInput = () => emitInline(element, 'input', options.nodeId ?? null, read());
  const apply = (content, start, end) => {
    draw(content, start, end);
    snapshot(false);
    emitInput();
    updateToolbar();
  };
  const restore = (index) => {
    historyIndex = index;
    const entry = history[index];
    draw(entry.content, ...entry.selection);
    emitInput();
    updateToolbar();
  };

  // Toolbar ----------------------------------------------------------------
  // One row of icon buttons in groups (owner decisions C141 (4), C144, C172):
  // the marks, a separator, the link; 4 apart inside a group, a 1 px line with
  // 4 on each side between groups. What does not fit the row leaves for
  // ⋯ «Ещё» at its end, a whole group with its separator, the link first
  // (core/js/overflow-row.js, C155); the marks stay.
  const toolbar = doc.createElement('div');
  toolbar.className = 'sf-inline-editor-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', text.toolbar);
  toolbar.dataset.sfToolbar = toolbarMode;
  toolbar.hidden = toolbarMode === 'selection';
  const buttons = new Map();
  const tools = [];
  const toolButton = (id, icon, label) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.classList.add('sf-inline-editor-button', `sf-inline-editor-button--${id}`, ...ICON_BUTTON);
    button.dataset.sfTool = id;
    button.setAttribute('aria-label', label);
    button.title = label;
    const glyph = doc.createElement('i');
    glyph.className = 'sf-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = icon;
    button.append(glyph);
    tools.push(button);
    return button;
  };
  const group = (priority) => {
    const box = doc.createElement('div');
    box.className = 'sf-inline-editor-group';
    box.setAttribute('role', 'group');
    box.dataset.sfPriority = String(priority);
    return box;
  };
  const separator = (...extra) => {
    const line = doc.createElement('span');
    line.className = ['sf-inline-editor-separator', ...extra].join(' ');
    line.setAttribute('aria-hidden', 'true');
    return line;
  };
  const groups = [];
  const separators = [];
  const marksGroup = group(1);
  for (const mark of offered) {
    const button = toolButton(mark, MARK_ICONS[mark] || 'format_clear', text[mark]);
    button.dataset.mark = mark;
    button.setAttribute('aria-pressed', 'false');
    if (SHORTCUTS[mark]) button.setAttribute('aria-keyshortcuts', `Control+${SHORTCUTS[mark].toUpperCase()} Meta+${SHORTCUTS[mark].toUpperCase()}`);
    buttons.set(mark, button);
    marksGroup.append(button);
  }
  if (marksGroup.childElementCount) groups.push(marksGroup);
  if (links) {
    const linkGroup = group(2);
    const button = toolButton('link', 'link', text.link);
    button.dataset.link = 'toggle';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    buttons.set('link', button);
    linkGroup.append(button);
    groups.push(linkGroup);
  }
  groups.forEach((box, at) => {
    if (at) {
      const line = separator();
      separators.push(line);
      toolbar.append(line);
    }
    toolbar.append(box);
  });
  const moreSeparator = separator('sf-inline-editor-more-separator', OUT);
  const moreButton = toolButton('more', 'more_horiz', text.more);
  moreButton.classList.add(OUT);
  moreButton.setAttribute('aria-haspopup', 'menu');
  moreButton.setAttribute('aria-expanded', 'false');
  toolbar.append(moreSeparator, moreButton);
  doc.body.append(toolbar);
  // The toolbar's keys (owner decision C184 (1)-(3), TL-4): one Tab stop that
  // comes back to the tool left, the arrows in the row's direction, Home and
  // End; a tool under «Ещё» (C155) and the link panel's buttons are not in the walk.
  const toolbarKeys = roving(toolbar, { items: () => [...tools, moreButton], out: `.${OUT}, [hidden], [inert]` });
  let toolsOut = [];
  let docked = false;
  let savedSelection = [0, 0];
  let lastSelection = null;

  // The link window (C141 (6), C172 (4)): its own panel under the selected
  // text -- the address field with its hint under it, then «Применить» and,
  // on a link, «Убрать ссылку» in a row from the start -- and a sheet at the
  // bottom of the screen on a phone (C32), above the keyboard. A refused
  // address says why in the hint's place.
  const linkPanel = doc.createElement('div');
  linkPanel.className = 'sf-inline-editor-link';
  linkPanel.setAttribute('role', 'dialog');
  linkPanel.setAttribute('aria-label', text.link);
  linkPanel.hidden = true;
  const linkInput = doc.createElement('sf-input');
  linkInput.className = 'sf-inline-editor-url';
  linkInput.setAttribute('size', LINK_SIZE);
  linkInput.setAttribute('label', text.url);
  linkInput.setAttribute('hint', text['link-hint']);
  linkInput.setAttribute('autocomplete', 'url');
  linkInput.setAttribute('inputmode', 'url');
  const linkActions = doc.createElement('div');
  linkActions.className = 'sf-inline-editor-link-actions';
  const linkApply = doc.createElement('sf-button');
  linkApply.className = 'sf-inline-editor-apply';
  linkApply.setAttribute('size', LINK_SIZE);
  linkApply.setAttribute('text', text.apply);
  const linkRemove = doc.createElement('sf-button');
  linkRemove.className = 'sf-inline-editor-unlink';
  linkRemove.setAttribute('size', LINK_SIZE);
  linkRemove.setAttribute('appearance', 'outline');
  linkRemove.setAttribute('text', text.unlink);
  linkActions.append(linkApply, linkRemove);
  // The reason, said once to a screen reader as it appears; the field shows it.
  const linkError = doc.createElement('span');
  linkError.className = 'sf-inline-editor-error';
  linkError.setAttribute('role', 'alert');
  linkPanel.append(linkInput, linkActions, linkError);
  if (links) doc.body.append(linkPanel);

  const inside = (node) => Boolean(node) && (element.contains(node) || toolbar.contains(node) || linkPanel.contains(node) || Boolean(toolbar._sfRowMoreMenu?.contains?.(node)) || node === toolbar._sfRowMoreMenu);
  const fieldControl = () => linkInput.querySelector('input');
  const linkValue = () => String(fieldControl()?.value ?? linkInput.value ?? '');
  const setLinkValue = (value) => {
    linkInput.value = value;
    const control = fieldControl();
    if (control) control.value = value;
  };
  const clearError = () => {
    linkInput.removeAttribute('invalid');
    linkInput.removeAttribute('error-message');
    linkError.textContent = '';
  };
  const showError = (problem) => {
    const message = format(text[problem] ?? text.invalid, { max: INLINE_LIMITS.maxHrefLength });
    linkInput.setAttribute('invalid', '');
    linkInput.setAttribute('error-message', message);
    linkError.textContent = message;
  };

  // The box of the text between two offsets: the first line's top, the last
  // line's bottom, the span between the leftmost and rightmost edge; for a
  // caret, its line.
  function rangeBox(start, end) {
    const range = doc.createRange();
    range.setStart(...locate(element, Math.min(start, end)));
    range.setEnd(...locate(element, Math.max(start, end)));
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0 || rect.height > 0);
    if (!lines.length) {
      if (start !== end) return null;
      const box = range.getBoundingClientRect();
      if (box.height > 0) return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      const own = element.getBoundingClientRect();
      return { top: own.top, bottom: own.bottom, left: own.left, right: own.right };
    }
    return {
      top: Math.min(...lines.map((rect) => rect.top)),
      bottom: Math.max(...lines.map((rect) => rect.bottom)),
      left: Math.min(...lines.map((rect) => rect.left)),
      right: Math.max(...lines.map((rect) => rect.right)),
    };
  }
  // The room between the text and what floats by it: the toolbar's own gap
  // (--sf-space-1/4 through its sheet).
  const gap = () => parseFloat(globalThis.getComputedStyle(toolbar).columnGap) || 4;
  // The bottom of what the person sees: above the screen keyboard where the
  // browser says where it is (visualViewport).
  const keyboardEdge = () => {
    const view = globalThis.visualViewport;
    return view ? view.offsetTop + view.height : globalThis.innerHeight;
  };

  // The selection mode's place: above the selected text, centred on it,
  // below it when there is no room above, kept inside the viewport. While the
  // link window is open the selection is in its field, so the saved one counts.
  function positionOverSelection() {
    const [start, end] = linkPanel.hidden ? selectionOffsets() : savedSelection;
    if (start === end && linkPanel.hidden) return;
    const box = rangeBox(start, end);
    if (!box) return;
    const bar = toolbar.getBoundingClientRect();
    const above = box.top - bar.height - gap();
    const top = above >= 0 ? above : Math.min(globalThis.innerHeight - bar.height, box.bottom + gap());
    const left = (box.left + box.right) / 2 - bar.width / 2;
    Object.assign(toolbar.style, { top: `${top}px`, left: `${Math.max(0, Math.min(left, doc.documentElement.clientWidth - bar.width))}px` });
  }

  function positionToolbar() {
    if (finished) return;
    if (!toolbar.hidden) {
      if (docked) {
        const bar = toolbar.getBoundingClientRect();
        Object.assign(toolbar.style, { top: `${keyboardEdge() - bar.height}px`, left: '' });
      } else if (toolbarMode === 'selection') positionOverSelection();
      else {
        const box = element.getBoundingClientRect();
        const bar = toolbar.getBoundingClientRect();
        const rtl = globalThis.getComputedStyle(element).direction === 'rtl';
        const above = box.top - bar.height - gap();
        const top = above >= 0 ? above : Math.min(globalThis.innerHeight - bar.height, box.bottom + gap());
        const start = rtl ? box.right - bar.width : box.left;
        Object.assign(toolbar.style, { top: `${top}px`, left: `${Math.max(0, Math.min(start, doc.documentElement.clientWidth - bar.width))}px` });
      }
    }
    placeLinkPanel();
  }

  // The link window under the selected text (above the toolbar when there is
  // no room below), from its start edge, inside the viewport; on a phone a
  // sheet standing on the keyboard.
  function placeLinkPanel() {
    if (linkPanel.hidden) return;
    if (docked) {
      linkPanel.setAttribute('data-sf-sheet', '');
      linkPanel.style.left = '';
      linkPanel.style.top = `${keyboardEdge() - linkPanel.getBoundingClientRect().height}px`;
      return;
    }
    linkPanel.removeAttribute('data-sf-sheet');
    const box = rangeBox(...savedSelection);
    if (!box) return;
    const panel = linkPanel.getBoundingClientRect();
    const bar = toolbar.hidden ? null : toolbar.getBoundingClientRect();
    const space = gap();
    const barBelow = bar && bar.top >= box.bottom - 1;
    let top = (barBelow ? bar.bottom : box.bottom) + space;
    if (top + panel.height > globalThis.innerHeight) {
      const above = (bar && !barBelow ? bar.top : box.top) - space - panel.height;
      top = above >= 0 ? above : Math.max(0, globalThis.innerHeight - panel.height);
    }
    const rtl = globalThis.getComputedStyle(element).direction === 'rtl';
    const start = rtl ? box.right - panel.width : box.left;
    Object.assign(linkPanel.style, { top: `${top}px`, left: `${Math.max(0, Math.min(start, doc.documentElement.clientWidth - panel.width))}px` });
  }

  // The row: the groups that fit, the rest in ⋯ (C155 (3), (4)). A floating
  // toolbar's room is the viewport's width less its own padding; the strip's
  // is its own width.
  function layoutBar() {
    if (finished || toolbar.hidden) return;
    let room = null;
    if (!docked) {
      const style = globalThis.getComputedStyle(toolbar);
      const chrome = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((sum, edge) => sum + (parseFloat(style[edge]) || 0), 0);
      room = doc.documentElement.clientWidth - chrome;
    }
    const units = groups.map((box, at) => ({ element: box, rank: at + 1, pin: at === 0, group: at }));
    const { out } = layoutActionRow({ row: toolbar, units, more: moreButton, moreSeparator, separators: separators.map((line, at) => ({ element: line, after: at })), outClass: OUT, room });
    toolsOut = out.flatMap((at) => [...groups[at].querySelectorAll('button')]);
    toolbar.setAttribute('data-sf-row-laid', '');
  }

  // A phone takes the strip above the keyboard with buttons on the touch
  // rung; wider, the floating toolbar on the 1/2 rung.
  function followScreen() {
    const next = onPhone(doc);
    if (next === docked && toolbar.hasAttribute('data-sf-size')) return;
    docked = next;
    toolbar.classList.toggle('sf-inline-editor-toolbar--dock', docked);
    const size = docked ? BAR_SIZE.dock : BAR_SIZE.float;
    toolbar.dataset.sfSize = size;
    for (const button of tools) {
      for (const name of [...button.classList]) if (name.startsWith('sf-icon-button--size-')) button.classList.remove(name);
      button.classList.add(`sf-icon-button--size-${size}`);
    }
  }

  function updateToolbar() {
    if (finished) return;
    const [start, end] = linkPanel.hidden ? selectionOffsets() : savedSelection;
    if (linkPanel.hidden && element.contains(doc.getSelection()?.anchorNode)) lastSelection = [start, end];
    const state = marksIn(read(), start, end === start ? Math.max(0, start - 1) : end);
    for (const mark of offered) buttons.get(mark).setAttribute('aria-pressed', state.marks.includes(mark) ? 'true' : 'false');
    buttons.get('link')?.setAttribute('aria-pressed', state.href ? 'true' : 'false');
    const wasHidden = toolbar.hidden;
    // Selection mode: the bar is there while text is selected or a link is
    // being written, and nowhere while the caret only stands in the text --
    // except on a phone, where the strip stays for the whole edit.
    toolbar.hidden = !docked && toolbarMode === 'selection' && start === end && linkPanel.hidden;
    if (wasHidden && !toolbar.hidden) layoutBar();
    positionToolbar();
  }

  function toggle(mark) {
    const [start, end] = selectionOffsets();
    if (start === end) return;
    apply(toggleMark(read(), start, end, mark), start, end);
  }

  function insertBreak() {
    const [start, end] = selectionOffsets();
    const content = read();
    const at = toSegments(sliceInline(content, Math.max(0, start - 1), start)).find((segment) => !segment.node);
    apply(replaceRange(content, start, end, [breakSegment(at?.marks || [], at?.href || null)]), start + 1, start + 1);
  }

  // The field takes the focus once sf-input has drawn it.
  function focusField() {
    const ready = globalThis.customElements?.get('sf-input') ? null : globalThis.SF?.Loader?.ensure?.(['sf-input', 'sf-button']);
    Promise.resolve(ready).then(() => linkInput.updateComplete).then(() => {
      if (finished || linkPanel.hidden) return;
      const control = fieldControl();
      if (control) {
        control.focus({ preventScroll: true });
        control.select?.();
      } else linkInput.focus?.({ preventScroll: true });
      placeLinkPanel();
    });
  }

  function openLink() {
    if (!links || finished) return;
    let [start, end] = selectionOffsets();
    // No selection: the word under the caret; none there, the address
    // becomes the link's text where the caret stands.
    if (start === end) {
      const word = wordAround(read(), start);
      if (word) {
        [start, end] = word;
        setSelection(element, start, end);
      }
    }
    savedSelection = [start, end];
    const href = start === end ? '' : (marksIn(read(), start, end).href || '');
    linkRemove.hidden = !href;
    clearError();
    setLinkValue(href);
    linkPanel.hidden = false;
    buttons.get('link')?.setAttribute('aria-expanded', 'true');
    updateToolbar();
    focusField();
  }

  function closeLink(focusEditor = true) {
    if (linkPanel.hidden) return;
    linkPanel.hidden = true;
    linkPanel.removeAttribute('data-sf-sheet');
    buttons.get('link')?.setAttribute('aria-expanded', 'false');
    clearError();
    if (focusEditor && !finished) {
      element.focus({ preventScroll: true });
      setSelection(element, ...savedSelection);
    }
    if (!finished) updateToolbar();
  }

  function applyLink(href) {
    if (href !== null) {
      const problem = linkProblem(href);
      if (problem) {
        showError(problem);
        return;
      }
    }
    closeLink();
    const [start, end] = savedSelection;
    if (href !== null && start === end) {
      // Nothing selected and no word: the address is the link's text.
      const shown = href.replace(/^(mailto|tel):/u, '');
      apply(replaceRange(read(), start, end, [{ text: shown, marks: [], href }]), start + shown.length, start + shown.length);
    } else apply(setLink(read(), start, end, href), start, end);
  }

  // A tool of the toolbar or of its «Ещё»: from the menu the text gets the
  // focus and its selection back first.
  function runTool(id, fromMenu = false) {
    if (finished) return;
    if (fromMenu) {
      element.focus({ preventScroll: true });
      if (lastSelection) setSelection(element, ...lastSelection);
    }
    if (id === 'link') (linkPanel.hidden ? openLink() : closeLink());
    else if (offered.includes(id)) toggle(id);
  }

  async function openMore() {
    const entries = [];
    let last = null;
    for (const button of toolsOut) {
      const box = button.closest('.sf-inline-editor-group');
      if (last && box !== last) entries.push({ type: 'separator' });
      last = box;
      const entry = actionEntry(button, button.dataset.sfTool);
      const key = button.dataset.mark ? SHORTCUTS[button.dataset.mark] : button.dataset.link ? 'k' : null;
      if (key) entry.shortcut = `mod+${key}`;
      entries.push(entry);
    }
    await openRowMenu(toolbar, { anchor: moreButton, entries, label: text.more, size: docked ? '1' : '1/2', select: (id) => runTool(id, true) });
  }

  // Lifecycle --------------------------------------------------------------
  let observer = null;
  function teardown() {
    finished = true;
    connection.abort();
    observer?.disconnect();
    toolbarKeys.destroy();
    toolbar._sfRowMoreMenu?.remove?.();
    toolbar.remove();
    linkPanel.remove();
    element.innerHTML = original.html;
    for (const [name, value] of original.attributes) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    element.removeAttribute('data-sf-inline-editing');
  }

  function commit() {
    if (finished) return null;
    const content = normalizeInline(read());
    teardown();
    emitInline(element, 'commit', options.nodeId ?? null, content);
    return content;
  }

  // Enter in a block editor (enter: 'new-block'): the text before the caret
  // is saved, the text after it (the selection dropped) goes as next.
  function commitNewBlock() {
    if (finished) return null;
    const [start, end] = selectionOffsets();
    const content = read();
    const before = normalizeInline(sliceInline(content, 0, start));
    const next = normalizeInline(sliceInline(content, end, inlineLength(content)));
    teardown();
    emitInline(element, 'commit', options.nodeId ?? null, before, next);
    return before;
  }

  function cancel() {
    if (finished) return;
    teardown();
    emitInline(element, 'cancel', options.nodeId ?? null);
  }

  // Start ------------------------------------------------------------------
  const initial = normalizeInline(options.content ?? readInlineDom(element, { marks, links }));
  element.setAttribute('data-sf-inline-editing', '');
  element.setAttribute('contenteditable', 'true');
  element.setAttribute('role', 'textbox');
  element.setAttribute('aria-multiline', 'false');
  element.setAttribute('aria-label', format(enterMode === 'new-block' ? text['editing-block'] : text.editing, { label: options.label || '' }).replace(/^: /u, ''));
  element.replaceChildren(renderInlineDom(doc, initial));
  element.focus();
  setSelection(element, inlineLength(initial));
  history.push({ content: initial, selection: selectionOffsets(), typing: false });
  historyIndex = 0;

  element.addEventListener('beforeinput', (event) => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      if (event.inputType === 'historyUndo' && historyIndex > 0) restore(historyIndex - 1);
      if (event.inputType === 'historyRedo' && historyIndex < history.length - 1) restore(historyIndex + 1);
    } else if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      event.preventDefault();
    } else if (event.inputType.startsWith('format')) {
      event.preventDefault();
      const mark = { formatBold: 'strong', formatItalic: 'em' }[event.inputType];
      if (mark && marks.includes(mark)) toggle(mark);
    } else if (event.inputType === 'insertFromDrop') {
      event.preventDefault();
    }
  }, signal);
  element.addEventListener('input', () => {
    if (composing) return;
    const now = Date.now();
    snapshot(now - lastTyping < 700);
    lastTyping = now;
    emitInput();
    updateToolbar();
  }, signal);
  element.addEventListener('compositionstart', () => { composing = true; }, signal);
  element.addEventListener('compositionend', () => {
    composing = false;
    snapshot(false);
    emitInput();
  }, signal);
  element.addEventListener('paste', (event) => {
    event.preventDefault();
    const data = event.clipboardData;
    const html = data?.getData('text/html');
    const plain = data?.getData('text/plain') || '';
    let parsed = [{ type: 'text', value: plain.replace(/\s+/gu, ' ').trim() }];
    if (html) {
      const body = new globalThis.DOMParser().parseFromString(html, 'text/html').body;
      if (body.querySelector(`[${COPY_ATTRIBUTE}]`)?.getAttribute(COPY_ATTRIBUTE) !== copyToken()) {
        for (const node of body.querySelectorAll('*')) for (const name of node.getAttributeNames()) if (name.startsWith('data-sf-inline-')) node.removeAttribute(name);
      }
      parsed = readInlineDom(body, { marks, links, collapse: true });
    }
    const inserted = toSegments(parsed);
    const [start, end] = selectionOffsets();
    const length = inlineLength(fromSegments(inserted));
    apply(replaceRange(read(), start, end, inserted), start + length, start + length);
  }, signal);
  element.addEventListener('drop', (event) => event.preventDefault(), signal);
  // Copy and cut write the editor's own HTML, in which an atom keeps its
  // entry, so pasting it into an inline editor gives the same atom back.
  const copySelection = (event, remove) => {
    const [start, end] = selectionOffsets();
    if (start === end || !event.clipboardData) return;
    event.preventDefault();
    const slice = sliceInline(read(), start, end);
    const holder = doc.createElement('div');
    const wrapper = doc.createElement('span');
    wrapper.setAttribute(COPY_ATTRIBUTE, copyToken());
    wrapper.append(renderInlineDom(doc, slice));
    holder.append(wrapper);
    event.clipboardData.setData('text/html', holder.innerHTML);
    event.clipboardData.setData('text/plain', toSegments(slice).map(({ text, node, break: isBreak }) => (node ? (typeof node.props?.text === 'string' ? node.props.text : '') : isBreak ? '\n' : text)).join(''));
    if (remove) apply(replaceRange(read(), start, end, []), start, start);
  };
  element.addEventListener('copy', (event) => copySelection(event, false), signal);
  element.addEventListener('cut', (event) => copySelection(event, true), signal);
  // An atom is one caret stop: arrows step over it in one move, Backspace
  // and Delete remove it whole. Only the moves next to an atom are taken over.
  const stepOverAtom = (event) => {
    const selection = doc.getSelection();
    if (!selection?.rangeCount || event.altKey || event.ctrlKey || event.metaKey) return false;
    const content = read();
    const [start, end] = selectionOffsets();
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (start !== end) {
        if (!toSegments(sliceInline(content, start, end)).some(({ node }) => node)) return false;
        apply(replaceRange(content, start, end, []), start, start);
        return true;
      }
      const at = event.key === 'Backspace' ? start - 1 : start;
      if (at < 0 || !objectAt(content, at)) return false;
      apply(replaceRange(content, at, at + 1, []), at, at);
      return true;
    }
    const rtl = globalThis.getComputedStyle(element).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    const anchor = textOffset(element, selection.anchorNode, selection.anchorOffset);
    const focus = textOffset(element, selection.focusNode, selection.focusOffset);
    if (!event.shiftKey && anchor !== focus) return false;
    const next = forward ? focus + 1 : focus - 1;
    if (!objectAt(content, forward ? focus : focus - 1)) return false;
    setSelection(element, event.shiftKey ? anchor : next, next);
    updateToolbar();
    return true;
  };
  element.addEventListener('keydown', (event) => {
    if (event.isComposing || composing) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete'].includes(event.key) && stepOverAtom(event)) {
      event.preventDefault();
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enter: a soft line break in the same block, with the marks and
      // link of the text before it (inline model 1.2.0).
      event.preventDefault();
      insertBreak();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      // Enter saves (C172 (2)); in a block editor it starts the next block.
      event.preventDefault();
      if (enterMode === 'new-block') commitNewBlock();
      else commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    } else if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) { if (historyIndex < history.length - 1) restore(historyIndex + 1); } else if (historyIndex > 0) restore(historyIndex - 1);
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      if (historyIndex < history.length - 1) restore(historyIndex + 1);
    } else if (modifier && event.key.toLowerCase() === 'k' && links) {
      event.preventDefault();
      openLink();
    } else if (modifier) {
      const mark = Object.entries(SHORTCUTS).find(([, key]) => key === event.key.toLowerCase())?.[0];
      if (mark && marks.includes(mark)) {
        event.preventDefault();
        toggle(mark);
      }
    }
  }, signal);
  toolbar.addEventListener('mousedown', (event) => {
    // Keep the text selection while pressing toolbar buttons.
    if (event.target.closest('button')) event.preventDefault();
  }, signal);
  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === moreButton) openMore();
    else runTool(button.dataset.sfTool);
  }, signal);
  // The arrows, Home and End are core's roving helper (C184, above); Escape
  // goes back to the text.
  toolbar.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    element.focus({ preventScroll: true });
    if (lastSelection) setSelection(element, ...lastSelection);
  }, signal);
  linkPanel.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.target.closest?.('sf-button')) { event.preventDefault(); applyLink(linkValue().trim()); }
    if (event.key === 'Escape') { event.preventDefault(); closeLink(); }
  }, signal);
  // The reason goes as soon as the address changes (C153 (3)).
  linkPanel.addEventListener('input', () => { if (linkInput.hasAttribute('invalid')) clearError(); }, signal);
  linkPanel.addEventListener('click', (event) => {
    if (event.target.closest('.sf-inline-editor-apply')) applyLink(linkValue().trim());
    else if (event.target.closest('.sf-inline-editor-unlink')) applyLink(null);
  }, signal);
  // On a phone the sheet stands over a scrim: a press outside it closes it
  // and keeps the edit.
  doc.addEventListener('pointerdown', (event) => {
    if (!docked || linkPanel.hidden || linkPanel.contains(event.target)) return;
    event.preventDefault();
    closeLink();
  }, { ...signal, capture: true });
  const onFocusOut = (event) => {
    if (inside(event.relatedTarget)) return;
    // Let a click inside the toolbar or the link window land before deciding to commit.
    globalThis.setTimeout(() => {
      if (!finished && !inside(doc.activeElement)) commit();
    }, 0);
  };
  element.addEventListener('focusout', onFocusOut, signal);
  toolbar.addEventListener('focusout', onFocusOut, signal);
  linkPanel.addEventListener('focusout', onFocusOut, signal);
  doc.addEventListener('selectionchange', () => { if (element.contains(doc.getSelection()?.anchorNode)) updateToolbar(); }, signal);
  const onResize = () => {
    const was = docked;
    followScreen();
    if (was !== docked) toolbar.removeAttribute('data-sf-row-laid');
    layoutBar();
    positionToolbar();
  };
  globalThis.addEventListener('scroll', positionToolbar, { ...signal, passive: true, capture: true });
  globalThis.addEventListener('resize', onResize, { ...signal, passive: true });
  globalThis.visualViewport?.addEventListener('resize', positionToolbar, { ...signal, passive: true });
  globalThis.visualViewport?.addEventListener('scroll', positionToolbar, { ...signal, passive: true });
  // The groups widen when the icon face arrives: the row is laid out again.
  if (typeof globalThis.ResizeObserver === 'function') {
    observer = new globalThis.ResizeObserver(() => { layoutBar(); positionToolbar(); });
    for (const box of groups) observer.observe(box);
    // The link window grows when a reason takes two lines: it is placed again.
    if (links) observer.observe(linkPanel);
  }
  followScreen();
  updateToolbar();
  layoutBar();
  positionToolbar();

  return Object.freeze({ element, commit, cancel, value: () => normalizeInline(read()) });
}

/**
 * <sf-editor-inline> is the loadable carrier of the inline editor: placing it
 * on a page lets the Smart loader fetch this code on demand. It renders
 * nothing; edit(element, options) is startInlineEdit.
 */
//
// base: the class made from sf-editor-inline's component.json
// (manifest-host.mjs); without it the carrier is a plain element.
export function defineInlineEditor(registry = globalThis.customElements, { base = null } = {}) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-editor-inline');
  if (existing) return existing;
  class SfInlineEditor extends (base || globalThis.HTMLElement) {
    connectedCallback() {
      super.connectedCallback?.();
      this.hidden = true;
    }

    edit(element, options) {
      return startInlineEdit(element, options);
    }
  }
  registry.define('sf-editor-inline', SfInlineEditor);
  // The former tag sf-inline-editor is a dated alias (a subclass, noted once).
  defineTagAliases(SfInlineEditor, 'sf-editor-inline', { define: (name, Class) => registry.define(name, Class) });
  return SfInlineEditor;
}

export default { INLINE_ENTER_MODES, INLINE_EVENTS, INLINE_EVENTS_FORMER_TAG, INLINE_EVENTS_LEGACY, INLINE_TOOLBAR_MODES, defineInlineEditor, linkProblem, readInlineDom, renderInlineDom, startInlineEdit, textOffset, useInlineEditorWords, wordAround };
