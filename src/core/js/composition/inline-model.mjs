// Pure operations on the Composition inline content model used by
// content.heading and content.paragraph: text runs with strong, em, code and
// strike marks, soft line breaks ({type: 'break', marks?}), links whose
// children are text runs and breaks, and inline component atoms
// ({type: 'component', name, props}). No DOM access here.
//
// Inline model 1.2.0 (2026-11-10): the break and the mark strike. A break is
// one unit of offset, like a character: it takes marks and stands inside a
// link, and no operation removes one except a deletion of its own range.
//
// Every other entry -- a node from a newer producer, or an atom this model
// does not know -- is opaque: it holds one caret stop, takes no marks, and
// comes back out of every operation exactly as it went in. toSegments used
// to drop such entries, so an edit next to them lost them silently.
//
// Extension keys (2026-11-11, owner rule: no silent data loss): a key a
// newer producer adds to a known entry -- a text run's `lang`, a link's
// `title`, any other -- rides with that entry through every operation
// (normalize, typing, marks, links, slice, split, join, copy). Runs merge
// only when their extension keys are the same. Validation accepts a key as
// extension data when its name matches INLINE_EXTENSION_KEY (lowercase,
// not one of the model's own names, not on*, not a forbidden name such as
// style or class); render never draws one.

export const INLINE_MARKS = Object.freeze(['strong', 'em', 'code', 'strike']);
export const INLINE_MODEL_VERSION = '1.2.0';
const MARK_ORDER = new Map(INLINE_MARKS.map((mark, index) => [mark, index]));
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// The keys each known entry defines; any other key is extension data.
const OWN_KEYS = Object.freeze({ text: ['type', 'value', 'marks'], break: ['type', 'marks'], link: ['type', 'href', 'children'], component: ['type', 'name', 'props'] });
// Names an extension key may not take: the model's own (on any entry), an
// event handler (on*), and the Document's forbidden names (validation's
// FORBIDDEN_KEYS: executable, styling or secret data, F1.6).
export const INLINE_RESERVED_KEYS = Object.freeze(['type', 'value', 'marks', 'href', 'children', 'name', 'props']);
export const INLINE_FORBIDDEN_KEYS = Object.freeze([
  'html', 'innerhtml', 'script', 'javascript', 'php', 'eval', 'function',
  'expression', 'query', 'sql', 'graphql', 'class', 'classname', 'rootclass',
  'cssclass', 'style', 'secret', 'password', 'token', 'cookie', 'authorization', 'request',
]);
/** The name rule of an extension key, as a JSON Schema pattern (patternProperties). */
export const INLINE_EXTENSION_KEY = `^(?!on)(?!(?:${[...INLINE_RESERVED_KEYS, ...INLINE_FORBIDDEN_KEYS].join('|')})$)[a-z][a-z0-9_.:]{0,63}$`;
const EXTENSION_PATTERN = new RegExp(INLINE_EXTENSION_KEY, 'u');
/** Whether a key is accepted as extension data on a known inline entry. */
export const isInlineExtensionKey = (key) => EXTENSION_PATTERN.test(key);

// The extension keys of an entry: every key its type does not define, as it came.
function extensionsOf(entry, kind) {
  const own = OWN_KEYS[kind];
  const out = {};
  for (const [key, value] of Object.entries(entry)) if (!own.includes(key)) out[key] = clone(value);
  return Object.keys(out).length ? out : null;
}
/** The extension keys of a known entry (text, break, link, component), or null. */
export function inlineExtensions(entry) {
  return isPlainEntry(entry) && Object.hasOwn(OWN_KEYS, entry.type) ? extensionsOf(entry, entry.type) : null;
}
const sameExtra = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
export const INLINE_LIMITS = Object.freeze({ maxTextLength: 100000, maxHrefLength: 2048, maxPropLength: 1000 });

// The closed list of inline atoms. Each name draws one element; its props
// are that component's own settings, a string (text) or a token (a name the
// component reads from a fixed set) or a boolean. Nothing else is drawn, so
// no prop can become an event handler or markup.
export const INLINE_COMPONENTS = Object.freeze({
  badge: Object.freeze({ tag: 'sf-badge', required: [], props: Object.freeze({ text: 'text', icon: 'token', appearance: 'token', scheme: 'token', status: 'token', size: 'token', compact: 'boolean' }) }),
  kbd: Object.freeze({ tag: 'kbd', required: ['text'], props: Object.freeze({ text: 'text' }) }),
  icon: Object.freeze({ tag: 'sf-icon', required: ['icon'], props: Object.freeze({ icon: 'token', label: 'text', size: 'token', filled: 'boolean' }) }),
  button: Object.freeze({ tag: 'sf-button', required: [], props: Object.freeze({ text: 'text', icon: 'token', appearance: 'token', scheme: 'token', size: 'token' }) }),
});
const TOKEN = '^[a-z0-9][a-z0-9_/-]{0,63}$';
const TOKEN_PATTERN = new RegExp(TOKEN, 'u');
// The one unit an atom or an opaque node holds in segment offsets.
export const INLINE_OBJECT = '\ufffc';

