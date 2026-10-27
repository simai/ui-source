import { pageText } from '../page-language.js';
import { INLINE_MARKS, fromSegments, inlineText, marksIn, normalizeInline, replaceRange, safeHref, setLink, toSegments, toggleMark } from './inline-model.mjs';

// In-place editor for the Composition inline content model. The host starts
// it on a rendered heading or paragraph element; the editor exposes only
// normalized content (never HTML) through events. Cancel restores the exact
// original DOM; commit restores it too and lets the host re-render the saved
// value, so the canvas always returns to host-rendered HTML.

// The names sf-inline-editor's component.json declares (standard 1.3.8 §8,
// vocabulary 1.1.5): input while the text changes, change when it is
// committed, cancel when it is put back -- {id, content}, data only. The
// edited element is the host's, which carries no shim, so each event is
// followed here by its former name with its former detail ({node_id,
// content}) until 2026-12-01.
export const INLINE_EVENTS = Object.freeze({
  input: 'sf-inline-editor-input',
  commit: 'sf-inline-editor-change',
  cancel: 'sf-inline-editor-cancel',
});

export const INLINE_EVENTS_LEGACY = Object.freeze({
  input: 'sf-inline-edit-input',
  commit: 'sf-inline-edit-commit',
  cancel: 'sf-inline-edit-cancel',
});

function emitInline(element, key, id, content) {
  const detail = content === undefined ? { id } : { id, content };
  const legacy = content === undefined ? { node_id: id } : { node_id: id, content };
  element.dispatchEvent(new globalThis.CustomEvent(INLINE_EVENTS[key], { bubbles: true, composed: true, detail: Object.freeze(detail) }));
  element.dispatchEvent(new globalThis.CustomEvent(INLINE_EVENTS_LEGACY[key], { bubbles: true, composed: true, detail: Object.freeze(legacy) }));
}

const MESSAGES = {
  ru: { toolbar: 'Форматирование', strong: 'Полужирный', em: 'Курсив', code: 'Код', link: 'Ссылка', url: 'Адрес ссылки', apply: 'Применить', unlink: 'Убрать ссылку', editing: '{label}: редактирование. Enter — сохранить, Escape — отменить.', invalid: 'Недопустимый адрес ссылки' },
  en: { toolbar: 'Formatting', strong: 'Bold', em: 'Italic', code: 'Code', link: 'Link', url: 'Link address', apply: 'Apply', unlink: 'Remove link', editing: '{label}: editing. Enter saves, Escape cancels.', invalid: 'Invalid link address' },
};
const SHORTCUTS = { strong: 'b', em: 'i', code: 'e' };
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK', 'IMG', 'SVG', 'OBJECT', 'IFRAME', 'NOSCRIPT']);
const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE', 'BLOCKQUOTE', 'SECTION', 'ARTICLE']);
const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
// Words in the page's language through pageText, as every component takes
// them: the editor read <html lang> alone and offered only English or Russian,
// so SF.language.use() and a product's own dictionary never reached it
// (documentation trial, 2026-10-12).
const words = (node) => Object.fromEntries(Object.keys(MESSAGES.en).map((key) => [key, pageText(MESSAGES, key, node, 'sf-inline-editor')]));

/** Reads inline content from any DOM subtree; foreign markup and styles are dropped. */
export function readInlineDom(root, { marks = INLINE_MARKS, links = true, collapse = false } = {}) {
  const segments = [];
  const visit = (node, active, href) => {
    if (node.nodeType === 3) {
      let text = node.nodeValue.replace(/\u00a0/gu, ' ').replace(/[\r\n\t\f\v]/gu, ' ');
      if (collapse) text = text.replace(/ {2,}/gu, ' ');
      if (text) segments.push({ text, marks: [...active], href });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1 && SKIP.has(node.tagName.toUpperCase())) return;
    const tag = node.nodeType === 1 ? node.tagName.toUpperCase() : '';
    const next = new Set(active);
    let nextHref = href;
    if (tag === 'STRONG' || tag === 'B') next.add('strong');
    if (tag === 'EM' || tag === 'I') next.add('em');
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') next.add('code');
    if (node.nodeType === 1 && node.style) {
      const weight = node.style.fontWeight;
      if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) next.add('strong');
      if (node.style.fontStyle === 'italic') next.add('em');
    }
    if (tag === 'A' && !href && links) {
      const candidate = node.getAttribute('href');
      if (safeHref(candidate)) nextHref = candidate;
    }
    if (tag === 'BR') {
      // The placeholder <br> a browser leaves in an emptied editor is not content.
      if (node.parentNode === root && !node.nextSibling) return;
      segments.push({ text: ' ', marks: [...active], href });
      return;
    }
    for (const child of node.childNodes) visit(child, next, nextHref);
    // Nested blocks (pasted paragraphs) are separated by one space; the root is not.
    if (BLOCK.has(tag) && node !== root) segments.push({ text: ' ', marks: [], href: null });
  };
  visit(root, new Set(), null);
  const allowed = new Set(marks);
  let content = fromSegments(segments.map((segment) => ({ ...segment, marks: segment.marks.filter((mark) => allowed.has(mark)), href: links ? segment.href : null })));
  if (collapse) {
    const flat = toSegments(content);
    if (flat.length) {
      flat[0] = { ...flat[0], text: flat[0].text.replace(/^ +/u, '') };
      flat[flat.length - 1] = { ...flat.at(-1), text: flat.at(-1).text.replace(/ +$/u, '') };
    }
    content = fromSegments(flat);
  }
  return content;
}

