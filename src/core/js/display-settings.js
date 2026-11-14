// SF.displaySettings: how a person asked this site to be shown (owner decision
// C196, 2026-11-15; research ui-control
// control/research/2026-11-15-accessibility-worldwide.md).
//
// The settings are root attributes the core sheet reads
// (core/scss/_sf_css__display.scss): data-sf-scheme, data-sf-text-scale,
// data-sf-text-spacing, data-sf-images, data-sf-motion, data-sf-font and
// data-sf-links. Core applies the person's choice on every page of the site,
// whether the page carries the sf-display-settings panel or not; the panel
// only writes it.
//
// - The device first: a text step multiplies the browser's own size; under
//   forced-colors the colours are the system's (the panel's colour group is
//   off); reducedMotion() is true when the device or the person asks.
// - The choice is kept in this browser only: localStorage
//   `sf-display-settings`, no cookie, nothing sent to a server (C196 (5)).
//   A browser that refuses storage keeps it for the page.
// - Nothing here claims that a site meets a standard (C196 (6)).
//
// Also the link «Перейти к содержимому» / «Skip to content» (C196, core on
// every site): written first in <body> when the page has a main region and no
// such link of its own; <html data-sf-skip-link="off"> leaves it out.
//
// The state is on the shared global: every bundle carries its own copy of
// this module.
import {pageWord} from './page-language.js';
import {reducedMotion} from './motion.js';

export const STORAGE_KEY = 'sf-display-settings';
export const SCHEMES = Object.freeze(['black-on-white', 'white-on-black', 'yellow-on-black', 'blue-on-sky', 'brown-on-cream']);
export const TEXT_SCALES = Object.freeze([100, 125, 150, 175, 200]);
export const IMAGES = Object.freeze(['colour', 'grey', 'hide']);
export const FONTS = Object.freeze(['site', 'sans', 'serif']);

// The words core says itself; the same as sf-display-settings' language files
// (tests/display-settings.contract.test.mjs holds them equal).
export const WORDS = {
  en: {'skip-link-text': 'Skip to content'},
  ru: {'skip-link-text': 'Перейти к содержимому'},
};

export const DEFAULTS = Object.freeze({
  scheme: '',
  textScale: 100,
  textSpacing: 'normal',
  images: 'colour',
  motion: 'system',
  font: 'site',
  links: 'site',
});

const ATTRIBUTES = Object.freeze({
  scheme: 'data-sf-scheme',
  textScale: 'data-sf-text-scale',
  textSpacing: 'data-sf-text-spacing',
  images: 'data-sf-images',
  motion: 'data-sf-motion',
  font: 'data-sf-font',
  links: 'data-sf-links',
});

const CAPTION = 'sf-image-caption';

function state() {
  const SF = (globalThis.SF = globalThis.SF || {});
  const internal = SF.__internal || (SF.__internal = {});
  return (internal.displaySettings ||= {listeners: new Set(), memory: null, observer: null, skipClick: false});
}

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A scheme name as core knows it, else ''. */
export function schemeName(value) {
  const name = String(value ?? '').trim().toLowerCase();
  return SCHEMES.includes(name) ? name : '';
}

/** The settings made safe: every field one of its values, unknown fields gone. */
export function normalize(value) {
  const given = value && typeof value === 'object' ? value : {};
  const scale = Number(given.textScale);
  return {
    scheme: schemeName(given.scheme),
    textScale: TEXT_SCALES.includes(scale) ? scale : 100,
    textSpacing: given.textSpacing === 'wide' ? 'wide' : 'normal',
    images: IMAGES.includes(given.images) ? given.images : (given.images === 'gray' ? 'grey' : 'colour'),
    motion: given.motion === 'reduce' ? 'reduce' : 'system',
    font: FONTS.includes(given.font) ? given.font : 'site',
    links: given.links === 'underline' ? 'underline' : 'site',
  };
}

