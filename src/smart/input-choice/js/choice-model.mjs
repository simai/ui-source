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

// How an option's colour is drawn (FO4-2; C302: the look is a template
// parameter, the colour is the option's data): badge -- the name itself as a
// tonal badge in that colour, as a table cell draws it; dot -- a colour circle
// before the name (the menu's colour row, C85).
export const OPTION_LOOKS = Object.freeze(['badge', 'dot']);
// The look of an option's colour when nobody says (option-look unset, no
// former key): the table cell's, the one the Framework drew a colour with
// until now. Which look is the default waits for the owner (q-fo4-colour):
// this constant is that switch.
export const DEFAULT_OPTION_LOOK = 'badge';

// One option: {value, label, caption?, icon?, badge?, price?, term?, image?,
// avatar?, color?, disabled?} -- the shape of sf-input-lookup's options, with
// an icon, a badge, a price with its term and an image. Three visuals draw in
// every appearance (FO-4, FO4-1, FO4-3): avatar a picture before the name,
// icon an icon before it, color the option's colour (a scheme, a hue of the
// static palette or a hex), drawn by the look (option-look, OPTION_LOOKS).
// FO4-2: one data word, color; the former swatch (a circle) and scheme (a
// badge) are read as color with their look until 2027-01-01 (change journal
// input-choice-option-colour-one-key). `title` is read as the label; a
// missing label is the value. An option without a value, or repeating an
// earlier one, is left out: one value names one card.
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
      ...colourOf(source),
      disabled: Boolean(source.disabled),
    });
  }
  return result;
}

// An option's colour and the look its former key said (FO4-2): color, else
// scheme (a badge) or swatch (a circle) until 2027-01-01. A colour that could
// close a declaration is not drawn.
function colourOf(source) {
  const given = [['color', ''], ['scheme', 'badge'], ['swatch', 'dot']]
    .map(([key, look]) => [text(source[key]).trim(), look])
    .find(([value]) => value);
  if (!given || !SWATCH.test(given[0])) return {color: '', look: ''};
  return {color: given[0], look: given[1]};
}

/** The look an option's colour is drawn with: the field's option-look, else its former key's, else the default. */
export function optionLook(item, asked) {
  if (OPTION_LOOKS.includes(asked)) return asked;
  if (OPTION_LOOKS.includes(item?.look)) return item.look;
  return DEFAULT_OPTION_LOOK;
}

// Chosen first (FO4-5): with a search or a host's pages, the options chosen
// when the list opened stand first, in their order, then the rest; what the
// person chooses while it is open moves nothing.
export function chosenFirst(items, opened) {
  if (!opened?.size) return items;
  return [...items.filter((item) => opened.has(item.value)), ...items.filter((item) => !opened.has(item.value))];
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
