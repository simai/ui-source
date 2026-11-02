// The icon subset a page drew with, remembered for the next page on its origin.
//
// The Loader asks the subset service for the page's icons once the page is
// ready, and the @font-face goes in only when that answer is back. A page that
// opens with icon buttons in its header therefore drew them as empty squares
// for as long as the request took -- some 340 ms on effects.simai.io on every
// load, a warm HTTP cache included (pair ui-2d39b617a719, language switch
// en -> ru). The answer the last page got is kept in localStorage (the
// manifest the service sends with its stylesheet); the core runtime reads it at
// boot, before any component renders, writes its face and a font preload into
// the head, and the font comes out of the HTTP cache by the time the first
// button draws. The Loader then asks the service as before, and a grown subset
// replaces the remembered one only once its own face is loaded.
//
// What is reused is checked first: a remembered subset is only used when every
// icon name is a plain ligature name and every font file it names is on the
// subset host the page is configured with. Nothing but the manifest the
// service sent is stored.
//
// Shared by the core runtime (index.js, at boot) and the Loader's icon runtime
// (iconSubsetRuntime.js), so both build the same stylesheet from a manifest.

export const ICON_SUBSET_STORAGE_KEY = 'SF_ICON_SUBSET_MANIFEST';
export const ICON_SUBSET_DEFAULT_HOST = 'https://icons.simai.io';

const ICON_NAME = /^[a-z0-9_]{1,96}$/u;
const FAMILY_NAME = /^[A-Za-z0-9 _.-]{1,160}$/u;
const FONT_WEIGHT = /^[1-9]00(?: [1-9]00)?$/u;
// Characters a font URL never needs and a CSS url('...') must not meet.
const UNSAFE_URL = /['"\\()<>\s]/u;

// The family a subset of the v1 generator declares, by icon type.
const V1_FAMILIES = Object.freeze({
  outlined: 'Material Symbols Outlined',
  rounded: 'Material Icons Round',
  sharp: 'Material Icons Sharp',
});
const FAMILY_TYPES = new Map([
  ['material symbols outlined', 'outlined'],
  ['material symbols rounded', 'rounded'],
  ['material symbols sharp', 'sharp'],
]);

export function normalizeIconType(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'shape') return 'sharp';
  if (normalized === 'rounded' || normalized === 'sharp') return normalized;
  return 'outlined';
}

// A variable font's weight range loads as one weight in every browser.
export function normalizeIconFontLoadWeight(value = '400') {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  const range = normalized.match(/^([1-9]00)\s+([1-9]00)$/);
  if (!range) return normalized || '400';
  const start = Number(range[1]);
  const end = Number(range[2]);
  const minimum = Math.min(start, end);
  const maximum = Math.max(start, end);
  return String(Math.min(maximum, Math.max(minimum, 400)));
}

export function iconSubsetStorageKey(type = '') {
  const normalized = normalizeIconType(type);
  return normalized === 'outlined' ? ICON_SUBSET_STORAGE_KEY : `${ICON_SUBSET_STORAGE_KEY}:${normalized}`;
}

export function iconManifestType(manifest = {}) {
  const declared = String(manifest.type || (manifest.schema === 'sf.icon_subset.v1' ? manifest.family : '') || '')
    .trim()
    .toLowerCase();
  if (declared) return normalizeIconType(declared);
  return normalizeIconType(FAMILY_TYPES.get(String(manifest.family || '').trim().toLowerCase()) || 'outlined');
}

export function iconManifestFontFamily(manifest = {}) {
  if (manifest.font_family) return String(manifest.font_family);
  return `${(manifest.schema === 'sf.icon_subset.v1'
    ? V1_FAMILIES[iconManifestType(manifest)]
    : manifest.family) || 'Material Symbols Outlined'} Subset`;
}

export function iconSubsetSelector(type = '') {
  const normalized = normalizeIconType(type);
  if (normalized === 'rounded') return '.sf-icon:is(.sf-icon--rounded, .sf-icon-rounded)';
  if (normalized === 'sharp') return '.sf-icon:is(.sf-icon--sharp, .sf-icon-shape)';
  return '.sf-icon:not(.sf-icon--rounded):not(.sf-icon-rounded):not(.sf-icon--sharp):not(.sf-icon-shape)';
}

// The stylesheet a manifest stands for: one @font-face per font file, and the
// rule that sets the family's icons in it. font-display stays block: an icon's
// fallback text is its name spelled out, so an icon waits unseen rather than
// swap; a remembered face comes from the HTTP cache well inside that period.
export function iconSubsetCssFromManifest(manifest = {}) {
  const fonts = Array.isArray(manifest.fonts) ? manifest.fonts : [];
  const family = iconManifestFontFamily(manifest);
  const weights = new Set();
  const fontFaces = fonts
    .filter((font) => font?.url)
    .map((font) => {
      const weight = font.weight || manifest.axes?.wght?.value || 400;
      weights.add(String(weight));
      return (
        `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  src: url('${font.url}') format('woff2');\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${weight};\n` +
        `  font-display: block;\n` +
        `}\n`
      );
    })
    .join('\n');
  if (!fontFaces) return {cssText: '', family, weights: [...weights]};
  const cssText =
    fontFaces +
    `\n` +
    `${iconSubsetSelector(iconManifestType(manifest))} {\n` +
    `  --sf-icon--font-family: '${family}';\n` +
    `  --sf-icon--font--weight: var(--sf-icon--weight, 400);\n` +
    `  font-feature-settings: 'liga';\n` +
    `  font-variation-settings: ` +
    `'FILL' var(--sf-icon--fill, 0), ` +
    `'wght' var(--sf-icon--weight, 400), ` +
    `'GRAD' var(--sf-icon--grade, 0), ` +
    `'opsz' var(--sf-icon--optical-size, 24);\n` +
    `}\n`;
  return {cssText, family, weights: [...weights]};
}

