// Copy on click for code in running text (owner, 2026-11-07, docs review R024,
// rule C10). Opt-in, never the default: a container that carries
// data-sf-code-copy turns each word of code inside it into a copy control,
// as the Yandex Cloud docs do. data-sf-code-copy="false" on a part inside
// turns it off again for that part.
//
//   <article data-sf-code-copy>
//     <p>The event <code>sf-button-press</code> comes after the press.</p>
//   </article>
//
// Only the code the base sheet draws as code in running text is taken (the
// same exclusions as _sf_css__typograpy.scss): a <code> in a block of code
// (pre, the highlighter's surface), in kbd or samp, in a button, with an sf-
// class of its own or under a parent that has one stays as it is.
//
// A taken code is a button for the keyboard and for assistive technology:
// role=button, tabindex 0, an aria-label that says what is copied; Enter and
// Space copy, as a click does. A click that ends a text selection inside the
// code does not copy: the person was selecting.
//
// What sf-button-copy does, it does by the same means: the copy and its
// fallback are core's copyText (core/js/clipboard.js), and the words are
// sf-button-copy's, read through the page's language (page-language.js)
// under that component's name, so a word a product registers for
// sf-button-copy (SF.language.register) is said here too. Core cannot import
// a Smart component's files (core is what the Smart units depend on), so the
// words are written once in core, as sf-button-copy ships them
// (core/js/copy-feedback.js, decision C48);
// tests/inline-code.contract.test.mjs holds them equal to its language files.
// A refused copy selects the code and says which keys to press, as
// sf-button-copy does.
import {copyText} from './clipboard.js';
import {pageWord} from './page-language.js';
import {WORDS as COPY_WORDS, copyKeys} from './copy-feedback.js';

export const ATTRIBUTE = 'data-sf-code-copy';
export const TARGET = 'data-sf-code-copy-target';
const STATUS_CLASS = 'sf-code-copy-status';
// sf-button-copy's words, kept once in core/js/copy-feedback.js (decision C48).
export const WORDS = COPY_WORDS;
// The status stays as long as sf-button-copy's does by default.
const SHOWN_MS = 2000;
// Where a word of code is part of something else (the base sheet's list).
const NOT_PROSE = 'pre, kbd, samp, button, [role="button"], .sf-highlight, .sf-code-surface';

const word = (key, node, vars) => pageWord(WORDS, key, node, {component: 'sf-button-copy', source: 'ru', vars});

const classed = (element) => String(element?.getAttribute?.('class') ?? '').includes('sf-');

/** Whether this <code> is a copy control: running text inside an opted-in container. */
export function isCopyable(code) {
  if (!code || code.localName !== 'code') return false;
  const box = code.closest(`[${ATTRIBUTE}]`);
  if (!box || box.getAttribute(ATTRIBUTE) === 'false') return false;
  const parent = code.parentElement;
  if (!parent || classed(code) || classed(parent)) return false;
  return !parent.closest(NOT_PROSE);
}

const keys = copyKeys;

function mark(code) {
  code.setAttribute(TARGET, '');
  if (!code.hasAttribute('role')) code.setAttribute('role', 'button');
  if (!code.hasAttribute('tabindex')) code.setAttribute('tabindex', '0');
  code.setAttribute('aria-label', `${word('copy', code)}: ${code.textContent ?? ''}`);
}

function unmark(code) {
  code.removeAttribute(TARGET);
  if (code.getAttribute('role') === 'button') code.removeAttribute('role');
  if (code.getAttribute('tabindex') === '0') code.removeAttribute('tabindex');
  code.removeAttribute('aria-label');
}

/** Marks the code under `root` that should copy and unmarks the code that no longer should. */
export function refresh(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const codes = root.localName === 'code' ? [root] : [...root.querySelectorAll('code')];
  for (const code of codes) {
    const wanted = isCopyable(code);
    if (wanted) mark(code);
    else if (code.hasAttribute(TARGET)) unmark(code);
  }
}

