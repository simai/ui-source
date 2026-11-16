// A combination in running text (owner decision C191 (9) and (10),
// 2026-11-15; ui-control research 2026-11-14-recipe-parts, #q-kb-text and
// #q-kb-names). An author writes the notation once, as a host's `shortcut`
// setting takes it, on a plain <kbd>:
//
//   Нажмите <kbd data-sf-shortcut="mod+k"></kbd>, чтобы открыть поиск.
//
// and this fills it with the caps the shared helper draws for every host
// (js/shortcut.js shortcutView): ⌘ K on a Mac, Ctrl K elsewhere -- caps stand
// apart in text, and the + between Windows words is written as the hosts write
// it (.sf-kbd-join), shown only where keys are plain glyphs (a tooltip, a
// menu). No new component (D11e): like data-sf-copy (C48), an attribute on
// the element the page already has, which works in Markdown, PHP and
// templates.
//
// The caps are hidden from a screen reader and the names of the keys stand
// beside them, read and never seen, in the page's language (js/spoken.js,
// lang/<locale>.json): «Command K», «Ctrl K», «Shift Command Z», «Ввод». A
// product adds a language with SF.language.register('sf-kbd', code, words).
//
// Markup added later is filled too (one observer for the document, as the
// copy route keeps), and so is a changed value, the page's language or a
// [lang] above a combination.
import {isApplePlatform, shortcutView} from './shortcut.js';
import {spokenText} from './spoken.js';
import en from '../lang/en.json';
import ru from '../lang/ru.json';

const WORDS = {en: en.runtime, ru: ru.runtime};
const SELECTOR = 'kbd[data-sf-shortcut]';
const ATTRIBUTE = 'data-sf-shortcut';
// Read, never seen; inline as well, so the words take no room before the
// sheet has arrived (the sheet holds the same, .sf-kbd-spoken).
const UNSEEN = 'position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

// The words through Core's language rule (SF.pageText, core/js/page-language.js:
// a word registered for sf-kbd, the shipped one, the language without its
// region, English), read from the page's SF so this bundle does not carry a
// second copy of the rule. Without Core, the nearest [lang] and English.
function say(word, node) {
  const pageText = globalThis.SF?.pageText;
  if (typeof pageText === 'function') return pageText(WORDS, word, node, 'sf-kbd');
  const lang = String(node?.closest?.('[lang]')?.getAttribute('lang') || 'en').toLowerCase().split('-')[0];
  return WORDS[lang]?.[word] ?? WORDS.en[word] ?? word;
}

/**
 * Fills one <kbd data-sf-shortcut>: the caps (aria-hidden) and the words a
 * reader says. Again only when what it would write differs.
 */
export function fillShortcut(element, apple = isApplePlatform()) {
  if (!element || element.localName !== 'kbd' || !element.hasAttribute(ATTRIBUTE)) return false;
  const value = element.getAttribute(ATTRIBUTE);
  const view = shortcutView(value, apple);
  const spoken = spokenText(view.keys, (word) => say(word, element));
  const mark = `${value}\u0000${apple}\u0000${spoken}`;
  if (element.__sfShortcut === mark) return false;
  element.__sfShortcut = mark;
  const doc = element.ownerDocument;
  const parts = [];
  if (view.keys.length) {
    const words = doc.createElement('span');
    words.className = 'sf-kbd-spoken';
    words.setAttribute('style', UNSEEN);
    words.textContent = spoken;
    parts.push(words);
  }
  view.keys.forEach((key, at) => {
    if (at && view.join) {
      const join = doc.createElement('span');
      join.className = 'sf-kbd-join';
      join.setAttribute('aria-hidden', 'true');
      join.textContent = '+';
      parts.push(join);
    }
    const cap = doc.createElement('kbd');
    if (key.square) cap.className = 'sf-kbd--square';
    cap.setAttribute('aria-hidden', 'true');
    cap.textContent = key.text;
    parts.push(cap);
  });
  element.classList.add('sf-kbd--group');
  element.replaceChildren(...parts);
  return true;
}

// A key of one character is a square (C38): the component decides it, not
// the author (C04). An author wrote <kbd>S</kbd> and got a key wider than
// its height unless the page also wrote sf-kbd--square, while the keys
// data-sf-shortcut fills were squares (content study Kl1, 2026-11-16). A
// key -- a <kbd> with no element inside -- whose text is one character takes
// the class; marked here (data-sf-kbd-square), it gives the class back when
// its text grows. A class the author wrote stays.
const SQUARE = 'sf-kbd--square';
const SQUARE_MARK = 'data-sf-kbd-square';

function oneCharacter(text) {
  return [...String(text || '').trim()].length === 1;
}

export function markSquareKey(element) {
  if (!element || element.localName !== 'kbd' || element.firstElementChild) return false;
  if (element.classList.contains('sf-kbd--group')) return false;
  const square = oneCharacter(element.textContent);
  const marked = element.hasAttribute(SQUARE_MARK);
  if (square && !element.classList.contains(SQUARE)) {
    element.classList.add(SQUARE);
    element.setAttribute(SQUARE_MARK, '');
    return true;
  }
  if (!square && marked) {
    element.classList.remove(SQUARE);
    element.removeAttribute(SQUARE_MARK);
    return true;
  }
  return false;
}

/** Marks every one-character key in `root` (and `root` itself). */
export function markSquareKeys(root = globalThis.document) {
  if (!root) return 0;
  let marked = 0;
  if (root.localName === 'kbd' && markSquareKey(root)) marked += 1;
  root.querySelectorAll?.('kbd').forEach((element) => {
    if (markSquareKey(element)) marked += 1;
  });
  return marked;
}

/** Fills every combination in `root` (and `root` itself). */
export function fillShortcuts(root = globalThis.document) {
  if (!root) return 0;
  const apple = isApplePlatform();
  let filled = 0;
  if (root.matches?.(SELECTOR) && fillShortcut(root, apple)) filled += 1;
  root.querySelectorAll?.(SELECTOR).forEach((element) => {
    if (fillShortcut(element, apple)) filled += 1;
  });
  return filled;
}

// Once per document, whichever copy of this bundle runs first.
if (typeof document !== 'undefined' && !document.__sfShortcutRoute) {
  document.__sfShortcutRoute = true;
  const fillAll = () => fillShortcuts(document);
  const squareAll = () => markSquareKeys(document);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { fillAll(); squareAll(); }, {once: true});
  }
  fillAll();
  squareAll();

  // Added combinations, a changed value, and a changed [lang] above one. The
  // keys this writes inside a combination carry no data-sf-shortcut, so they
  // ask for nothing again.
  new MutationObserver((records) => {
    let languageChanged = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.attributeName === 'lang') languageChanged = true;
        else if (record.target instanceof Element) fillShortcuts(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          fillShortcuts(node);
          markSquareKeys(node);
        }
      });
      // A key whose text changed: its new text nodes land in the key.
      if (record.target instanceof Element && record.target.localName === 'kbd') markSquareKey(record.target);
    }
    if (languageChanged) fillAll();
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: [ATTRIBUTE, 'lang'],
  });

  // SF.language.use() and words a product registers.
  globalThis.SF?.language?.onChange?.(fillAll);
}
