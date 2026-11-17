// The parts of sf-input-choice that are about data, not the page: the shape an
// option takes, the value read from an attribute or a property, and a choice
// applied to it. Kept apart from the element so the contract tests run them
// in Node.

// The grid: auto fills the width with cards of a minimum width; a number is
// the most columns, fewer where they do not fit.
export const CHOICE_COLUMNS = Object.freeze(['auto', '1', '2', '3', '4']);

// The arrangement of the cards (owner decision C28): list -- one frame of
// rows divided by lines, the control at the start, price and term a column at
// the end of the name line; tile -- cards in the grid, the control at the end
// of the name line, the price at the foot; picture -- tiles whose image runs
// to the edges, the caption under it (rows on a phone).
export const CHOICE_LAYOUTS = Object.freeze(['tile', 'list', 'picture']);

// The appearance (owner decision C165 (1), dispatcher's names 2026-11-14):
// cards -- the cards of C28 above; list -- the ready group of checks or
// radios: a heading with its «?», the hint under it, the options as rows of
// the class checkbox or radio (the rows sf-checkbox and sf-radio draw, C63)
// and the error under the last row.
export const CHOICE_APPEARANCES = Object.freeze(['cards', 'list']);

// How the rows of appearance list stand: the flow setting (C165 (3); name by
// the dispatcher 2026-11-15, read only under appearance list; layout stays
// the cards' tile, list and picture). row -- side by side, 16 apart (C105 H6),
// a column again in a narrow field (a phone); column -- one under another;
// auto -- a row for up to three short options, else a column.
export const CHOICE_FLOWS = Object.freeze(['auto', 'row', 'column']);

// «Short» for auto (C165 (3), prototype checks-study.html#q-inline: «Да /
// Нет», «Физлицо / Организация»): an option of one name line, no
// description, a name of at most this many characters.
export const SHORT_OPTION_LENGTH = 20;
export const ROW_MOST = 3;

// The flow a list draws: row or column as asked; auto (or anything else) a row
// for up to three short options (no description, a short name), else a column.
export function listFlow(asked, items) {
  if (asked === 'row' || asked === 'column') return asked;
  const list = Array.isArray(items) ? items : [];
  const short = list.length > 0 && list.length <= ROW_MOST
    && list.every((item) => !item.caption && String(item.label ?? '').length <= SHORT_OPTION_LENGTH);
  return short ? 'row' : 'column';
}

const text = (value) => (value === null || value === undefined ? '' : String(value));

// A colour an option stands for (FO-4; a colour row of a menu, C85): a CSS
// colour -- a code, var() of a token, light-dark() of two; anything that
// could close the declaration is not drawn.
const SWATCH = /^[#\w\s(),.%/-]+$/u;

// An option's picture (FO-4): an address, or {image | src, text | initials};
// the initials are sf-avatar's when there is no picture. null without either.
function avatarOf(given) {
  if (!given) return null;
  if (typeof given === 'string') return given.trim() ? {image: given.trim(), text: ''} : null;
  if (typeof given !== 'object' || Array.isArray(given)) return null;
  const image = text(given.image ?? given.src ?? given['image-url'] ?? given.imageUrl).trim();
  const initials = text(given.text ?? given.initials).trim();
  return image || initials ? {image, text: initials} : null;
}

// One option: {value, label, caption?, icon?, badge?, price?, term?, image?,
// avatar?, swatch?, scheme?, disabled?} -- the shape of sf-input-lookup's
// options, with an icon, a badge, a price with its term and an image. The
// rows of appearance list draw three more visuals (FO-4): avatar a picture
// before the name, swatch a colour circle before it, scheme the name itself
// as a tonal badge in that scheme, palette hue or hex colour. `title` is read as the label; a missing
// label is the value. An option without a value, or repeating an earlier one, is left
// out: one value names one card.
export function normaliseItems(items) {
  let list = items;
  if (typeof list === 'string') {
    const raw = list.trim();
    if (!raw) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const source = typeof item === 'string' ? {value: item} : item;
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const value = text(source.value).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push({
      value,
      label: text(source.label ?? source.title) || value,
      caption: text(source.caption),
      icon: text(source.icon).trim(),
      badge: text(source.badge).trim(),
      price: text(source.price).trim(),
      term: text(source.term).trim(),
      image: text(source.image).trim(),
      avatar: avatarOf(source.avatar),
      swatch: SWATCH.test(text(source.swatch).trim()) ? text(source.swatch).trim() : '',
      scheme: text(source.scheme).trim(),
      disabled: Boolean(source.disabled),
    });
  }
  return result;
}

// The chosen values from what a host gave: a string -- one value, or values
// separated by commas when multiple -- or a list. Single keeps the first.
export function parseValue(value, multiple = false) {
  let list;
  if (Array.isArray(value)) list = value.map(text);
  else if (multiple) list = text(value).split(',');
  else list = [text(value)];
  const seen = new Set();
  const result = [];
  for (const one of list.map((entry) => entry.trim())) {
    if (!one || seen.has(one)) continue;
    seen.add(one);
    result.push(one);
  }
  return multiple ? result : result.slice(0, 1);
}

// The value as the attribute and the property say it: one value, or the
// values joined by commas.
export function formatValue(values) {
  return values.join(',');
}

// The values in the order of the options; a value no option has keeps its
// place after them (the options may arrive after the value).
export function orderValues(values, items) {
  const chosen = new Set(values);
  const known = items.map((item) => item.value).filter((one) => chosen.has(one));
  const unknown = values.filter((one) => !items.some((item) => item.value === one));
  return [...known, ...unknown];
}

// A press on an option: single takes it; multiple adds or removes it, the
// values kept in the order of the options.
export function applyChoice(values, items, value, checked, multiple = false) {
  if (!multiple) return checked ? [value] : values.filter((one) => one !== value);
  const next = new Set(values);
  if (checked) next.add(value);
  else next.delete(value);
  return orderValues(values.concat(checked ? [value] : []).filter((one, at, all) => next.has(one) && all.indexOf(one) === at), items);
}

// The options a typed query keeps, searched in place (searchable without a
// provider): the name or the description holds the query, case and accents
// folded, as sf-input-lookup searches its inline options.
const fold = (value) => text(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
export function searchItems(items, query) {
  const wanted = fold(query).trim();
  if (!wanted) return items;
  return items.filter((item) => fold(item.label).includes(wanted) || fold(item.caption).includes(wanted));
}

// The options a provider's pages give, after the options given in hand: one
// value names one option, the first one given keeps its place, a later page
// may fill it in.
export function mergeItems(given, paged) {
  const seen = new Map();
  for (const item of [...given, ...paged]) {
    if (!seen.has(item.value)) seen.set(item.value, item);
  }
  return [...seen.values()];
}