// One status per host: the page, or the open dialog or popover the code is
// in (a fixed element under <body> would be drawn under the top layer). It is
// made before anything is said into it, so the polite announcement is heard.
function statusFor(code) {
  const host = code.closest('dialog[open], [popover]') ?? code.ownerDocument.body;
  let status = [...host.children].find((child) => child.classList?.contains(STATUS_CLASS));
  if (!status) {
    status = code.ownerDocument.createElement('span');
    status.className = STATUS_CLASS;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    host.append(status);
  }
  return status;
}

// Above the code, centred on it, or below it when there is no room above.
// The sheet draws the box from its anchor point (translate -50% -100% and the
// gap as a negative margin); it is measured again after placing, because
// inside a transformed ancestor a fixed box is placed against that ancestor,
// and the difference is what it moved by.
function place(status, code) {
  const target = code.getBoundingClientRect();
  const centre = target.left + target.width / 2;
  status.style.left = `${centre}px`;
  status.style.top = `${target.top}px`;
  status.removeAttribute('data-below');
  let drawn = status.getBoundingClientRect();
  if (drawn.top < 0) {
    status.setAttribute('data-below', '');
    status.style.top = `${target.bottom}px`;
    drawn = status.getBoundingClientRect();
  }
  const gap = Math.abs(parseFloat(globalThis.getComputedStyle?.(status).marginTop) || 0);
  const below = status.hasAttribute('data-below');
  const dx = centre - (drawn.left + drawn.width / 2);
  const dy = below ? target.bottom + gap - drawn.top : target.top - gap - drawn.bottom;
  if (Math.abs(dx) > 0.5) status.style.left = `${parseFloat(status.style.left) + dx}px`;
  if (Math.abs(dy) > 0.5) status.style.top = `${parseFloat(status.style.top) + dy}px`;
}

function say(code, text, state) {
  const status = statusFor(code);
  status.textContent = text;
  status.dataset.state = state;
  status.setAttribute('data-shown', '');
  place(status, code);
  clearTimeout(status._sfTimer);
  status._sfTimer = setTimeout(() => {
    status.removeAttribute('data-shown');
    status.textContent = '';
  }, SHOWN_MS);
}

function selectText(code) {
  const selection = code.ownerDocument.defaultView?.getSelection?.();
  if (!selection) return;
  const range = code.ownerDocument.createRange();
  range.selectNodeContents(code);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Copies one code's text and says so near it. Settles with true when copied. */
export async function copyCode(code) {
  const text = code.textContent ?? '';
  try {
    await copyText(text, {document: code.ownerDocument});
    say(code, word('copied', code), 'copied');
    return true;
  } catch {
    // The browser refused: the text is selected, so Ctrl+C still copies it.
    selectText(code);
    say(code, word('selected', code, {keys: keys()}), 'selected');
    return false;
  }
}

const targetOf = (event) => {
  const code = event.target?.closest?.(`code[${TARGET}]`);
  return code && isCopyable(code) ? code : null;
};

function onClick(event) {
  const code = targetOf(event);
  if (!code || event.defaultPrevented) return;
  // A click that ends a selection made inside the code is a selection.
  const selection = code.ownerDocument.defaultView?.getSelection?.();
  if (selection && !selection.isCollapsed && code.contains(selection.anchorNode)) return;
  copyCode(code);
}

function onKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const code = targetOf(event);
  if (!code || event.target !== code) return;
  event.preventDefault();
  copyCode(code);
}

/** Starts watching `doc`: marks what is there and follows what is added. Once per document. */
export function install(doc = globalThis.document) {
  if (!doc?.documentElement || doc.__sfCodeCopy) return;
  doc.__sfCodeCopy = true;
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKeydown);
  const start = () => {
    refresh(doc);
    const View = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (!View) return;
    new View((records) => {
      for (const record of records) {
        if (record.type === 'attributes') {
          refresh(record.target);
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          // Only what lies in or holds an opted-in container is looked at.
          if (node.closest(`[${ATTRIBUTE}]`) || node.querySelector(`[${ATTRIBUTE}]`)) refresh(node);
        }
      }
    }).observe(doc.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: [ATTRIBUTE]});
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}

if (typeof globalThis !== 'undefined' && globalThis.document) {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.codeCopy) globalThis.SF.codeCopy = {refresh, copy: copyCode, isCopyable};
  install(globalThis.document);
}

export default install;
