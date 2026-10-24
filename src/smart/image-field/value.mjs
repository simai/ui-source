// The parts of sf-image-field that are about data, not the page: which files
// the field accepts, the shape its value takes and how a size reads. Kept
// apart from the element so the contract tests can run them in Node, as
// sf-resizer's engine.mjs is.

// Whether a file is one the accept list names: `.ext`, `type/*` or `type/sub`,
// as the platform dialog reads it. The dialog filters what a person may pick;
// a drop goes past it and would take any file at all. It is the rule
// sf-file-upload applies to a drop, written again here rather than imported:
// that module binds every .sf-file-upload on the page as it loads, which a
// page with only an image field has no use for.
export function acceptsFile(accept, file) {
  const tokens = String(accept || '').split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

function nameFromAddress(href) {
  const tail = String(href).split(/[?#]/u)[0].split('/').pop() || '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
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
  // A file chosen in this page and not stored yet carries the File itself.
  if (source.file) value.file = source.file;
  return value;
}

// A size as people read it: «2 КБ», «1,4 МБ». `units` are the four words in
// the page's language, `locale` its formatting. Text the host already
// formatted is returned as it came; anything that is not a size is ''.
export function formatFileSize(size, units = ['B', 'KB', 'MB', 'GB'], locale = 'en') {
  if (typeof size === 'string') return size;
  const bytes = Number(size);
  if (size === null || size === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = index === 0 || amount >= 10 ? 0 : 1;
  let number;
  try {
    number = new Intl.NumberFormat(locale, {maximumFractionDigits: digits}).format(amount);
  } catch {
    number = amount.toFixed(digits);
  }
  return `${number} ${units[index]}`;
}
