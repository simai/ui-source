// sf-lookup's model, without a document: the value, the items an answer
// brings, the list a query shows, a choice and the search's states. The
// element (../index.js) keeps the instance's state and draws it; everything
// here is a plain function of its arguments, so tests/lookup.contract.test.mjs
// runs it in Node and a server can read a submitted value the same way.
//
// The value is the field renderer's lookup value (src/smart/field-renderers,
// lookupItems): {value, label}, or a list of them when multiple. An item may
// carry caption and avatar ({src} or {initials}); they travel with the chosen
// item, so a chip and a row never need a second read.

export const DEFAULTS = Object.freeze({minLength: 2, maxResults: 20, debounce: 120});

// The states of the list area, one line each (the design draft's table).
export const STATES = Object.freeze(['closed', 'hint', 'searching', 'results', 'empty', 'unavailable', 'error']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = (value) => value !== null && value !== undefined && value !== '';

/** The key a value is compared by: its string, as a form sends it. */
export const keyOf = (value) => String(value);

/** A whole number setting read leniently: a non-number or a negative is the fallback. */
export function wholeNumber(value, fallback, {min = 0} = {}) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= min ? number : fallback;
}

/**
 * An image address the avatar may show: http(s), a path on the site, a data
 * image or a blob. Nothing that leaves a CSS url() or an attribute (quotes,
 * brackets, back slashes, white space, control characters), so the address
 * reads the same wherever the picture is drawn.
 */
