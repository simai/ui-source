// The text faces a page needs, asked for from the first script.
//
// Inter's faces are `font-display: optional` (core/scss/_sf_css__fonts.scss):
// a face is used only if it is in by the first frame, so text never moves when
// it arrives. But the browser starts a face's file only when text set in it is
// laid out, and that is the first frame itself, so on a cold visit Inter was
// never in time: every first visit drew in the metric fallback, and a visit
// that got some faces and not others mixed the two on one line (R074 F-3).
// Starting the files here, while the head is still parsed, lets a quick
// network bring them in before the first frame. A slow one changes nothing:
// the face misses the frame and the page keeps the fallback for the visit, as
// before.
//
// FontFace.load() needs no file address (the built sheet names the files by
// hash) and leaves no "preloaded but not used" warning. Only the faces the
// page's text is likely to need are started: Latin always (spaces, digits and
// punctuation are Latin), Cyrillic when the document's language is written in
// it. A page in another script loads its face on first use, as before.
// Opt out with SF_BOOT_CONFIG.fonts.early = false.

export const TEXT_FONT_FAMILY = 'Inter Variable';

// Languages written in Cyrillic (ISO 639-1), read from <html lang>.
const CYRILLIC_LANGUAGE = /^(ru|uk|be|bg|sr|mk|kk|ky|tg|mn|ba|tt|cv|ce|os|sah|ab)(-|$)/i;

const LATIN_PROBE = 0x61; // a
const CYRILLIC_PROBE = 0x430; // а

// "U+0-FF, U+131, U+400-45F" covers a code point?
export function unicodeRangeCovers(range, codePoint) {
  if (!range) return true;
  return String(range).split(',').some((part) => {
    const match = /^\s*U\+([0-9a-f?]+)(?:-([0-9a-f]+))?\s*$/i.exec(part);
    if (!match) return false;
    const start = parseInt(match[1].replace(/\?/g, '0'), 16);
    const end = match[2] ? parseInt(match[2], 16) : parseInt(match[1].replace(/\?/g, 'f'), 16);
    return codePoint >= start && codePoint <= end;
  });
}

export function textFontProbes(language) {
  const probes = [LATIN_PROBE];
  if (CYRILLIC_LANGUAGE.test(String(language || '').trim())) probes.push(CYRILLIC_PROBE);
  return probes;
}

// Starts the Inter faces the page's text needs; returns the faces started.
export function startTextFonts(doc = typeof document !== 'undefined' ? document : null, config = typeof window !== 'undefined' ? window.SF_BOOT_CONFIG : null) {
  if (config?.fonts?.early === false) return [];
  const fonts = doc?.fonts;
  if (!fonts || typeof fonts.forEach !== 'function') return [];
  const probes = textFontProbes(doc.documentElement?.getAttribute?.('lang'));
  const started = [];
  fonts.forEach((face) => {
    if (String(face.family || '').replace(/["']/g, '').trim() !== TEXT_FONT_FAMILY) return;
    if (face.status !== 'unloaded') return;
    if (!probes.some((codePoint) => unicodeRangeCovers(face.unicodeRange, codePoint))) return;
    started.push(face);
    try {
      const pending = face.load();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch {
      // A face that cannot load leaves the page on the fallback, as before.
    }
  });
  return started;
}

// Now, from the first script: core.css stands before core.js in a page head,
// so its faces are in document.fonts. A page that links the sheet after the
// script gets a second try once the document is parsed.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (!startTextFonts().length && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startTextFonts(), {once: true});
  }
}
