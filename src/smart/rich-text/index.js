import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {fieldSize} from '../../component/field-size';
import {FormField} from '../helpers/form-field';
import {renderRichTextTemplate} from './js/templates/default';
import {richTextFromPlainText, richTextHref, sanitizeRichText} from './js/rich-text-html.mjs';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// sf-rich-text: a form field whose value is HTML of a small subset -- p, h2,
// h3, h4, strong, em, a[href], ul, ol, li, blockquote, br -- the text type
// html@1 of Larena's properties (js/rich-text-html.mjs is the subset's rule).
//
// From its component.json (standard simai.smart-component 1.3.11 §3, §4, §8,
// §17): the settings are made by core/js/element-manifest.js; the field is
// the form control through ElementInternals, as sf-textarea is, and says
// input while the text changes and change when the person leaves it with a
// changed value. A value set from code, a form reset and a restore say
// nothing.
//
// The value is never trusted: what the page gives, what is pasted or dropped,
// and the editing surface after every keystroke and command go through the
// one cleaner. A command may use document.execCommand where the browser has
// it, but its result is cleaned the same way, and undo and redo are the
// component's own history of cleaned states, so neither depends on it.

const RichTextElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'en',
});

const BLOCK_TAGS = {paragraph: 'p', 'heading-2': 'h2', 'heading-3': 'h3', 'heading-4': 'h4'};
const LEAF_BLOCKS = 'p, h2, h3, h4, li, div';
const HISTORY_LIMIT = 100;
const TYPING_GROUP_MS = 1000;

// The toolbar, in its order. `pressed` names the state that presses it;
// `unavailable` greys it out (aria-disabled, still reachable by the arrows).
//
// The four block levels are drawn as text, not glyphs: the Framework's icon
// font is Material Icons, which has no paragraph or heading-level icon
// (format_paragraph and format_h2..h6 are Material Symbols only), and a
// missing ligature prints its own name on the button. P, H2, H3 and H4 are
// read in both page languages; the button's name is the word, as everywhere.
const TOOLS = Object.freeze([
  {id: 'paragraph', word: 'paragraph', text: 'P', pressed: 'p', unavailable: (state) => state.inList},
  {id: 'heading-2', word: 'heading-2', text: 'H2', pressed: 'h2', unavailable: (state) => state.inList},
  {id: 'heading-3', word: 'heading-3', text: 'H3', pressed: 'h3', unavailable: (state) => state.inList},
  {id: 'heading-4', word: 'heading-4', text: 'H4', pressed: 'h4', unavailable: (state) => state.inList},
  {id: 'bold', word: 'bold', icon: 'format_bold', pressed: 'strong', key: 'B', shortcut: 'Control+B Meta+B'},
  {id: 'italic', word: 'italic', icon: 'format_italic', pressed: 'em', key: 'I', shortcut: 'Control+I Meta+I'},
  {id: 'link', word: 'link', icon: 'link', pressed: 'link', key: 'K', shortcut: 'Control+K Meta+K', popup: 'dialog'},
  {id: 'bulleted-list', word: 'bulleted-list', icon: 'format_list_bulleted', pressed: 'ul'},
  {id: 'numbered-list', word: 'numbered-list', icon: 'format_list_numbered', pressed: 'ol'},
  {id: 'quote', word: 'quote', icon: 'format_quote', pressed: 'blockquote'},
  {id: 'undo', word: 'undo', icon: 'undo', key: 'Z', shortcut: 'Control+Z Meta+Z', unavailable: (state) => !state.canUndo},
  {id: 'redo', word: 'redo', icon: 'redo', key: 'Shift+Z', shortcut: 'Control+Shift+Z Meta+Shift+Z Control+Y', unavailable: (state) => !state.canRedo},
]);

// ------------------------------------------------------------ the caret
//
// A place in the editor as a count of units -- characters, line breaks and
// block starts (each leaf block after the first) -- so it survives the
// cleaner rewriting the surface: cleaning never changes the text, the
// breaks or the blocks a person sees.

function units(root, visit) {
  let first = true;
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (visit({kind: 'text', node: child, length: child.data.length}) === false) return false;
      } else if (child.nodeType === 1) {
        if (child.matches(LEAF_BLOCKS)) {
          if (!first && visit({kind: 'block', node: child}) === false) return false;
          first = false;
        }
        if (child.localName === 'br') {
          if (visit({kind: 'br', node: child}) === false) return false;
        } else if (walk(child) === false) return false;
      }
    }
    return true;
  };
  walk(root);
}