/** Whether nothing is changed. */
export function isDefault(settings) {
  const value = normalize(settings);
  return Object.keys(DEFAULTS).every((key) => value[key] === DEFAULTS[key]);
}

// The root attribute of each field; a default is no attribute.
function attributeValue(key, value) {
  if (value === DEFAULTS[key]) return null;
  return String(value);
}

/** The settings the root shows now (a page or a server may have set them). */
export function fromRoot(root = globalThis.document?.documentElement) {
  if (!root?.getAttribute) return normalize({});
  const read = (key) => root.getAttribute(ATTRIBUTES[key]);
  return normalize({
    scheme: read('scheme'),
    textScale: read('textScale') ?? 100,
    textSpacing: read('textSpacing'),
    images: read('images'),
    motion: read('motion'),
    font: read('font'),
    links: read('links'),
  });
}

/** The person's choice kept in this browser, or null. */
export function readStored() {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw !== null) return normalize(JSON.parse(raw));
    } catch {
      // Not JSON, or storage refused: as if nothing was kept.
    }
  }
  return state().memory ? normalize(state().memory) : null;
}

function captionImages(doc) {
  for (const image of doc.querySelectorAll('img[alt], svg[role="img"][aria-label]')) {
    const text = (image.getAttribute('alt') ?? image.getAttribute('aria-label') ?? '').trim();
    if (!text) continue;
    const anchor = image.parentElement?.localName === 'picture' ? image.parentElement : image;
    const next = anchor.nextElementSibling;
    if (next?.classList.contains(CAPTION)) {
      if (next.textContent !== text) next.textContent = text;
      continue;
    }
    const caption = doc.createElement('span');
    caption.className = CAPTION;
    caption.textContent = text;
    anchor.after(caption);
  }
}

function followImages(doc, hide) {
  const held = state();
  if (!hide) {
    held.observer?.disconnect();
    held.observer = null;
    return;
  }
  if (doc.body) captionImages(doc);
  if (held.observer || !doc.defaultView?.MutationObserver || !doc.documentElement) return;
  let queued = false;
  held.observer = new doc.defaultView.MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      captionImages(doc);
    });
  });
  held.observer.observe(doc.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['alt', 'aria-label']});
}

/** Writes the settings on the root (no storage). */
export function applySettings(settings, root = globalThis.document?.documentElement) {
  if (!root?.setAttribute) return normalize(settings);
  const value = normalize(settings);
  for (const [key, name] of Object.entries(ATTRIBUTES)) {
    const next = attributeValue(key, value[key]);
    if (next === null) root.removeAttribute(name);
    else if (root.getAttribute(name) !== next) root.setAttribute(name, next);
  }
  if (root.ownerDocument) followImages(root.ownerDocument, value.images === 'hide');
  return value;
}

function announce(value, root) {
  for (const listener of state().listeners) {
    try {
      listener({...value});
    } catch (error) {
      console.error('SF.displaySettings listener failed', error);
    }
  }
  const View = root?.ownerDocument?.defaultView;
  if (View?.CustomEvent) root.ownerDocument.dispatchEvent(new View.CustomEvent('sf-display-change', {detail: {...value}}));
}

/** Keeps the choice in this browser and shows it. */
export function writeSettings(settings, root = globalThis.document?.documentElement) {
  const value = normalize(settings);
  const store = storage();
  const plain = isDefault(value) ? null : value;
  state().memory = plain;
  if (store) {
    try {
      if (plain) store.setItem(STORAGE_KEY, JSON.stringify(plain));
      else store.removeItem(STORAGE_KEY);
    } catch {
      // A full or refused storage keeps the choice for this page only.
    }
  }
  applySettings(value, root);
  announce(value, root);
  return value;
}

/** «Обычная версия»: everything back to the site's own look. */
export function resetSettings(root = globalThis.document?.documentElement) {
  return writeSettings(DEFAULTS, root);
}

