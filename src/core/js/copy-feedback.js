// What a copy says (owner decision C48, 2026-11-11): one feedback for every
// control that copies -- sf-button-copy, and any <button>, sf-button or
// sf-button-icon that carries data-sf-copy or data-sf-copy-target (the
// clipboard component's attribute route). Beside SF.copyText, which copies,
// this says how it went:
//
// - copied: the phase is success for two seconds (the icon a check), and the
//   word "Скопировано" is said politely;
// - refused by the browser (a policy, an embedded frame, a denied permission):
//   the source is selected -- a field's value, an element's text, or the value
//   itself in a hidden holder -- and the words say which keys copy it
//   ("Выделено — нажмите Ctrl+C"), so the copy is never simply lost;
// - nothing to copy (no source, a missing target, two sources): the phase is
//   error and the words say it could not copy.
//
// The helper keeps the phase, the timer and the words; the control draws them
// (sf-button-copy in its template, the attribute route in the page's markup).
// Core cannot import a Smart component's files, so the words are written here
// as sf-button-copy ships them and are read through the page's language under
// that component's name (a product that registers words for sf-button-copy is
// heard here too); tests/inline-code.contract.test.mjs and
// tests/copy-feedback.contract.test.mjs hold them equal to its language files.
import {copyText} from './clipboard.js';
import {pageWord} from './page-language.js';

export const WORDS = {
  en: {copy: 'Copy', copied: 'Copied', failed: 'Could not copy', selected: 'Selected — press {keys}'},
  ru: {copy: 'Копировать', copied: 'Скопировано', failed: 'Не удалось скопировать', selected: 'Выделено — нажмите {keys}'},
};

/** How long a result stays, in ms, unless the control says otherwise. */
export const DURATION = 2000;

/** The failures that are the source's, not the browser's: nothing is selected for them. */
export const SOURCE_ERRORS = new Set(['ambiguous_source', 'empty_source', 'missing_source', 'missing_target']);

const HOLDER_STYLE = 'position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

const isField = (element, View) => Boolean(element) && ((View.HTMLInputElement && element instanceof View.HTMLInputElement)
  || (View.HTMLTextAreaElement && element instanceof View.HTMLTextAreaElement));

// The keys copy what the button would have copied (acceptance L3,
// 2026-11-11): a selected element gives the browser its drawn text, and a
// numbered code block draws an empty line as a space, so the keys copied a
// space where the button copies an empty line. While the selection is the
// one made here, the copy event is given the text instead. One listener per
// document, on the document itself, so every bundle's copy of this module
// shares it.
function keepCopyText(doc, range, text) {
  doc.__sfCopySelection = {range, text};
  if (doc.__sfCopyListener) return;
  doc.__sfCopyListener = (event) => {
    const held = doc.__sfCopySelection;
    const selection = doc.defaultView?.getSelection?.();
    if (!held || !selection?.rangeCount) return;
    const now = selection.getRangeAt(0);
    const same = now.startContainer === held.range.startContainer && now.startOffset === held.range.startOffset
      && now.endContainer === held.range.endContainer && now.endOffset === held.range.endOffset;
    if (!same) {
      doc.__sfCopySelection = null;
      return;
    }
    event.clipboardData?.setData('text/plain', held.text);
    event.preventDefault();
  };
  doc.addEventListener('copy', doc.__sfCopyListener, true);
}

// One result at a time on the page (acceptance L4): two neighbouring controls
// that fail within the result's two seconds drew their words on top of each
// other, both held to the window's edge. A control that shows a result tells
// the one before it to stop. On the page's SF, so every bundle shares it.
function takeResult(owner) {
  const SF = (globalThis.SF = globalThis.SF || {});
  const before = SF.__copyResult;
  SF.__copyResult = owner;
  if (before && before !== owner) before.reset();
}

function leaveResult(owner) {
  if (globalThis.SF?.__copyResult === owner) globalThis.SF.__copyResult = null;
}

/** The keys that copy a selection on this platform. */
export function copyKeys() {
  return /Mac|iPhone|iPad/u.test(globalThis.navigator?.platform ?? globalThis.navigator?.userAgent ?? '') ? '⌘C' : 'Ctrl+C';
}

/** A copy word in the language of `node` (sf-button-copy's words). */
export function copyWord(key, node, vars) {
  return pageWord(WORDS, key, node, {component: 'sf-button-copy', source: 'ru', vars});
}

/**
 * The text an element gives to copy, whole: a field's value; a numbered code
 * block's code, one line per row and none of the numbers (Highlight
 * data-lines); else the element's text.
 */
export function readCopyText(element) {
  if (!element) return '';
  const View = element.ownerDocument?.defaultView ?? globalThis;
  if ((View.HTMLInputElement && element instanceof View.HTMLInputElement)
    || (View.HTMLTextAreaElement && element instanceof View.HTMLTextAreaElement)) return element.value;
  const rows = element.querySelectorAll?.(':scope .sf-code-lines > .sf-code-line > .sf-code-line__content');
  // An empty line is drawn as a space so its row keeps a height; it copies empty.
  if (rows?.length) return Array.from(rows, (row) => (row.textContent === ' ' ? '' : row.textContent)).join('\n');
  return element.textContent ?? '';
}