function offsetOf(root, container, offset) {
  if (!root.contains(container)) return null;
  const doc = root.ownerDocument;
  const point = doc.createRange();
  point.setStart(container, offset);
  point.collapse(true);
  let count = 0;
  units(root, (unit) => {
    if (unit.kind === 'text') {
      if (unit.node === container) {
        count += offset;
        return false;
      }
      if (point.comparePoint(unit.node, unit.length) <= 0) count += unit.length;
      else return false;
    } else if (unit.kind === 'br') {
      const parent = unit.node.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, unit.node);
      if (point.comparePoint(parent, index + 1) <= 0) count += 1;
      else return false;
    } else if (point.comparePoint(unit.node, 0) <= 0) {
      count += 1;
    } else {
      return false;
    }
    return true;
  });
  return count;
}

function pointAt(root, target) {
  let count = 0;
  let found = null;
  let last = null;
  units(root, (unit) => {
    if (unit.kind === 'text') {
      if (target <= count + unit.length) {
        found = [unit.node, target - count];
        return false;
      }
      count += unit.length;
      last = [unit.node, unit.length];
    } else if (unit.kind === 'br') {
      const parent = unit.node.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, unit.node);
      if (target === count) {
        found = [parent, index];
        return false;
      }
      count += 1;
      last = [parent, index + 1];
    } else {
      count += 1;
      last = [unit.node, 0];
    }
    return true;
  });
  return found || last || [root, 0];
}

// ------------------------------------------------------------ the element