/** JSON Schema of one inline atom per name, for the type manifests. */
export function inlineComponentSchemas() {
  const prop = (kind) => (kind === 'boolean' ? { type: 'boolean' } : kind === 'token' ? { type: 'string', pattern: TOKEN } : { type: 'string', maxLength: INLINE_LIMITS.maxPropLength });
  return Object.entries(INLINE_COMPONENTS).map(([name, entry]) => ({
    type: 'object',
    required: ['type', 'name', ...(entry.required.length ? ['props'] : [])],
    additionalProperties: false,
    patternProperties: { [INLINE_EXTENSION_KEY]: {} },
    properties: {
      type: { const: 'component' },
      name: { const: name },
      props: {
        type: 'object',
        ...(entry.required.length ? { required: [...entry.required] } : {}),
        additionalProperties: false,
        properties: Object.fromEntries(Object.entries(entry.props).map(([key, kind]) => [key, prop(kind)])),
      },
    },
  }));
}

/** True for an atom whose name is declared and whose props are all declared and well typed. */
export function isInlineComponent(node) {
  const entry = node?.type === 'component' && Object.hasOwn(INLINE_COMPONENTS, node.name) ? INLINE_COMPONENTS[node.name] : null;
  if (!entry) return false;
  if (Object.keys(node).some((key) => !['type', 'name', 'props'].includes(key) && !isInlineExtensionKey(key))) return false;
  const props = node.props ?? {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false;
  if (entry.required.some((key) => !(key in props))) return false;
  return Object.entries(props).every(([key, value]) => {
    const kind = Object.hasOwn(entry.props, key) ? entry.props[key] : null;
    if (kind === 'boolean') return typeof value === 'boolean';
    if (kind === 'token') return typeof value === 'string' && TOKEN_PATTERN.test(value);
    return kind === 'text' && typeof value === 'string' && value.length <= INLINE_LIMITS.maxPropLength;
  });
}

/** The tag and attributes an atom draws as; text is a kbd's content. Values are raw: the caller escapes. */
export function inlineComponentView(node) {
  if (!isInlineComponent(node)) return null;
  const entry = INLINE_COMPONENTS[node.name];
  const props = node.props ?? {};
  if (node.name === 'kbd') return { tag: entry.tag, attributes: [], text: props.text };
  const attributes = Object.keys(entry.props).filter((key) => key in props && props[key] !== false)
    .map((key) => [key, props[key] === true ? '' : props[key]]);
  return { tag: entry.tag, attributes, text: '' };
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const isAtom = (entry) => entry?.type === 'component';
const isObjectEntry = (entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry) && entry.type !== 'text' && entry.type !== 'link' && !isBreak(entry);
// A break as the model knows it: type break, marks (if any) a list; any
// other key is its extension data.
const isBreak = (entry) => entry?.type === 'break' && (entry.marks === undefined || Array.isArray(entry.marks));

/** The segment of one soft line break: one unit, with the marks and link of its place. */
export function breakSegment(marks = [], href = null, extra = null) {
  return { text: INLINE_OBJECT, marks: [...marks], href, break: true, ...(extra ? { extra } : {}) };
}

/** Same link rule as Document validation: relative, fragment or http(s)/mailto/tel. */
export function safeHref(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > INLINE_LIMITS.maxHrefLength) return false;
  // Browsers read "/\\host" like "//host": backslashes never form a local link.
  if (/^(?:\/|\.?\.\/|#)/u.test(value)) return !value.startsWith('//') && !value.includes('\\');
  try {
    return SAFE_SCHEMES.has(new globalThis.URL(value).protocol);
  } catch {
    return false;
  }
}

// Known marks in their canonical order, then any mark this model does not
// know (a newer producer's), in the order it came: an edit never drops a mark
// it cannot draw. Validation still refuses an unknown mark; render draws none.
function sortMarks(marks) {
  const unique = [...new Set(marks)].filter((mark) => typeof mark === 'string' && mark);
  const known = unique.filter((mark) => MARK_ORDER.has(mark)).sort((left, right) => MARK_ORDER.get(left) - MARK_ORDER.get(right));
  return [...known, ...unique.filter((mark) => !MARK_ORDER.has(mark))];
}

/**
 * Flat segments: {text, marks: string[], href: string|null}. An atom or an
 * opaque node is one segment {text: INLINE_OBJECT, marks: [], href, node}
 * that carries the entry unchanged. An atom ({type: 'component'}) never
 * carries a link's href: a link holds no atom, so one that held an atom is
 * split around it. An opaque node from a newer producer keeps its link.
 */
export function toSegments(content) {
  const segments = [];
  const push = (run, href, linkExtra) => {
    const link = href && linkExtra ? { linkExtra } : {};
    if (isBreak(run)) {
      segments.push({ ...breakSegment(sortMarks(run.marks || []), href, extensionsOf(run, 'break')), ...link });
      return;
    }
    if (isObjectEntry(run)) {
      segments.push({ text: INLINE_OBJECT, marks: [], href: isAtom(run) ? null : href, node: clone(run), ...(isAtom(run) ? {} : link) });
      return;
    }
    if (run?.type !== 'text' || typeof run.value !== 'string' || !run.value) return;
    const extra = extensionsOf(run, 'text');
    segments.push({ text: run.value, marks: sortMarks(Array.isArray(run.marks) ? run.marks : []), href, ...(extra ? { extra } : {}), ...link });
  };
  for (const entry of Array.isArray(content) ? content : []) {
    if (entry?.type === 'link') {
      // An unsafe link is dropped by design (its href and its extension keys); its text stays.
      const href = safeHref(entry.href) ? entry.href : null;
      const linkExtra = isPlainEntry(entry) ? extensionsOf(entry, 'link') : null;
      for (const child of Array.isArray(entry.children) ? entry.children : []) push(child, href, linkExtra);
    } else push(entry, null, null);
  }
  return segments;
}

const isPlainEntry = (entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry);
const sameStyle = (left, right) => !left.node && !right.node && !left.break && !right.break && left.href === right.href && left.marks.join() === right.marks.join()
  && sameExtra(left.extra, right.extra) && sameExtra(left.linkExtra, right.linkExtra);

/** Builds normalized content: merged runs, canonical marks, no empty parts. */
export function fromSegments(segments) {
  const merged = [];
  for (const segment of segments) {
    // A link's extension keys go only where the link goes.
    const linked = (href) => (href && segment.linkExtra ? { linkExtra: segment.linkExtra } : {});
    if (segment.node) {
      // An atom is never inside a link: the link stops before it and starts again after.
      const href = !isAtom(segment.node) && segment.href && safeHref(segment.href) ? segment.href : null;
      merged.push({ text: INLINE_OBJECT, marks: [], href, node: segment.node, ...linked(href) });
      continue;
    }
    if (segment.break) {
      const href = segment.href && safeHref(segment.href) ? segment.href : null;
      merged.push({ ...breakSegment(sortMarks(segment.marks || []), href, segment.extra || null), ...linked(href) });
      continue;
    }
    if (!segment.text) continue;
    const cleanHref = segment.href && safeHref(segment.href) ? segment.href : null;
    const clean = { text: segment.text, marks: sortMarks(segment.marks || []), href: cleanHref, ...(segment.extra ? { extra: segment.extra } : {}), ...linked(cleanHref) };
    const previous = merged.at(-1);
    if (previous && sameStyle(previous, clean)) previous.text += clean.text;
    else merged.push(clean);
  }
  const content = [];
  for (const segment of merged) {
    const extra = segment.extra ? clone(segment.extra) : {};
    const run = segment.node ? clone(segment.node)
      : segment.break ? { type: 'break', ...(segment.marks.length ? { marks: segment.marks } : {}), ...extra }
        : { type: 'text', value: segment.text, ...(segment.marks.length ? { marks: segment.marks } : {}), ...extra };
    const previous = content.at(-1);
    if (segment.href) {
      if (previous?.type === 'link' && previous.href === segment.href && sameExtra(linkExtraOf(previous), segment.linkExtra)) previous.children.push(run);
      else content.push({ type: 'link', href: segment.href, ...(segment.linkExtra ? clone(segment.linkExtra) : {}), children: [run] });
    } else content.push(run);
  }
  return content;
}

const linkExtraOf = (link) => extensionsOf(link, 'link');

export function normalizeInline(content) {
  return fromSegments(toSegments(content));
}

/** The text of the text runs, a line feed for each break; atoms and opaque nodes add nothing. */
export function inlineText(content) {
  return toSegments(content).filter(({ node }) => !node).map((segment) => (segment.break ? '\n' : segment.text)).join('');
}

/** Length in segment offsets: characters, plus one for each atom or opaque node. */
export function inlineLength(content) {
  return toSegments(content).reduce((sum, { text }) => sum + text.length, 0);
}

/** The atom or opaque node that holds offset [at, at + 1), or null. */
export function objectAt(content, at) {
  let position = 0;
  for (const segment of toSegments(content)) {
    if (position === at && segment.node) return segment.node;
    position += segment.text.length;
    if (position > at) return null;
  }
  return null;
}

/** The segments of [start, end), for copying. */
export function sliceInline(content, start, end) {
  const [from, to] = [Math.min(start, end), Math.max(start, end)];
  return fromSegments(range(content, from, to).filter(({ inside }) => inside).map(({ segment }) => segment));
}

function split(segments, offset) {
  const output = [];
  let position = 0;
  for (const segment of segments) {
    const end = position + segment.text.length;
    if (offset > position && offset < end) {
      output.push({ ...segment, text: segment.text.slice(0, offset - position) }, { ...segment, text: segment.text.slice(offset - position) });
    } else output.push(segment);
    position = end;
  }
  return output;
}

function range(content, start, end) {
  const segments = split(split(toSegments(content), start), end);
  let position = 0;
  return segments.map((segment) => {
    const from = position;
    position += segment.text.length;
    return { segment, inside: from >= start && position <= end && position > from };
  });
}

/** Marks and link shared by every character in [start, end). */
export function marksIn(content, start, end) {
  // Atoms take no marks and no link, so they do not decide the state.
  const inside = range(content, Math.min(start, end), Math.max(start, end)).filter(({ inside: isInside, segment }) => isInside && !segment.node).map(({ segment }) => segment);
  if (!inside.length) return { marks: [], href: null };
  const marks = INLINE_MARKS.filter((mark) => inside.every((segment) => segment.marks.includes(mark)));
  const href = inside.every((segment) => segment.href === inside[0].href) ? inside[0].href : null;
  return { marks, href };
}

/** Adds the mark to [start, end) unless every character already has it. */
export function toggleMark(content, start, end, mark) {
  if (!MARK_ORDER.has(mark) || start === end) return normalizeInline(content);
  const [from, to] = [Math.min(start, end), Math.max(start, end)];
  const remove = marksIn(content, from, to).marks.includes(mark);
  return fromSegments(range(content, from, to).map(({ segment, inside }) => (inside && !segment.node
    ? { ...segment, marks: remove ? segment.marks.filter((entry) => entry !== mark) : [...segment.marks, mark] }
    : segment)));
}

/** Sets or removes (href null) a link on [start, end); unsafe links are refused. */
export function setLink(content, start, end, href) {
  if (href !== null && !safeHref(href)) throw new TypeError('inline_link_unsafe');
  const [from, to] = [Math.min(start, end), Math.max(start, end)];
  if (from === to) return normalizeInline(content);
  // An atom is never nested in a link: the link stops on each side of it.
  return fromSegments(range(content, from, to).map(({ segment, inside }) => (inside && !segment.node ? { ...segment, href } : segment)));
}

/** Replaces [start, end) with segments (typing, paste or deletion). */
export function replaceRange(content, start, end, inserted) {
  const [from, to] = [Math.min(start, end), Math.max(start, end)];
  const parts = range(content, from, to);
  const before = parts.filter((_, index) => parts.slice(0, index + 1).reduce((sum, part) => sum + part.segment.text.length, 0) <= from).map(({ segment }) => segment);
  let consumed = 0;
  const after = [];
  for (const { segment } of parts) {
    const segmentStart = consumed;
    consumed += segment.text.length;
    if (segmentStart >= to) after.push(segment);
  }
  return fromSegments([...before, ...inserted, ...after]);
}

export default { INLINE_EXTENSION_KEY, INLINE_FORBIDDEN_KEYS, INLINE_RESERVED_KEYS, inlineExtensions, isInlineExtensionKey, INLINE_COMPONENTS, INLINE_MARKS, INLINE_MODEL_VERSION, INLINE_OBJECT, breakSegment, fromSegments, inlineComponentSchemas, inlineComponentView, inlineLength, inlineText, isInlineComponent, marksIn, normalizeInline, objectAt, replaceRange, safeHref, setLink, sliceInline, toSegments, toggleMark };