// The origin of the subset host the page is configured with; '' when the
// configured host is not a URL.
export function iconSubsetHostOrigin(host, baseURI) {
  try {
    return new URL(host || ICON_SUBSET_DEFAULT_HOST, baseURI).origin;
  } catch {
    return '';
  }
}

// icons.remember = false: nothing is remembered between pages.
export function isIconSubsetRemembered(config) {
  return config?.icons?.remember !== false;
}

// Whether a remembered manifest may be used on this page: its family is the
// type asked for, its icon names are plain ligature names, its family name and
// weights are plain values, and every font file is on the subset host.
export function isRememberedIconSubsetUsable(manifest, {hostOrigin = '', type = 'outlined'} = {}) {
  if (!manifest || typeof manifest !== 'object' || !hostOrigin) return false;
  if (iconManifestType(manifest) !== normalizeIconType(type)) return false;
  const icons = manifest.icons;
  if (!Array.isArray(icons) || !icons.length || !icons.every((icon) => typeof icon === 'string' && ICON_NAME.test(icon))) {
    return false;
  }
  if (!FAMILY_NAME.test(iconManifestFontFamily(manifest))) return false;
  const fonts = manifest.fonts;
  if (!Array.isArray(fonts) || !fonts.length) return false;
  const hostProtocol = hostOrigin.slice(0, hostOrigin.indexOf(':') + 1);
  return fonts.every((font) => {
    if (!font || typeof font.url !== 'string' || UNSAFE_URL.test(font.url)) return false;
    const weight = font.weight ?? manifest.axes?.wght?.value ?? 400;
    if (!FONT_WEIGHT.test(String(weight))) return false;
    try {
      const url = new URL(font.url);
      return url.origin === hostOrigin && url.protocol === hostProtocol
        && (url.protocol === 'https:' || url.protocol === 'http:');
    } catch {
      return false;
    }
  });
}

// The remembered manifest for a type, or null: unreadable storage, nothing
// stored, unparsable or unusable all read as nothing remembered.
export function readRememberedIconSubset(storage, {hostOrigin, type}) {
  let raw = null;
  try {
    raw = storage?.getItem(iconSubsetStorageKey(type)) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const manifest = JSON.parse(raw);
    return isRememberedIconSubsetUsable(manifest, {hostOrigin, type}) ? manifest : null;
  } catch {
    return null;
  }
}

// At boot, before any component renders: the remembered subset's stylesheet
// and a preload for each of its font files, and the pending mark lifted as
// soon as its face is loaded. The style is the one the Loader would write for
// the same manifest (same attributes), marked data-sf-icons-remembered; the
// Loader adopts it when it restores that manifest, and keeps it as the face
// the page draws with until a grown subset's own face is loaded.
export function applyRememberedIconSubset({win = globalThis.window, doc = globalThis.document, storage} = {}) {
  if (!win || !doc?.head) return null;
  const config = win.SF_BOOT_CONFIG;
  if (!isIconSubsetRemembered(config)) return null;
  const type = normalizeIconType(config?.icons?.type || win.SF_ICON_TYPE || 'outlined');
  if (doc.querySelector(`style[data-sf-icons-subset-family="${type}"]`)) return null;
  const hostOrigin = iconSubsetHostOrigin(config?.icons?.subsetHost || win.SF_ICON_SUBSET_HOST, doc.baseURI);
  const manifest = readRememberedIconSubset(storage, {hostOrigin, type});
  if (!manifest) return null;
  const {cssText, family} = iconSubsetCssFromManifest(manifest);
  if (!cssText) return null;

  for (const font of manifest.fonts) {
    const href = new URL(font.url).href;
    if ([...doc.querySelectorAll('link[rel="preload"][as="font"]')].some((link) => link.href === href)) continue;
    const link = doc.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = href;
    link.setAttribute('data-sf-icons-remembered', '');
    doc.head.appendChild(link);
  }
  const style = doc.createElement('style');
  style.setAttribute('data-sf-icons-subset', manifest.icons.join(','));
  style.setAttribute('data-sf-icons-subset-family', type);
  if (manifest.hash) style.setAttribute('data-sf-icons-subset-hash', String(manifest.hash));
  style.setAttribute('data-sf-icons-remembered', '');
  style.textContent = cssText;
  doc.head.appendChild(style);

  const root = doc.documentElement;
  const weight = normalizeIconFontLoadWeight(String(manifest.fonts[0]?.weight || manifest.axes?.wght?.value || 400));
  doc.fonts?.load?.(`${weight} 24px "${family}"`, manifest.icons.join(' '))
    .then((faces) => {
      if (faces?.length && root?.getAttribute('data-sf-icons') === 'subset-pending' && style.isConnected) {
        root.removeAttribute('data-sf-icons');
      }
    })
    .catch(() => {
      /* The Loader's own request and fallback take over. */
    });
  return {manifest, style, type};
}