export function safeImageSource(src) {
  const text = String(src ?? '').trim();
  if (!text || /[\s"'()\\<>]/u.test(text) || [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '';
  if (/^https?:\/\//iu.test(text)) return text;
  if (/^data:image\/(png|jpeg|gif|webp|avif);/iu.test(text)) return text;
  if (/^blob:/iu.test(text)) return text;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  return '';
}

/** An avatar as the model keeps it: {src}, {initials}, or null. */
export function normaliseAvatar(avatar) {
  if (!isObject(avatar)) return null;
  const src = safeImageSource(avatar.src);
  if (src) return {src};
  const initials = String(avatar.initials ?? '').trim().slice(0, 3);
  return initials ? {initials} : null;
}

/**
 * One item of an answer, of the inline options or of the value:
 * {value, label, caption?, avatar?}, or null when it has no value. A label
 * missing is the value's text (a host that sends the value alone is still
 * shown something); `text` is read as the label too, as sf-dropdown's
 * options and the field renderer read it.
 */
export function normaliseItem(raw) {
  if (!isObject(raw) || !present(raw.value)) return null;
  const value = typeof raw.value === 'number' || typeof raw.value === 'string' ? raw.value : keyOf(raw.value);
  const item = {value, label: String(raw.label ?? raw.text ?? value)};
  const caption = raw.caption === null || raw.caption === undefined ? '' : String(raw.caption);
  if (caption) item.caption = caption;
  const avatar = normaliseAvatar(raw.avatar);
  if (avatar) item.avatar = avatar;
  return item;
}

/** A list of items: each normalised, the ones without a value and the repeats dropped. */
export function normaliseItems(list) {
  const seen = new Set();
  const items = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const item = normaliseItem(raw);
    if (!item || seen.has(keyOf(item.value))) continue;
    seen.add(keyOf(item.value));
    items.push(item);
  }
  return items;
}

function parseMaybeJson(raw) {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (!text) return null;
  if (!/^[[{"]/u.test(text)) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * The value as the element holds it: single {value, label, ...} or null;
 * multiple a list in the order chosen, [] when nothing is. Read from a
 * property or from the value attribute (JSON). A bare value (a string or a
 * number) is read against the inline options for its label, as the field
 * renderer reads it; a list given to a single field keeps its first item,
 * one item given to a multiple field is a list of one.
 */
export function normaliseValue(raw, {multiple = false, options = []} = {}) {
  const parsed = parseMaybeJson(raw);
  const list = Array.isArray(parsed) ? parsed : present(parsed) ? [parsed] : [];
  const known = normaliseItems(options);
  const items = normaliseItems(list.map((one) => {
    if (isObject(one)) return one;
    if (!present(one)) return null;
    const option = known.find((candidate) => keyOf(candidate.value) === keyOf(one));
    return option ?? {value: one, label: String(one)};
  }));
  if (multiple) return items;
  return items[0] ?? null;
}

/** The chosen items as a list, whatever the mode. */
export const chosenList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** The values alone, as the form sends them: one entry per chosen item. */
export function formEntries(value) {
  return chosenList(value).map((item) => keyOf(item.value));
}

/** Two values are the same when they hold the same values in the same order. */
export function sameValue(a, b) {
  const left = formEntries(a);
  const right = formEntries(b);
  return left.length === right.length && left.every((one, index) => one === right[index]);
}

/** The keys of `exclude`: a list of values, or of items carrying them. */
export function excludedKeys(exclude) {
  const parsed = parseMaybeJson(exclude);
  const list = Array.isArray(parsed) ? parsed : present(parsed) ? [parsed] : [];
  return new Set(list.map((one) => (isObject(one) ? one.value : one)).filter(present).map(keyOf));
}

/** The items left once the excluded values are taken out (every answer goes through it). */
export function withoutExcluded(items, exclude) {
  const keys = exclude instanceof Set ? exclude : excludedKeys(exclude);
  if (!keys.size) return items;
  return items.filter((item) => !keys.has(keyOf(item.value)));
}

/**
 * The inline options a query shows: the label or the caption holds the query,
 * case and accents of the page's language aside. An empty query shows them
 * all: the list in hand is the whole set.
 */
export function filterOptions(options, query, {exclude, locale} = {}) {
  const items = withoutExcluded(normaliseItems(options), exclude);
  const needle = foldText(query, locale);
  if (!needle) return items;
  return items.filter((item) => foldText(item.label, locale).includes(needle) || foldText(item.caption ?? '', locale).includes(needle));
}

/** Text compared without case and accents (ё is е, as a Russian reader types it). */
export function foldText(text, locale) {
  let lower;
  try {
    lower = String(text ?? '').toLocaleLowerCase(locale || undefined);
  } catch {
    lower = String(text ?? '').toLowerCase();
  }
  return lower.normalize('NFD').replace(/[̀-ͯ]/gu, '').replace(/ё/gu, 'е').trim();
}

/**
 * What a query asks for: 'local' with inline options (searched in place,
 * any length), 'hint' below min-length (nothing is asked), 'search' when the
 * provider is asked, 'none' with neither options nor a provider.
 */
export function searchPlan(query, {minLength = DEFAULTS.minLength, hasOptions = false, hasProvider = false} = {}) {
  if (hasOptions) return 'local';
  if (!hasProvider) return 'none';
  return String(query ?? '').trim().length < minLength ? 'hint' : 'search';
}

/**
 * A provider's answer read into the list's state:
 * {status: 'unavailable'} -> unavailable; {items, nextCursor} -> results or
 * empty, the excluded values taken out and at most `limit` items; anything
 * else (no object, items not a list) -> error. `nextCursor` is kept only when
 * it is given: without it there is no "Show more", however many items came.
 */
export function readAnswer(answer, {exclude, limit = DEFAULTS.maxResults} = {}) {
  if (!isObject(answer)) return {state: 'error', items: [], nextCursor: null};
  if (answer.status === 'unavailable') return {state: 'unavailable', items: [], nextCursor: null};
  if (!Array.isArray(answer.items)) return {state: 'error', items: [], nextCursor: null};
  const items = withoutExcluded(normaliseItems(answer.items).slice(0, Math.max(0, limit)), exclude);
  const nextCursor = present(answer.nextCursor) ? answer.nextCursor : null;
  const read = {state: items.length || nextCursor !== null ? 'results' : 'empty', items, nextCursor};
  // A line of the host's own under the rows: «first 20 shown, narrow your search».
  const notice = typeof answer.notice === 'string' ? answer.notice.trim() : '';
  return notice ? {...read, notice} : read;
}

/** A page of more results joined to what is shown: in order, no item twice. */
export function appendItems(shown, more) {
  const seen = new Set(shown.map((item) => keyOf(item.value)));
  return [...shown, ...more.filter((item) => !seen.has(keyOf(item.value)))];
}

/**
 * A choice: the value it makes and what happened.
 *   single:   the item is the value ('replaced'), or 'unchanged' when it was it;
 *   multiple: a chosen item leaves ('removed'); a new one joins at the end
 *             ('added'), or is 'refused' when max-items are chosen already.
 * `maxItems` 0 is no cap.
 */
export function choose(value, raw, {multiple = false, maxItems = 0} = {}) {
  const item = normaliseItem(raw);
  if (!item) return {value, outcome: 'unchanged'};
  if (!multiple) {
    if (value && keyOf(value.value) === keyOf(item.value)) return {value, outcome: 'unchanged'};
    return {value: item, outcome: 'replaced'};
  }
  const list = chosenList(value);
  if (list.some((one) => keyOf(one.value) === keyOf(item.value))) {
    return {value: list.filter((one) => keyOf(one.value) !== keyOf(item.value)), outcome: 'removed'};
  }
  if (maxItems > 0 && list.length >= maxItems) return {value: list, outcome: 'refused'};
  return {value: [...list, item], outcome: 'added'};
}

/** The value without one chosen item (a chip's remove button, Backspace). */
export function removeChosen(value, key, {multiple = false} = {}) {
  if (!multiple) return value && keyOf(value.value) === keyOf(key) ? null : value;
  return chosenList(value).filter((one) => keyOf(one.value) !== keyOf(key));
}

/** Whether an item is among the chosen. */
export function isChosen(value, item) {
  return chosenList(value).some((one) => keyOf(one.value) === keyOf(item.value));
}

/**
 * The next active row for a key, or -1 for none: ArrowDown and ArrowUp step
 * and stop at the ends, Home and End go to them. From no row, ArrowDown is
 * the first and ArrowUp the last.
 */
export function moveActive(index, count, key) {
  if (count <= 0) return -1;
  switch (key) {
    case 'ArrowDown': return index < 0 ? 0 : Math.min(count - 1, index + 1);
    case 'ArrowUp': return index < 0 ? count - 1 : Math.max(0, index - 1);
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return index;
  }
}