/** Renders inline content with the same element nesting as the Framework renderer. */
export function renderInlineDom(doc, content) {
  const fragment = doc.createDocumentFragment();
  const run = (entry) => {
    let node = doc.createTextNode(entry.value);
    for (const mark of entry.marks || []) {
      const wrapper = doc.createElement(mark);
      wrapper.append(node);
      node = wrapper;
    }
    return node;
  };
  for (const entry of normalizeInline(content)) {
    if (entry.type === 'link') {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', entry.href);
      for (const child of entry.children) anchor.append(run(child));
      fragment.append(anchor);
    } else fragment.append(run(entry));
  }
  return fragment;
}

function textNodes(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

/** Character offset of a DOM position inside root, counted over text nodes. */
export function textOffset(root, container, offset) {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

function setSelection(root, start, end = start) {
  const selection = root.ownerDocument.getSelection();
  const nodes = textNodes(root);
  const locate = (offset) => {
    let total = 0;
    for (const node of nodes) {
      if (offset <= total + node.nodeValue.length) return [node, offset - total];
      total += node.nodeValue.length;
    }
    return nodes.length ? [nodes.at(-1), nodes.at(-1).nodeValue.length] : [root, 0];
  };
  const range = root.ownerDocument.createRange();
  const [startNode, startOffset] = locate(start);
  const [endNode, endOffset] = locate(end);
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Starts in-place editing of a rendered heading or paragraph element.
 * options: {content, nodeId, label, marks, links, messages}
 * Returns {commit(), cancel(), value(), element}.
 */
export function startInlineEdit(element, options = {}) {
  if (!(element instanceof globalThis.Element)) throw new TypeError('Inline editing needs an element');
  if (element.hasAttribute('data-sf-inline-editing')) throw new TypeError('inline_edit_active');
  const doc = element.ownerDocument;
  const text = { ...words(element), ...(options.messages || {}) };
  const marks = (options.marks || INLINE_MARKS).filter((mark) => INLINE_MARKS.includes(mark));
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
    if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return [inlineText(read()).length, inlineText(read()).length];
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
  const toolbar = doc.createElement('div');
  toolbar.className = 'sf-inline-editor-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', text.toolbar);
  const buttons = new Map();
  for (const mark of marks) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `sf-inline-editor-button sf-inline-editor-button--${mark}`;
    button.dataset.mark = mark;
    button.textContent = text[mark];
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-keyshortcuts', `Control+${SHORTCUTS[mark].toUpperCase()} Meta+${SHORTCUTS[mark].toUpperCase()}`);
    buttons.set(mark, button);
    toolbar.append(button);
  }
  const linkForm = doc.createElement('div');
  linkForm.className = 'sf-inline-editor-link';
  linkForm.hidden = true;
  const linkInput = doc.createElement('input');
  linkInput.type = 'url';
  linkInput.className = 'sf-inline-editor-url';
  linkInput.setAttribute('aria-label', text.url);
  const linkApply = doc.createElement('button');
  linkApply.type = 'button';
  linkApply.className = 'sf-inline-editor-button';
  linkApply.textContent = text.apply;
  const linkRemove = doc.createElement('button');
  linkRemove.type = 'button';
  linkRemove.className = 'sf-inline-editor-button';
  linkRemove.textContent = text.unlink;
  const linkError = doc.createElement('span');
  linkError.className = 'sf-inline-editor-error';
  linkError.setAttribute('role', 'alert');
  linkForm.append(linkInput, linkApply, linkRemove, linkError);
  if (links) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sf-inline-editor-button sf-inline-editor-button--link';
    button.dataset.link = 'toggle';
    button.textContent = text.link;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    buttons.set('link', button);
    toolbar.append(button, linkForm);
  }
  doc.body.append(toolbar);
  let savedSelection = [0, 0];

  function positionToolbar() {
    const box = element.getBoundingClientRect();
    const bar = toolbar.getBoundingClientRect();
    const rtl = globalThis.getComputedStyle(element).direction === 'rtl';
    const above = box.top - bar.height - 4;
    const top = above >= 0 ? above : Math.min(globalThis.innerHeight - bar.height, box.bottom + 4);
    const start = rtl ? box.right - bar.width : box.left;
    Object.assign(toolbar.style, { top: `${top}px`, left: `${Math.max(0, Math.min(start, globalThis.innerWidth - bar.width))}px` });
  }

  function updateToolbar() {
    const [start, end] = selectionOffsets();
    const state = marksIn(read(), start, end === start ? Math.max(0, start - 1) : end);
    for (const mark of marks) buttons.get(mark).setAttribute('aria-pressed', state.marks.includes(mark) ? 'true' : 'false');
    buttons.get('link')?.setAttribute('aria-pressed', state.href ? 'true' : 'false');
    positionToolbar();
  }

  function toggle(mark) {
    const [start, end] = selectionOffsets();
    if (start === end) return;
    apply(toggleMark(read(), start, end, mark), start, end);
  }

  function openLink() {
    savedSelection = selectionOffsets();
    if (savedSelection[0] === savedSelection[1]) return;
    linkForm.hidden = false;
    linkError.textContent = '';
    linkInput.value = marksIn(read(), ...savedSelection).href || '';
    linkInput.focus();
    positionToolbar();
  }

  function closeLink(focusEditor = true) {
    linkForm.hidden = true;
    if (focusEditor) {
      element.focus();
      setSelection(element, ...savedSelection);
    }
  }

  function applyLink(href) {
    if (href !== null && !safeHref(href)) {
      linkError.textContent = text.invalid;
      linkInput.setAttribute('aria-invalid', 'true');
      return;
    }
    linkInput.removeAttribute('aria-invalid');
    closeLink();
    apply(setLink(read(), ...savedSelection, href), ...savedSelection);
  }

  // Lifecycle --------------------------------------------------------------
  function teardown() {
    finished = true;
    connection.abort();
    toolbar.remove();
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
  element.setAttribute('aria-label', format(text.editing, { label: options.label || '' }).replace(/^: /u, ''));
  element.replaceChildren(renderInlineDom(doc, initial));
  element.focus();
  setSelection(element, inlineText(initial).length);
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
    const parsed = html
      ? readInlineDom(new globalThis.DOMParser().parseFromString(html, 'text/html').body, { marks, links, collapse: true })
      : [{ type: 'text', value: plain.replace(/\s+/gu, ' ').trim() }];
    const inserted = toSegments(parsed);
    const [start, end] = selectionOffsets();
    const length = inserted.reduce((sum, segment) => sum + segment.text.length, 0);
    apply(replaceRange(read(), start, end, inserted), start + length, start + length);
  }, signal);
  element.addEventListener('drop', (event) => event.preventDefault(), signal);
  element.addEventListener('keydown', (event) => {
    if (event.isComposing || composing) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
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
    if (button.dataset.mark) toggle(button.dataset.mark);
    else if (button.dataset.link) (linkForm.hidden ? openLink() : closeLink());
    else if (button === linkApply) applyLink(linkInput.value.trim());
    else if (button === linkRemove) applyLink(null);
  }, signal);
  linkInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); applyLink(linkInput.value.trim()); }
    if (event.key === 'Escape') { event.preventDefault(); closeLink(); }
  }, signal);
  const onFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next && (element.contains(next) || toolbar.contains(next))) return;
    // Let a click inside the toolbar land before deciding to commit.
    globalThis.setTimeout(() => {
      if (!finished && !element.contains(doc.activeElement) && !toolbar.contains(doc.activeElement)) commit();
    }, 0);
  };
  element.addEventListener('focusout', onFocusOut, signal);
  toolbar.addEventListener('focusout', onFocusOut, signal);
  doc.addEventListener('selectionchange', () => { if (element.contains(doc.getSelection()?.anchorNode)) updateToolbar(); }, signal);
  globalThis.addEventListener('scroll', positionToolbar, { ...signal, passive: true, capture: true });
  globalThis.addEventListener('resize', positionToolbar, { ...signal, passive: true });
  updateToolbar();

  return Object.freeze({ element, commit, cancel, value: () => normalizeInline(read()) });
}

/**
 * <sf-inline-editor> is the loadable carrier of the inline editor: placing it
 * on a page lets the Smart loader fetch this code on demand. It renders
 * nothing; edit(element, options) is startInlineEdit.
 */
//
// base: the class made from sf-inline-editor's component.json
// (manifest-host.mjs); without it the carrier is a plain element.
export function defineInlineEditor(registry = globalThis.customElements, { base = null } = {}) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-inline-editor');
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
  registry.define('sf-inline-editor', SfInlineEditor);
  return SfInlineEditor;
}

export default { INLINE_EVENTS, INLINE_EVENTS_LEGACY, defineInlineEditor, readInlineDom, renderInlineDom, startInlineEdit, textOffset };