/**
 * Selects what was to be copied, so the person can press the keys: the field
 * (focused and selected), the element's contents, or -- for a value with no
 * element on the page -- `text` in a hidden holder inside `host`.
 */
export function selectCopySource(element, {text = '', host = null, holderClass = 'sf-copy-holder', document: doc = element?.ownerDocument ?? host?.ownerDocument ?? globalThis.document} = {}) {
  const View = doc?.defaultView ?? globalThis;
  if (isField(element, View)) {
    element.focus();
    element.select();
    return element;
  }
  const selection = View.getSelection?.();
  if (!selection || !doc) return null;
  let node = element;
  if (!node) {
    if (!host || !text) return null;
    node = [...host.children].find((child) => child.classList?.contains(holderClass));
    if (!node) {
      node = doc.createElement('span');
      node.className = holderClass;
      node.style.cssText = HOLDER_STYLE;
      host.append(node);
    }
    node.textContent = text;
  }
  selection.removeAllRanges();
  const range = doc.createRange();
  range.selectNodeContents(node);
  selection.addRange(range);
  keepCopyText(doc, range, element ? readCopyText(element) : text);
  return node;
}

/**
 * One control's feedback. `onPhase(phase, message)` is told every change:
 * pending, success, error, and idle again after `duration` ms (a number or a
 * function answering one). `run()` copies and settles with the outcome:
 * {outcome: 'applied', text, method} or {outcome: 'refused', reason, error},
 * the reason one of SOURCE_ERRORS, 'denied' or 'busy'.
 */
export function createCopyFeedback({onPhase = () => {}, duration = DURATION} = {}) {
  let timer = null;
  let pending = false;
  let api = null;
  const lasting = () => {
    const value = Number(typeof duration === 'function' ? duration() : duration);
    return Number.isFinite(value) && value >= 0 ? value : DURATION;
  };
  const set = (phase, message = '') => {
    clearTimeout(timer);
    timer = null;
    if (phase === 'success' || phase === 'error') takeResult(api);
    else if (phase === 'idle') leaveResult(api);
    onPhase(phase, message);
    if (phase === 'success' || phase === 'error') {
      timer = setTimeout(() => {
        timer = null;
        leaveResult(api);
        onPhase('idle', '');
      }, lasting());
    }
  };
  api = {
    get pending() { return pending; },
    /**
     * `read()` answers the text (or throws a SOURCE_ERRORS code); `element()`
     * answers the element to select on a refusal, or null; `host` holds the
     * hidden holder for a value; `node` is where the language is read;
     * `words(key, vars)` overrides the words, `messages` the copied and failed
     * text a control was given.
     */
    async run({read, element = () => null, host = null, holderClass, node = host, document: doc, words, messages = {}} = {}) {
      if (pending) return {outcome: 'refused', reason: 'busy'};
      pending = true;
      const say = words || ((key, vars) => copyWord(key, node, vars));
      // The control the press came from: a refusal selects the source, and a
      // selection outside the focused control took the focus to the page, so
      // the next Tab started again at the top (acceptance M2).
      const page = doc ?? node?.ownerDocument ?? host?.ownerDocument ?? globalThis.document;
      const pressed = page?.activeElement && page.activeElement !== page.body ? page.activeElement : null;
      set('pending', '');
      let text = '';
      try {
        text = String(read?.() ?? '');
        if (!text) throw new Error('empty_source');
        const method = await copyText(text, {document: doc ?? node?.ownerDocument ?? globalThis.document});
        set('success', messages.copied || say('copied'));
        return {outcome: 'applied', text, method};
      } catch (error) {
        if (SOURCE_ERRORS.has(error?.message)) {
          set('error', messages.failed || say('failed'));
          return {outcome: 'refused', reason: error.message, error};
        }
        // Refused by the browser: the source is selected, so the keys copy it.
        const selected = selectCopySource(element?.() ?? null, {text, host, holderClass, document: doc});
        // A field takes the focus to be copied from; anything else gives it
        // back to the control, the selection staying (the keys still copy it).
        const View = page?.defaultView ?? globalThis;
        if (pressed?.isConnected && !isField(selected, View) && page.activeElement !== pressed) pressed.focus({preventScroll: true});
        set('error', say('selected', {keys: copyKeys()}));
        return {outcome: 'refused', reason: 'denied', error};
      } finally {
        pending = false;
      }
    },
    /** Back to idle now, without waiting for the timer. */
    reset() { set('idle', ''); },
    /** Stops the timer (the control is going away). */
    cancel() {
      clearTimeout(timer);
      timer = null;
      leaveResult(api);
    },
  };
  return api;
}

export const copyFeedback = {create: createCopyFeedback, readText: readCopyText, select: selectCopySource, words: copyWord};

// Core publishes it; a bundle that carries its own copy reuses the published one.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.copyFeedback) globalThis.SF.copyFeedback = copyFeedback;
}

export default createCopyFeedback;
