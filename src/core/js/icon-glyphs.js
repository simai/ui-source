// What every icon slot shares about a glyph beyond its font (owner decision
// C151, icons study control/research/2026-11-14-icons.md): the glyphs a
// product registers by name (point 6), the glyphs that turn over in a
// right-to-left part (point 3) and an unknown name, which keeps its box empty
// and is named once in the console with the nearest real name (point 2).
//
// One state per page, on the shared global: Core, the Loader and the Smart
// icon each carry a copy of this module (bundles each carry their own module
// copy), and a glyph registered through one copy has to draw in the slots the
// others render.
const NAME = /^[a-z0-9_][a-z0-9_-]*$/u;

function shared() {
  const root = (globalThis.SF = globalThis.SF || {});
  const icons = (root.icons = root.icons || {});
  if (!icons.__glyphs) {
    Object.defineProperty(icons, '__glyphs', {
      value: {registered: new Map(), warned: new Set(), names: null, pending: new Set(), frame: 0},
      configurable: true,
    });
  }
  return icons.__glyphs;
}

// ---------------------------------------------------------------- point 6
// SF.icons.register(name, svg): the product's own or a brand glyph, drawn in
// the current colour at the slot's size wherever an icon name is accepted --
// sf-icon, a button's icon-start, a menu row, a tab, the class markup
// <i class="sf-icon">name</i>. The SVG is a mask over the glyph's box, so one
// colour; the box and its size are the ladder's. The name never reaches the
// icon font request.
function styleSheet() {
  const doc = globalThis.document;
  if (!doc?.head) return null;
  let style = doc.head.querySelector('style[data-sf-icons-registered]');
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute('data-sf-icons-registered', '');
    doc.head.appendChild(style);
  }
  return style;
}

function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function writeRegisteredSheet() {
  const style = styleSheet();
  if (!style) return;
  const rules = [];
  for (const [name, svg] of shared().registered) {
    rules.push(`.sf-icon[data-sf-icon-custom="${name}"]{--sf-icon--custom:${svgUrl(svg)}}`);
  }
  style.textContent = rules.join('\n');
}

export function registeredIcon(name) {
  const key = String(name || '').trim();
  return key ? shared().registered.get(key) || null : null;
}

// A glyph of the class markup takes its registered drawing from the attribute;
// one that stops being registered (its text changed) gives it back.
export function markCustomGlyph(el, name) {
  if (!el?.setAttribute) return false;
  const key = String(name || '').trim();
  if (key && registeredIcon(key)) {
    if (el.getAttribute('data-sf-icon-custom') !== key) el.setAttribute('data-sf-icon-custom', key);
    // Drawn as letters before it was registered: it is no longer missing.
    el.removeAttribute('data-sf-icon-missing');
    return true;
  }
  if (el.hasAttribute?.('data-sf-icon-custom')) el.removeAttribute('data-sf-icon-custom');
  return false;
}

export function registerIcon(name, svg) {
  const key = String(name || '').trim();
  const drawing = String(svg || '').trim();
  if (!NAME.test(key)) {
    globalThis.console?.warn?.(`[SIMAI Framework] SF.icons.register: "${key}" is not an icon name (lowercase letters, digits, _ and -).`);
    return false;
  }
  if (!/^<svg[\s>]/iu.test(drawing)) {
    globalThis.console?.warn?.(`[SIMAI Framework] SF.icons.register("${key}"): the drawing must be an <svg> element.`);
    return false;
  }
  shared().registered.set(key, drawing);
  writeRegisteredSheet();
  const doc = globalThis.document;
  // Class-markup glyphs already on the page take it now; sf-icon elements and
  // the Loader hear the event.
  doc?.querySelectorAll?.('.sf-icon').forEach((el) => {
    if (el.closest?.('sf-icon')) return;
    const text = String(el.getAttribute('data-icon') || el.textContent || '').trim();
    if (text === key && markCustomGlyph(el, key)) el.classList.add('sf-icon-loaded');
  });
  try {
    globalThis.dispatchEvent?.(new CustomEvent('sf-icons:registered', {detail: {name: key}}));
  } catch {
    // A realm without CustomEvent (a unit test) has nothing listening.
  }
  return true;
}

// ---------------------------------------------------------------- point 3
// The glyphs that point along the line (Material's bidirectionality guidance):
// arrows, chevrons, send, reply and forward, undo and redo, lists and
// indents, open in a new window, log in and out. Clocks, checks, media
// controls and logos never turn over.
export const DIRECTIONAL_ICONS = Object.freeze(new Set([
  'arrow_back', 'arrow_forward', 'arrow_back_ios', 'arrow_back_ios_new', 'arrow_forward_ios',
  'arrow_left', 'arrow_right', 'arrow_left_alt', 'arrow_right_alt', 'arrow_outward',
  'chevron_left', 'chevron_right', 'keyboard_arrow_left', 'keyboard_arrow_right',
  'keyboard_double_arrow_left', 'keyboard_double_arrow_right', 'double_arrow',
  'navigate_before', 'navigate_next', 'first_page', 'last_page', 'trending_flat',
  'subdirectory_arrow_left', 'subdirectory_arrow_right', 'call_made', 'call_received',
  'keyboard_tab', 'keyboard_backspace', 'backspace',
  'send', 'reply', 'reply_all', 'forward', 'undo', 'redo',
  'format_list_bulleted', 'list', 'view_list', 'toc', 'notes', 'short_text', 'subject',
  'wrap_text', 'format_indent_increase', 'format_indent_decrease', 'menu_open', 'read_more',
  'open_in_new', 'launch', 'exit_to_app', 'logout', 'login', 'input', 'output',
  'label', 'label_important',
]));

