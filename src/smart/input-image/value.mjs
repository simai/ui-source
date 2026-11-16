// The parts of sf-input-image that are about data, not the page: which files
// the field accepts, the shape its value takes and how a size reads. Kept
// apart from the element so the contract tests can run them in Node, as
// sf-resizer's engine.mjs is.

// The size rule is core's format module (core/js/format-file-size.js, SF.format.fileSize;
// reuse audit 2026-11-02, finding 7) and the name rule the Composition
// renderer's (composition/file-size.mjs), so a size reads the same in a field,
// on a page and in a Pro list; this module re-exports the formatter.
import {fileNameFromAddress as nameFromAddress} from '../../core/js/composition/file-size.mjs';
import {formatFileSize} from '../../core/js/format-file-size.js';

export {formatFileSize};

// Whether a file is one the accept list names, and why one is refused: the
// upload core's own rules (component/file-upload/js/intake.mjs, C81), the
// ones sf-file-upload applies, so a list and an image field refuse a file for
// the same reasons. Written here once before; the core module binds nothing,
// so a page with only an image field loads no file area with it.
export {acceptFormats, acceptsFile, fileRejection, positiveLimit} from '../../component/file-upload/js/intake.mjs';

// The kinds of image that can hold transparent pixels: the field draws the
// checkerboard under them (C86), so a white logo is seen. A JPEG cannot, and
// letterboxing around it is not the picture's.
const MAY_BE_TRANSPARENT = /^image\/(?:png|apng|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/u;
const TRANSPARENT_EXTENSION = /\.(?:png|apng|gif|webp|avif|svg|ico)(?:[?#]|$)/iu;

export function mayBeTransparent(value) {
  if (!value) return false;
  const mime = String(value.mime || '').toLowerCase();
  if (mime) return MAY_BE_TRANSPARENT.test(mime);
  const href = String(value.href || '');
  const svgData = /^data:image\/svg\+xml[,;]/iu.test(href);
  const pngData = /^data:image\/(?:png|gif|webp|avif)[,;]/iu.test(href);
  return svgData || pngData || TRANSPARENT_EXTENSION.test(String(value.label || '')) || TRANSPARENT_EXTENSION.test(href);
}

const unit = (number) => {
  const value = Number(number);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
};

// Reads a list of names (sources, edit) against the names it may hold, in
// their order there. Commas, spaces or both separate them: the docs write
// `device,library,url`, a page may write `device library url` or
// `crop, focus`, and each reads the same.
export function listOf(text, known) {
  const asked = String(text ?? '').split(/[\s,]+/u).filter(Boolean);
  return known.filter((name) => asked.includes(name));
}

// A point on the picture, 0..1 across and down: the focal point (C94 point 3).
export function normaliseFocus(input) {
  if (!input || typeof input !== 'object') return null;
  return {x: unit(input.x), y: unit(input.y)};
}

// The frame: the aspect it is cut in, the zoom (1..3) and the centre, 0..1.
// The original is kept; the frame is a parameter the server or CDN applies.
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export function normaliseCrop(input) {
  if (!input || typeof input !== 'object') return null;
  const zoom = Number(input.zoom);
  return {
    aspect: String(input.aspect || ''),
    zoom: Number.isFinite(zoom) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) : 1,
    x: unit(input.x),
    y: unit(input.y),
  };
}

// An aspect as CSS writes it, from «16/9», «16:9», «1.91/1» or «1»: «16 / 9».
// Anything else is none.
export function aspectRatio(text) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:[/:]\s*(\d+(?:\.\d+)?))?\s*$/u.exec(String(text ?? ''));
  if (!match) return '';
  const width = Number(match[1]);
  const height = match[2] === undefined ? 1 : Number(match[2]);
  return width > 0 && height > 0 ? `${width} / ${height}` : '';
}

// The value is the file shape the Framework already uses for a stored file --
// the property-view `file` type and the field renderers' file cell:
// {value, label, mime, size, href}. `value` is the host's id for the file,
// `label` its name, `size` bytes (a number) or text the host already
// formatted, `href` the address the image is shown from. A string is taken as
// the address alone, which is what a page with nothing but a URL has; JSON in
// the attribute is the whole shape. Anything else is no image: null.
export function normaliseImageValue(input) {
  if (input === null || input === undefined || input === '') return null;
  let source = input;
  if (typeof source === 'string') {
    const text = source.trim();
    if (!text) return null;
    if (text.startsWith('{')) {
      try {
        source = JSON.parse(text);
      } catch {
        return null;
      }
    } else {
      source = {href: text};
    }
  }
  if (typeof source !== 'object' || Array.isArray(source)) return null;
  const href = source.href ? String(source.href) : '';
  const label = String(source.label ?? source.name ?? (href ? nameFromAddress(href) : ''));
  const id = source.value === undefined || source.value === null ? '' : String(source.value);
  if (!href && !label && !id) return null;
  const value = {
    value: id,
    label,
    mime: String(source.mime ?? source.mimeType ?? ''),
    size: typeof source.size === 'number' ? source.size : String(source.size ?? ''),
    href,
  };
  // What the field knows of the picture beyond the file (C94): its pixels,
  // its description -- or that it is decorative and needs none -- and the
  // focal point and frame chosen in the editor. Each only when it is there,
  // so a value without them reads exactly as it did.
  const width = Number(source.width);
  const height = Number(source.height);
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    value.width = width;
    value.height = height;
  }
  if (source.alt !== undefined && source.alt !== null) value.alt = String(source.alt);
  if (source.decorative === true) value.decorative = true;
  const focus = normaliseFocus(source.focus);
  if (focus) value.focus = focus;
  const crop = normaliseCrop(source.crop);
  if (crop) value.crop = crop;
  // A file chosen in this page and not stored yet carries the File itself.
  if (source.file) value.file = source.file;
  return value;
}
