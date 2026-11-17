// A link that opens a new tab says so (owner decision C186 (3), 2026-11-14;
// C147 (4) for the reference link, C25 for a file). Every link in text with
// target="_blank" -- a plain <a>, an <a> with a link-* utility, an sf-link --
// gets, after its last word:
//
//   - arrow_outward, the text's size, --sf-space-1/4 (4, C173 «icon in text»)
//     from the word; the last word and the sign are one unbreakable run
//     ([data-sf-new-tab="tail"], white-space: nowrap), so the sign never
//     starts a line of its own (a word joiner does not hold an inline-flex
//     icon to its word in Chromium); not underlined, not copied, hidden from
//     a screen reader;
//   - «(откроется в новой вкладке)» for a screen reader only, in the page's
//     language (sf-file-download's word new-tab-text, read through the page's
//     language: a product that registers that word for sf-file-download is
//     heard here too).
//
// Core draws them (core/scss/_sf_css__link.scss, [data-sf-new-tab]). A link
// that is part of a component -- a class of its own beyond sf-link and the
// link-* utilities, or a parent with an sf- class -- is left alone: the
// component says it in its own way (sf-reference-link, sf-file-download). So
// is a link that already shows a new-tab icon. The marks follow the link:
// a link that stops opening a new tab loses them.
import {pageWord} from './page-language.js';

export const ATTRIBUTE = 'data-sf-new-tab';
// sf-file-download's words (src/smart/file-download/lang/*.json, new-tab-text),
// core's own language files (core/js/lang/new-tab: English built in, the other
// languages from a language file, C282); tests/plain-group-3-c186.contract.test.mjs
// holds them equal.
import WORDS from './lang/new-tab/index.mjs';

export {WORDS};
const GLYPH = 'arrow_outward';
const NEW_TAB_GLYPHS = new Set(['arrow_outward', 'open_in_new', 'launch', 'north_east']);

const classes = (element) => String(element?.getAttribute?.('class') ?? '').split(/\s+/).filter(Boolean);
const isLinkClass = (name) => name === 'sf-link' || name.startsWith('link-') || /^[a-z]{2,3}:link-/.test(name);

/** Whether `link` is a link in text that opens a new tab. */
export function opensNewTab(link) {
  if (!link || link.localName !== 'a' || !link.hasAttribute('href')) return false;
  if (String(link.getAttribute('target') ?? '').toLowerCase() !== '_blank') return false;
  if (!classes(link).every(isLinkClass)) return false;
  const parent = link.parentElement;
  if (parent && classes(parent).some((name) => name.startsWith('sf-') && !name.startsWith('sf-link'))) return false;
  return true;
}

const ownMarks = (link) => [...link.querySelectorAll(`[${ATTRIBUTE}]`)];

const showsNewTabIcon = (link) => [...link.querySelectorAll('.sf-icon')].some((icon) =>
  !icon.hasAttribute(ATTRIBUTE) && NEW_TAB_GLYPHS.has(String(icon.textContent ?? '').trim()));

function unmark(link) {
  for (const node of ownMarks(link)) {
    if (!node.isConnected) continue;
    if (node.getAttribute(ATTRIBUTE) === 'tail') {
      // The word goes back into the text it was taken from.
      node.querySelectorAll(`[${ATTRIBUTE}]`).forEach((inner) => inner.remove());
      const parent = node.parentNode;
      node.replaceWith(...node.childNodes);
      parent?.normalize?.();
    } else {
      node.remove();
    }
  }
}

// The last text of the link with something to read, outside the marks.
function lastText(link) {
  const walker = link.ownerDocument.createTreeWalker(link, 4);
  let last = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(`[${ATTRIBUTE}]`)) continue;
    if (node.data.trim()) last = node;
  }
  return last;
}

function mark(link) {
  const doc = link.ownerDocument;
  const words = pageWord(WORDS, 'new-tab-text', link, {component: 'sf-file-download', source: 'ru'});
  const existing = ownMarks(link);
  const said = existing.find((node) => node.getAttribute(ATTRIBUTE) === 'words');
  if (existing.some((node) => node.getAttribute(ATTRIBUTE) === 'mark') && said) {
    if (said.textContent !== ` ${words}`) said.textContent = ` ${words}`;
    return;
  }
  unmark(link);
  if (showsNewTabIcon(link)) return;
  const icon = doc.createElement('i');
  icon.className = 'sf-icon';
  icon.setAttribute(ATTRIBUTE, 'mark');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = GLYPH;
  const text = doc.createElement('span');
  text.setAttribute(ATTRIBUTE, 'words');
  text.textContent = ` ${words}`;
  // A flex sf-link without a content part has no line to break: the sign is
  // one more item of the link's row.
  const flexRow = link.classList.contains('sf-link') && !link.querySelector(':scope > :is(.sf-link__content, .sf-link-content)');
  const last = flexRow ? null : lastText(link);
  if (!last) {
    link.append(icon, text);
    return;
  }
  // The last word and the sign: one run that does not break.
  const data = last.data.replace(/\s+$/u, '');
  const cut = Math.max(data.search(/\S+$/u), 0);
  const word = cut > 0 ? last.splitText(cut) : last;
  if (word.data.length > data.length - cut) word.splitText(data.length - cut);
  const tail = doc.createElement('span');
  tail.setAttribute(ATTRIBUTE, 'tail');
  word.replaceWith(tail);
  tail.append(word, icon);
  link.append(text);
}

/** Marks or unmarks every link in `root` (a document, an element or a link). */
export function refresh(root = globalThis.document) {
  if (!root) return;
  const links = [];
  if (root.localName === 'a') links.push(root);
  root.querySelectorAll?.('a[href]').forEach((link) => links.push(link));
  for (const link of links) {
    if (opensNewTab(link)) mark(link);
    else if (ownMarks(link).length) unmark(link);
  }
}

/** Starts watching `doc`: marks what is there and follows what is added. Once per document. */
export function install(doc = globalThis.document) {
  if (!doc?.documentElement || doc.__sfNewTabLink) return;
  doc.__sfNewTabLink = true;
  const start = () => {
    refresh(doc);
    const View = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (!View) return;
    new View((records) => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const target = record.target;
          if (target.localName === 'a') refresh(target);
          else if (record.attributeName === 'lang') refresh(target);
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || node.hasAttribute?.(ATTRIBUTE)) continue;
          if (node.localName === 'a' || node.querySelector('a[target]')) refresh(node);
        }
      }
    }).observe(doc.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['target', 'href', 'class', 'lang']});
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}

if (typeof globalThis !== 'undefined' && globalThis.document) {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.newTabLink) globalThis.SF.newTabLink = {refresh, opensNewTab};
  install(globalThis.document);
}

export default install;