// mirror: auto (the glyph turns over in a right-to-left part when it points
// along the line), on (it turns over there whatever it is), off (never).
export function mirrorsInRtl(name, mode = 'auto') {
  const value = String(mode || 'auto').trim().toLowerCase();
  if (value === 'off') return false;
  if (value === 'on') return true;
  return DIRECTIONAL_ICONS.has(String(name || '').trim());
}

// ---------------------------------------------------------------- point 2
// An unknown or misspelt name is drawn by the icon font as its letters: wider
// than the glyph's box. The box clips them (the icons sheet), the glyph is
// marked missing (its letters unseen, the box kept) and the name is said once
// per page, with the nearest real name from the font's own list
// (core/contracts/icon-names.v1.json, fetched only when a name is missing).
function textWidth(el) {
  const doc = el.ownerDocument;
  const range = doc?.createRange?.();
  if (!range) return 0;
  range.selectNodeContents(el);
  return range.getBoundingClientRect?.().width || 0;
}

function namesUrl() {
  const base = String(globalThis.sfPath || '').replace(/\/+$/u, '');
  return base ? `${base}/core/contracts/icon-names.v1.json` : '';
}

function loadNames() {
  const state = shared();
  if (!state.names) {
    const url = namesUrl();
    state.names = url && typeof fetch === 'function'
      ? fetch(url).then((response) => (response.ok ? response.json() : null)).then((data) => (Array.isArray(data?.names) ? data.names : [])).catch(() => [])
      : Promise.resolve([]);
  }
  return state.names;
}

function distance(a, b) {
  const row = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const kept = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[b.length];
}

export function nearestIconName(name, names = []) {
  const wanted = String(name || '').trim().toLowerCase().replace(/[\s-]+/gu, '_');
  let best = '';
  let bestDistance = Infinity;
  for (const candidate of names) {
    if (Math.abs(candidate.length - wanted.length) >= bestDistance) continue;
    const d = distance(wanted, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return bestDistance <= Math.max(2, Math.ceil(wanted.length / 3)) ? best : '';
}

function warnMissing(name) {
  const state = shared();
  if (state.warned.has(name)) return;
  state.warned.add(name);
  loadNames().then((names) => {
    const near = nearestIconName(name, names);
    globalThis.console?.warn?.(`[SIMAI Framework] sf-icon: no icon "${name}"${near ? `; nearest: "${near}"` : ''}. The box stays empty.`);
  });
}

// A glyph is judged only once the face that draws it is in: marked loaded,
// its family can still be on its way (font-display: block draws the name
// unseen at the fallback's width, as wide as letters). Until then the check
// waits for the face, twice at most; a face that never comes is judged as it
// draws.
const fontWaits = new WeakMap();

function faceOnItsWay(glyph, name) {
  const fonts = glyph.ownerDocument?.fonts;
  const view = glyph.ownerDocument?.defaultView;
  if (!fonts?.check || !view?.getComputedStyle) return null;
  const waits = fontWaits.get(glyph) || 0;
  if (waits >= 2) return null;
  const style = view.getComputedStyle(glyph);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  try {
    if (fonts.check(font, name || 'a')) return null;
  } catch {
    return null;
  }
  fontWaits.set(glyph, waits + 1);
  return Promise.resolve(fonts.load(font, name || 'a')).catch(() => null);
}

// Called when a glyph is marked loaded; the reads are taken together in one
// frame for every glyph that loaded since the last one.
export function checkIconGlyph(el) {
  if (!el?.isConnected || el.hasAttribute('data-sf-icon-custom')) return;
  const state = shared();
  state.pending.add(el);
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    const glyphs = [...state.pending];
    state.pending.clear();
    const readings = glyphs.map((glyph) => {
      if (!glyph.isConnected || glyph.hasAttribute('data-sf-icon-custom')) return null;
      const box = glyph.getBoundingClientRect();
      // Not rendered (a closed panel): read again when it loads anew.
      if (!box.width || !box.height) return null;
      return {glyph, box: box.width, text: textWidth(glyph)};
    });
    for (const reading of readings) {
      if (!reading) continue;
      const {glyph, box, text} = reading;
      const name = String(glyph.getAttribute('data-icon') || glyph.textContent || '').trim();
      // A ligature is one glyph, one box wide; letters are several.
      const missing = text > box * 1.5;
      if (missing) {
        const face = faceOnItsWay(glyph, name);
        if (face) {
          face.then(() => checkIconGlyph(glyph));
          continue;
        }
        if (!glyph.hasAttribute('data-sf-icon-missing')) glyph.setAttribute('data-sf-icon-missing', '');
        if (name) warnMissing(name);
      } else if (glyph.hasAttribute('data-sf-icon-missing')) {
        glyph.removeAttribute('data-sf-icon-missing');
      }
    }
  };
  const raf = globalThis.requestAnimationFrame;
  state.frame = typeof raf === 'function' ? raf(run) : (setTimeout(run, 16), 1);
}

if (typeof globalThis !== 'undefined') {
  const root = (globalThis.SF = globalThis.SF || {});
  root.icons = root.icons || {};
  if (typeof root.icons.register !== 'function') root.icons.register = registerIcon;
}