class SfRichText extends FormField(RichTextElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: {attribute: 'root-class', default: ''},
    };
  }

  constructor() {
    super();
    this._loaded = false;
    this._loadedAttribute = null;
    this._history = [];
    this._historyIndex = -1;
    this._lastTyping = 0;
    this._muted = false;
    this._dispatching = false;
    this._roving = 'paragraph';
    this._state = {canUndo: false, canRedo: false};
    this._lastSelection = null;
    this._committed = '';
    this._link = {value: '', error: '', existing: false, selection: null, pending: null, placement: 'bottom-start'};
    this._dragFromSelf = false;
  }

  // ---------------------------------------------------------- settings

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-rich-text');
  }

  get effectiveDisabled() {
    return Boolean(this.disabled || this.sfFormDisabled);
  }

  get editor() {
    return this.querySelector('.sf-rich-text-editor');
  }

  /** The value: the subset's HTML, "" when there is no text. */
  get value() {
    const editor = this.editor;
    if (editor && this._loaded) return sanitizeRichText(editor, {mode: 'value'});
    return sanitizeRichText(this.getAttribute('value') || '', {mode: 'value'});
  }

  set value(next) {
    const clean = sanitizeRichText(next === null || next === undefined ? '' : String(next), {mode: 'value'});
    if (next === null || next === undefined) this.removeAttribute('value');
    else this.setAttribute('value', clean);
    this._load(clean);
    this.sfSyncFormState();
  }

  focusDelegate() {
    return this.editor;
  }

  // ---------------------------------------------------------- form

  fieldValidity() {
    const missing = Boolean(this.required) && !this.effectiveDisabled && this.value === '';
    return {valueMissing: missing, message: missing ? this.sfWord('value-missing') : '', anchor: this.editor};
  }

  // form.reset(): the default back, without events.
  fieldReset() {
    this._load(this.getAttribute('value') || '');
  }

  fieldRestore(state) {
    if (typeof state === 'string') this.value = state;
  }

  // ---------------------------------------------------------- drawing

  templateContext() {
    const props = this.getPropsContext();
    return this.createTemplateContext({
      ...props,
      size: this.size,
      appearance: this.appearance,
      // The form's disabled fieldset counts too, so the drawn state is not the
      // `disabled` getter's: it travels under its own name.
      fieldDisabled: this.effectiveDisabled,
      value: this.value,
      readonly: Boolean(this.readonly),
      required: Boolean(this.required),
      invalid: Boolean(this.invalid),
      rows: this.rows,
      maxRows: this.maxRows,
      tools: this.toolList(),
      state: this._state,
      roving: this._roving,
      linkValue: this._link.value,
      linkError: this._link.error,
      linkExisting: this._link.existing,
      linkPlacement: this._link.placement,
      ariaLabel: this.getAttribute('aria-label') || '',
      component: this,
    });
  }

  get rows() {
    const value = Math.trunc(this.getNumberAttr('rows', 6));
    return value > 0 ? value : 6;
  }

  get maxRows() {
    const value = Math.trunc(this.getNumberAttr('maxRows', 0));
    return value > 0 ? Math.max(value, this.rows) : null;
  }

  // The shortcut in the tooltip names both keyboards, so the markup is the
  // same on every platform (and in the first-paint snapshot).
  toolList() {
    return TOOLS.map((tool) => ({...tool, keys: tool.key ? `Ctrl+${tool.key} / \u2318${tool.key}` : ''}));
  }

  template() {
    return renderRichTextTemplate(this.templateContext());
  }

  onConnected() {
    const signal = this.sfScope;
    this.ownerDocument.addEventListener('selectionchange', () => this._onSelectionChange(), {signal});
    this.addEventListener('sf-popover-open', (event) => this._onLinkOpen(event), {signal});
    this.addEventListener('sf-popover-opened', () => this._onLinkOpened(), {signal});
    this.addEventListener('sf-popover-closed', (event) => this._onLinkClosed(event), {signal});
  }

  afterRender() {
    const editor = this.editor;
    if (!editor) return;
    if (editor.__sfRichText !== this) this._bindEditor(editor);
    const attribute = this.getAttribute('value') ?? '';
    if (!this._loaded || attribute !== this._loadedAttribute) this._load(attribute);
    this._syncEmpty();
    this.sfSyncFormState();
  }

  _bindEditor(editor) {
    editor.__sfRichText = this;
    const signal = this.sfScope;
    const on = (type, handler) => editor.addEventListener(type, handler, {signal});
    on('beforeinput', (event) => this._onBeforeInput(event));
    on('input', (event) => this._onInput(event));
    on('compositionend', () => this._afterTyping('insertCompositionText'));
    on('keydown', (event) => this._onKeydown(event));
    on('paste', (event) => this._onPaste(event));
    on('dragstart', () => { this._dragFromSelf = true; });
    on('dragend', () => { this._dragFromSelf = false; });
    on('drop', (event) => this._onDrop(event));
    on('focus', () => {
      try {
        this.ownerDocument.execCommand('defaultParagraphSeparator', false, 'p');
      } catch {
        // A browser without the command keeps its own; the cleaner wraps it.
      }
    });
  }

  // ---------------------------------------------------------- loading

  // Puts a value on the surface, cleaned, and starts the history there. Says
  // nothing: a value set from code, a reset and a restore are not edits.
  _load(html) {
    const editor = this.editor;
    if (!editor) return;
    editor.innerHTML = sanitizeRichText(String(html ?? ''), {mode: 'editor'});
    this._loaded = true;
    this._loadedAttribute = this.getAttribute('value') ?? '';
    this._history = [{html: editor.innerHTML, selection: null}];
    this._historyIndex = 0;
    this._lastTyping = 0;
    this._committed = this.value;
    this._syncEmpty();
    this._updateState();
  }

  _syncEmpty() {
    const editor = this.editor;
    if (!editor) return;
    const empty = editor.textContent === '' && editor.children.length <= 1 && !editor.querySelector('li, blockquote, h2, h3, h4');
    editor.toggleAttribute('data-empty', empty);
  }

  // ---------------------------------------------------------- selection

  _range() {
    const selection = this.ownerDocument.getSelection();
    const editor = this.editor;
    if (!selection?.rangeCount || !editor) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.startContainer) && editor.contains(range.endContainer) ? range : null;
  }

  _saveSelection() {
    const range = this._range();
    const editor = this.editor;
    if (!range || !editor) return null;
    return {
      start: offsetOf(editor, range.startContainer, range.startOffset),
      end: offsetOf(editor, range.endContainer, range.endOffset),
    };
  }

  _restoreSelection(saved) {
    const editor = this.editor;
    if (!saved || !editor) return;
    const doc = this.ownerDocument;
    const range = doc.createRange();
    const [startNode, startOffset] = pointAt(editor, saved.start);
    const [endNode, endOffset] = pointAt(editor, saved.end ?? saved.start);
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = doc.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  _onSelectionChange() {
    if (!this._range()) return;
    this._lastSelection = this._saveSelection();
    this._updateState();
  }

  _within(node, selector) {
    const editor = this.editor;
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    const found = element?.closest?.(selector);
    return found && found !== editor && editor?.contains(found) ? found : null;
  }

  // The node the selection's format is read from: where a caret stands, or
  // the first text a selection covers (a selection that starts at the end of
  // one text node is about the next).
  _startNode(range) {
    if (!range) return null;
    const container = range.startContainer;
    if (!range.collapsed) {
      const walker = this.ownerDocument.createTreeWalker(range.commonAncestorContainer, 4);
      let node = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer : walker.nextNode();
      for (; node; node = walker.nextNode()) {
        if (!range.intersectsNode(node)) continue;
        if (node === range.startContainer && range.startOffset >= node.data.length) continue;
        if (node === range.endContainer && range.endOffset === 0) continue;
        if (node.data.length) return node;
      }
    }
    if (container.nodeType === 1) return container.childNodes[range.startOffset] || container;
    return container;
  }

  _updateState() {
    const range = this._range();
    const node = this._startNode(range);
    const command = (name) => {
      try {
        return Boolean(range?.collapsed && this.ownerDocument.queryCommandState?.(name));
      } catch {
        return false;
      }
    };
    const block = node ? this._within(node, 'p, h2, h3, h4, li') : null;
    const item = node ? this._within(node, 'li') : null;
    const next = {
      p: block?.localName === 'p',
      h2: block?.localName === 'h2',
      h3: block?.localName === 'h3',
      h4: block?.localName === 'h4',
      strong: Boolean(node && this._within(node, 'strong, b')) || command('bold'),
      em: Boolean(node && this._within(node, 'em, i')) || command('italic'),
      link: Boolean(node && this._within(node, 'a')),
      ul: item?.parentElement?.localName === 'ul',
      ol: item?.parentElement?.localName === 'ol',
      blockquote: Boolean(node && this._within(node, 'blockquote')),
      inList: Boolean(item),
      canUndo: this._historyIndex > 0,
      canRedo: this._historyIndex < this._history.length - 1,
    };
    const changed = Object.keys(next).some((key) => next[key] !== this._state[key]);
    this._state = next;
    if (changed) this.requestComponentUpdate('selection');
  }

  // ---------------------------------------------------------- cleaning

  // The surface through the cleaner; rewritten only when cleaning changed
  // it, with the caret kept in its place.
  _clean(selection = this._saveSelection()) {
    const editor = this.editor;
    if (!editor) return;
    const clean = sanitizeRichText(editor, {mode: 'editor'});
    if (clean !== editor.innerHTML) {
      editor.innerHTML = clean;
      if (selection) this._restoreSelection(selection);
    }
    this._syncEmpty();
  }

  _record({typing = false} = {}) {
    const editor = this.editor;
    if (!editor) return;
    const html = editor.innerHTML;
    const selection = this._saveSelection();
    const now = Date.now();
    const top = this._history[this._historyIndex];
    if (top && top.html === html) {
      top.selection = selection;
      return;
    }
    const grouped = typing && this._lastTyping && now - this._lastTyping < TYPING_GROUP_MS
      && this._historyIndex > 0 && this._historyIndex === this._history.length - 1;
    if (grouped) {
      this._history[this._historyIndex] = {html, selection};
    } else {
      this._history.splice(this._historyIndex + 1);
      this._history.push({html, selection});
      if (this._history.length > HISTORY_LIMIT) this._history.shift();
      this._historyIndex = this._history.length - 1;
    }
    this._lastTyping = typing ? now : 0;
  }

  _say(inputType) {
    const editor = this.editor;
    if (!editor) return;
    this._dispatching = true;
    try {
      const InputEventClass = globalThis.InputEvent || globalThis.Event;
      editor.dispatchEvent(new InputEventClass('input', {bubbles: true, composed: true, inputType}));
    } finally {
      this._dispatching = false;
    }
  }

  // An edit the component makes: run it on the person's selection, clean the
  // result, keep the caret, record it and say input once.
  _edit(change, inputType, {selection = 'before'} = {}) {
    const editor = this.editor;
    if (!editor || this.effectiveDisabled || this.readonly) return false;
    const doc = this.ownerDocument;
    const returnTo = doc.activeElement && doc.activeElement !== editor && this.contains(doc.activeElement) ? doc.activeElement : null;
    // From the toolbar by the keyboard: the text takes focus for the command
    // and the selection the person left in it comes back.
    if (doc.activeElement !== editor) {
      editor.focus({preventScroll: true});
      if (this._lastSelection) this._restoreSelection(this._lastSelection);
    }
    if (!this._range()) this._restoreSelection(this._lastSelection ?? {start: 0, end: 0});
    const before = editor.innerHTML;
    const saved = selection === 'before' ? this._saveSelection() : null;
    this._muted = true;
    try {
      change();
    } catch (error) {
      this.reportComponentError(error, `edit ${inputType}`);
    } finally {
      this._muted = false;
    }
    this._clean(selection === 'before' ? saved : this._saveSelection());
    if (selection === 'before' && saved) this._restoreSelection(saved);
    this._lastSelection = this._saveSelection();
    if (editor.innerHTML !== before) {
      this._record();
      this._say(inputType);
    }
    this._updateState();
    returnTo?.focus?.({preventScroll: true});
    return true;
  }

  // ---------------------------------------------------------- typing

  _onBeforeInput(event) {
    if (this._muted) return;
    switch (event.inputType) {
      case 'historyUndo':
        event.preventDefault();
        this.undo();
        return;
      case 'historyRedo':
        event.preventDefault();
        this.redo();
        return;
      case 'formatBold':
        event.preventDefault();
        this.runCommand('bold');
        return;
      case 'formatItalic':
        event.preventDefault();
        this.runCommand('italic');
        return;
      default:
        // No other format is in the subset: underline, strike, colours,
        // alignment and indent are refused rather than cleaned away later.
        if (String(event.inputType).startsWith('format')) event.preventDefault();
    }
  }

  _onInput(event) {
    // The browser's own input while a command runs: the command says input
    // once, after cleaning.
    if (this._muted) {
      event.stopImmediatePropagation();
      return;
    }
    if (this._dispatching) return;
    if (event.isComposing) return;
    this._afterTyping(event.inputType);
  }

  _afterTyping(inputType = '') {
    this._clean();
    this._record({typing: /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/u.test(inputType)});
    this._lastSelection = this._saveSelection();
    this._updateState();
  }

  _onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    const run = (command) => {
      event.preventDefault();
      this.runCommand(command);
    };
    if (key === 'b' && !event.shiftKey) run('bold');
    else if (key === 'i' && !event.shiftKey) run('italic');
    else if (key === 'k' && !event.shiftKey) run('link');
    else if (key === 'z' && event.shiftKey) run('redo');
    else if (key === 'z') run('undo');
    else if (key === 'y') run('redo');
  }

  // ---------------------------------------------------------- paste and drop

  _cleanTransfer(data) {
    const html = data?.getData?.('text/html') || '';
    if (html) return sanitizeRichText(html, {mode: 'value'});
    return richTextFromPlainText(data?.getData?.('text/plain') || '', {mode: 'value'});
  }

  // Cleaned HTML in place of the selection: the first paragraph joins the
  // text at the caret, what follows stands as blocks (the cleaner splits the
  // paragraph around them, so the text after the caret follows the last).
  _insertClean(clean, inputType) {
    if (!clean) return;
    this._edit(() => {
      const range = this._range();
      if (!range) return;
      const doc = this.ownerDocument;
      range.deleteContents();
      // An empty line's <br> is the caret's place holder, not content.
      const block = this._within(range.startContainer, 'p, h2, h3, h4, li');
      if (block && block.textContent === '' && !block.querySelector('ul, ol')) {
        block.replaceChildren();
        range.setStart(block, 0);
        range.collapse(true);
      }
      const template = doc.createElement('template');
      // The string is the subset's own output: nothing in it runs or loads.
      template.innerHTML = clean;
      const nodes = [...template.content.childNodes];
      const fragment = doc.createDocumentFragment();
      nodes.forEach((node, index) => {
        if (index === 0 && node.localName === 'p') fragment.append(...node.childNodes);
        else fragment.append(node);
      });
      const last = fragment.lastChild;
      if (!last) return;
      range.insertNode(fragment);
      const after = doc.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      const selection = doc.getSelection();
      selection.removeAllRanges();
      selection.addRange(after);
    }, inputType, {selection: 'after'});
  }

  _onPaste(event) {
    event.preventDefault();
    if (this.effectiveDisabled || this.readonly) return;
    this._insertClean(this._cleanTransfer(event.clipboardData), 'insertFromPaste');
  }

  _onDrop(event) {
    // A move inside the editor is the browser's; its result is cleaned as
    // typing is.
    if (this._dragFromSelf) return;
    event.preventDefault();
    if (this.effectiveDisabled || this.readonly) return;
    const doc = this.ownerDocument;
    const editor = this.editor;
    let range = null;
    if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(event.clientX, event.clientY);
    else if (doc.caretPositionFromPoint) {
      const position = doc.caretPositionFromPoint(event.clientX, event.clientY);
      if (position) {
        range = doc.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    editor.focus({preventScroll: true});
    if (range && editor.contains(range.startContainer)) {
      const selection = doc.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    this._insertClean(this._cleanTransfer(event.dataTransfer), 'insertFromDrop');
  }

  // ---------------------------------------------------------- commands

  /**
   * Runs a toolbar command on the current selection: paragraph, heading-2,
   * heading-3, heading-4, bold, italic, link, bulleted-list, numbered-list,
   * quote, undo, redo. Answers whether it ran.
   */
  runCommand(id) {
    if (this.effectiveDisabled || this.readonly) return false;
    if (BLOCK_TAGS[id]) return this._edit(() => this._setBlock(BLOCK_TAGS[id]), 'formatBlock');
    if (id === 'bold') return this._edit(() => this._toggleMark('bold', 'strong'), 'formatBold');
    if (id === 'italic') return this._edit(() => this._toggleMark('italic', 'em'), 'formatItalic');
    if (id === 'bulleted-list') return this._edit(() => this._toggleList('ul'), 'insertUnorderedList');
    if (id === 'numbered-list') return this._edit(() => this._toggleList('ol'), 'insertOrderedList');
    if (id === 'quote') return this._edit(() => this._toggleQuote(), 'formatBlock');
    if (id === 'undo') return this.undo();
    if (id === 'redo') return this.redo();
    if (id === 'link') return this.openLink();
    return false;
  }

  undo() {
    if (this._historyIndex <= 0) return false;
    this._historyIndex -= 1;
    this._applyHistory('historyUndo');
    return true;
  }

  redo() {
    if (this._historyIndex >= this._history.length - 1) return false;
    this._historyIndex += 1;
    this._applyHistory('historyRedo');
    return true;
  }

  _applyHistory(inputType) {
    const editor = this.editor;
    const entry = this._history[this._historyIndex];
    if (!editor || !entry) return;
    editor.innerHTML = entry.html;
    if (this.ownerDocument.activeElement !== editor && !this.contains(this.ownerDocument.activeElement)) editor.focus({preventScroll: true});
    if (entry.selection) this._restoreSelection(entry.selection);
    this._lastTyping = 0;
    this._lastSelection = entry.selection;
    this._syncEmpty();
    this._say(inputType);
    this._updateState();
  }

  _selectedBlocks() {
    const editor = this.editor;
    const range = this._range();
    if (!editor || !range) return [];
    const all = [...editor.querySelectorAll('p, h2, h3, h4, li')].filter((block) => range.intersectsNode(block));
    return all.filter((block) => !all.some((other) => other !== block && block.contains(other)));
  }

  _setBlock(tag) {
    const blocks = this._selectedBlocks().filter((block) => block.localName !== 'li');
    const target = tag !== 'p' && blocks.length && blocks.every((block) => block.localName === tag) ? 'p' : tag;
    for (const block of blocks) {
      if (block.localName === target) continue;
      const next = this.ownerDocument.createElement(target);
      next.append(...block.childNodes);
      block.replaceWith(next);
    }
  }

  _toggleMark(command, tag) {
    const doc = this.ownerDocument;
    let done = false;
    try {
      done = doc.execCommand(command, false);
    } catch {
      done = false;
    }
    if (done) return;
    // Without the command: wrap the selection, or unwrap the mark it is in.
    const range = this._range();
    if (!range || range.collapsed) return;
    const startMark = this._within(range.startContainer, `${tag}, ${tag === 'strong' ? 'b' : 'i'}`);
    const endMark = this._within(range.endContainer, `${tag}, ${tag === 'strong' ? 'b' : 'i'}`);
    if (startMark && startMark === endMark) {
      startMark.replaceWith(...startMark.childNodes);
      return;
    }
    const fragment = range.extractContents();
    fragment.querySelectorAll(`${tag}, ${tag === 'strong' ? 'b' : 'i'}`).forEach((mark) => mark.replaceWith(...mark.childNodes));
    const mark = doc.createElement(tag);
    mark.append(fragment);
    range.insertNode(mark);
  }

  _toggleList(type) {
    const doc = this.ownerDocument;
    const blocks = this._selectedBlocks();
    if (!blocks.length) return;
    const items = blocks.filter((block) => block.localName === 'li');
    if (items.length === blocks.length && items.every((item) => item.parentElement?.localName === type)) {
      // Off: the items become paragraphs, the list split around them.
      for (const item of items) {
        const list = item.parentElement;
        const after = [];
        for (let next = item.nextSibling; next; next = next.nextSibling) after.push(next);
        if (after.length) {
          const tail = doc.createElement(list.localName);
          tail.append(...after);
          list.after(tail);
        }
        const paragraph = doc.createElement('p');
        const nested = [...item.children].filter((child) => child.localName === 'ul' || child.localName === 'ol');
        nested.forEach((child) => child.remove());
        paragraph.append(...item.childNodes);
        list.after(paragraph, ...nested);
        item.remove();
        if (!list.children.length) list.remove();
      }
      return;
    }
    if (items.length === blocks.length) {
      // The other kind of list: the lists change kind.
      for (const list of new Set(items.map((item) => item.parentElement))) {
        if (list.localName === type) continue;
        const next = doc.createElement(type);
        next.append(...list.childNodes);
        list.replaceWith(next);
      }
      return;
    }
    for (const block of blocks) {
      if (block.localName === 'li') continue;
      const item = doc.createElement('li');
      item.append(...block.childNodes);
      const previous = block.previousElementSibling;
      if (previous?.localName === type) {
        previous.append(item);
      } else {
        const list = doc.createElement(type);
        list.append(item);
        block.before(list);
      }
      block.remove();
    }
  }

  _toggleQuote() {
    const editor = this.editor;
    const blocks = this._selectedBlocks();
    if (!blocks.length) return;
    const quotes = blocks.map((block) => this._within(block, 'blockquote'));
    if (quotes.every(Boolean)) {
      for (const quote of new Set(quotes)) quote.replaceWith(...quote.childNodes);
      return;
    }
    const top = (node) => {
      let current = node;
      while (current.parentElement && current.parentElement !== editor) current = current.parentElement;
      return current;
    };
    const first = top(blocks[0]);
    const last = top(blocks[blocks.length - 1]);
    const quote = this.ownerDocument.createElement('blockquote');
    first.before(quote);
    for (let node = first; node;) {
      const next = node.nextSibling;
      quote.append(node);
      if (node === last) break;
      node = next;
    }
  }

  // ---------------------------------------------------------- links

  _popover() {
    return this.querySelector('.sf-rich-text-link');
  }

  /** Opens the link editor on the selection (Mod+K, the link button). */
  openLink() {
    if (this.effectiveDisabled || this.readonly) return false;
    const popover = this._popover();
    if (!popover?.show) return false;
    popover.show();
    return true;
  }

  _onLinkOpen(event) {
    if (event.target !== this._popover()) return;
    if (this.effectiveDisabled || this.readonly) {
      event.preventDefault();
      return;
    }
    if (!this._range() && this._lastSelection) {
      this.editor?.focus({preventScroll: true});
      this._restoreSelection(this._lastSelection);
    }
    const range = this._range();
    const anchor = range ? this._within(range.startContainer, 'a') : null;
    // The editor hangs from the side of the button with room for it: the
    // popover places, it does not move a surface back into the window.
    const popover = this._popover();
    const button = popover?.querySelector('[data-sf-tool="link"]');
    const box = button?.getBoundingClientRect();
    const width = this.ownerDocument.documentElement.clientWidth;
    const room = parseFloat(globalThis.getComputedStyle?.(this.ownerDocument.documentElement).fontSize || '16') * 20;
    const placement = box && box.left + room > width && box.right - room >= 0 ? 'bottom-end' : 'bottom-start';
    popover?.setAttribute('placement', placement);
    this._link = {
      value: anchor?.getAttribute('href') || '',
      error: '',
      existing: Boolean(anchor),
      selection: this._saveSelection() ?? this._lastSelection,
      pending: null,
      placement,
    };
    this.requestComponentUpdate('link');
  }

  _onLinkOpened() {
    // After the popover shows its content and this element drew the field.
    requestAnimationFrame(() => {
      const input = this.querySelector('.sf-rich-text-link-input');
      const control = input?.querySelector('input') || input;
      control?.focus?.();
      control?.select?.();
    });
  }

  _linkInputValue() {
    const input = this.querySelector('.sf-rich-text-link-input');
    const control = input?.querySelector('input');
    return String(control?.value ?? input?.value ?? '');
  }

  applyLinkFromPanel() {
    const raw = this._linkInputValue().trim();
    const href = richTextHref(raw);
    if (!href) {
      this._link = {...this._link, value: raw, error: this.sfWord('link-invalid')};
      this.requestComponentUpdate('link');
      return false;
    }
    this._link = {...this._link, value: href, error: '', pending: {href}};
    this._popover()?.close?.({reason: 'api'});
    return true;
  }

  removeLinkFromPanel() {
    this._link = {...this._link, error: '', pending: {remove: true}};
    this._popover()?.close?.({reason: 'api'});
    return true;
  }

  onLinkPanelEvent(event) {
    // The address field's own input and change are not the field's.
    event.stopPropagation();
    if (event.type === 'input' && this._link.error) {
      this._link = {...this._link, error: ''};
      this.requestComponentUpdate('link');
    }
  }

  onLinkPanelKeydown(event) {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      this.applyLinkFromPanel();
    }
  }

  _onLinkClosed(event) {
    if (event.target !== this._popover()) return;
    const reason = event.detail?.reason;
    const {pending, selection} = this._link;
    this._link = {value: '', error: '', existing: false, selection: null, pending: null, placement: this._link.placement};
    this.requestComponentUpdate('link');
    // A press outside belongs to wherever it landed.
    if (reason === 'outside') return;
    // The popover gives focus back to its trigger as it closes; the person
    // goes on typing, so the caret goes back to the text after that.
    setTimeout(() => {
      const editor = this.editor;
      if (!editor) return;
      editor.focus({preventScroll: true});
      if (selection) this._restoreSelection(selection);
      if (pending?.href) this._edit(() => this._setLink(pending.href), 'insertLink', {selection: 'after'});
      else if (pending?.remove) this._edit(() => this._removeLink(), 'insertLink');
    }, 0);
  }

  _setLink(href) {
    const doc = this.ownerDocument;
    const range = this._range();
    if (!range) return;
    const anchor = this._within(range.startContainer, 'a');
    if (anchor) {
      anchor.setAttribute('href', href);
      const after = doc.createRange();
      after.selectNodeContents(anchor);
      after.collapse(false);
      doc.getSelection().removeAllRanges();
      doc.getSelection().addRange(after);
      return;
    }
    const link = doc.createElement('a');
    link.setAttribute('href', href);
    if (range.collapsed) {
      link.textContent = href.replace(/^(mailto|tel):/u, '');
    } else {
      const fragment = range.extractContents();
      fragment.querySelectorAll('a').forEach((inner) => inner.replaceWith(...inner.childNodes));
      link.append(fragment);
    }
    range.insertNode(link);
    const after = doc.createRange();
    after.setStartAfter(link);
    after.collapse(true);
    doc.getSelection().removeAllRanges();
    doc.getSelection().addRange(after);
  }

  _removeLink() {
    const range = this._range();
    const anchor = range ? this._within(range.startContainer, 'a') : null;
    if (anchor) anchor.replaceWith(...anchor.childNodes);
  }

  // ---------------------------------------------------------- toolbar

  _tools() {
    return [...this.querySelectorAll('.sf-rich-text-toolbar button.sf-rich-text-tool:not([disabled])')];
  }

  _setRoving(button) {
    if (!button) return;
    this._roving = button.dataset.sfTool;
    for (const other of this.querySelectorAll('.sf-rich-text-toolbar button.sf-rich-text-tool')) {
      other.setAttribute('tabindex', other === button ? '0' : '-1');
    }
  }

  onToolbarKeydown(event) {
    const button = event.target?.closest?.('button.sf-rich-text-tool');
    if (!button) return;
    const tools = this._tools();
    const index = tools.indexOf(button);
    if (index < 0) return;
    let next = null;
    if (event.key === 'ArrowRight') next = tools[(index + 1) % tools.length];
    else if (event.key === 'ArrowLeft') next = tools[(index - 1 + tools.length) % tools.length];
    else if (event.key === 'Home') next = tools[0];
    else if (event.key === 'End') next = tools[tools.length - 1];
    if (!next) return;
    event.preventDefault();
    this._setRoving(next);
    next.focus();
  }

  onToolbarFocusIn(event) {
    const button = event.target?.closest?.('button.sf-rich-text-tool');
    if (button) this._setRoving(button);
  }

  // A press on a tool keeps the caret and the selection in the text.
  onToolbarMouseDown(event) {
    if (event.target?.closest?.('button.sf-rich-text-tool')) event.preventDefault();
  }

  onToolbarClick(event) {
    const button = event.target?.closest?.('button.sf-rich-text-tool');
    if (!button || button.disabled) return;
    const id = button.dataset.sfTool;
    this._setRoving(button);
    // The link button is the popover's trigger: the popover opens itself.
    if (id === 'link') return;
    if (button.getAttribute('aria-disabled') === 'true') return;
    this.runCommand(id);
  }

  // ---------------------------------------------------------- focus and change

  onRootPointerDown(event) {
    if (event.target?.closest?.('.sf-rich-text-editor')) this.querySelector('.sf-rich-text')?.classList.add('sf-rich-text--pointer-focus');
  }

  // Leaving the field with a changed value is change, once, as a textarea
  // says it; moving between the toolbar, the link editor and the text is not.
  onRootFocusOut(event) {
    const next = event.relatedTarget;
    if (next && this.contains(next)) return;
    this.querySelector('.sf-rich-text')?.classList.remove('sf-rich-text--pointer-focus');
    const value = this.value;
    if (value === this._committed) return;
    this._committed = value;
    this.editor?.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
  }
}

SfRichText.define('sf-rich-text');

export default SfRichText;