function matches(query) {
  try {
    return Boolean(globalThis.matchMedia?.(query).matches);
  } catch {
    return false;
  }
}

/** True when the device asks for less motion or the person stopped it here. */
export {reducedMotion};

/** True when the system sets the colours (Windows contrast themes). */
export function forcedColors() {
  return matches('(forced-colors: active)');
}

// ---------------------------------------------------------------------------
// «Перейти к содержимому»
// ---------------------------------------------------------------------------

function focusable(element) {
  return element.matches?.('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]');
}

function skipTarget(link) {
  const hash = link.getAttribute('href') ?? '';
  if (!hash.startsWith('#') || hash.length < 2) return null;
  try {
    return link.ownerDocument.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

// The keyboard follows the link: the target takes the focus (Safari and some
// screen readers leave it where it was on a jump to a non-focusable element).
function followSkip(event) {
  const link = event.target?.closest?.('a.sf-skip-link');
  if (!link) return;
  const target = skipTarget(link);
  if (!target) return;
  if (!focusable(target)) target.setAttribute('tabindex', '-1');
  target.focus({preventScroll: false});
}

/** Writes the skip link when the page has a main region and none of its own. */
export function installSkipLink(doc = globalThis.document) {
  if (!doc?.body || !doc.documentElement) return null;
  const held = state();
  if (!held.skipClick) {
    held.skipClick = true;
    doc.addEventListener('click', followSkip);
  }
  if (doc.documentElement.getAttribute('data-sf-skip-link') === 'off') return null;
  if (doc.querySelector('a.sf-skip-link, a[data-sf-skip-link]')) return null;
  const main = doc.querySelector('main, [role="main"]');
  if (!main) return null;
  if (!main.id) {
    let id = 'sf-main';
    for (let n = 2; doc.getElementById(id); n += 1) id = `sf-main-${n}`;
    main.id = id;
  }
  const link = doc.createElement('a');
  link.className = 'sf-skip-link';
  link.href = `#${main.id}`;
  link.setAttribute('data-sf-skip-link', 'core');
  link.textContent = pageWord(WORDS, 'skip-link-text', doc.documentElement, {component: 'sf-display-settings', source: 'ru'});
  doc.body.prepend(link);
  return link;
}

// ---------------------------------------------------------------------------

function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  state().listeners.add(listener);
  return () => state().listeners.delete(listener);
}

function start() {
  const doc = globalThis.document;
  const root = doc?.documentElement;
  if (!root) return;
  // The person's choice, before the page draws what core draws. A setting the
  // page printed on the root itself stays when the person chose nothing.
  const stored = readStored();
  if (stored) applySettings(stored, root);
  else if (root.getAttribute(ATTRIBUTES.images) === 'hide') followImages(doc, true);
  const ready = () => {
    installSkipLink(doc);
    if (root.getAttribute(ATTRIBUTES.images) === 'hide') followImages(doc, true);
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, {once: true});
  else ready();
  // Another tab of the site changed the choice.
  globalThis.addEventListener?.('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.storageArea !== storage()) return;
    let next = null;
    try { next = event.newValue === null ? null : JSON.parse(event.newValue); } catch { next = null; }
    announce(applySettings(next ?? DEFAULTS, root), root);
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.displaySettings) {
    globalThis.SF.displaySettings = Object.freeze({
      storageKey: STORAGE_KEY,
      schemes: SCHEMES,
      textScales: TEXT_SCALES,
      defaults: DEFAULTS,
      read: () => readStored() ?? fromRoot(),
      current: () => fromRoot(),
      write: (settings) => writeSettings(settings),
      reset: () => resetSettings(),
      subscribe,
      reducedMotion: () => reducedMotion(),
      forcedColors: () => forcedColors(),
      installSkipLink: (doc) => installSkipLink(doc),
    });
    start();
  }
}

export default globalThis.SF?.displaySettings;
