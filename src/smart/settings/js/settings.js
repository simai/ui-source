// sf-settings' data: the items a page gives, their values, and the entries of
// sf-menu-context they become in each look. Pure functions, no DOM, so the
// contract test reads them without a browser.
//
// An item is a setting or what stands between settings:
//
//   {id, type: 'switch', text, value: true}                         a boolean
//   {id, type: 'choice', text, value: 'dark', options: [{id, text}]} one of a few
//   {id, type: 'range', text, value: 100, min, max, step, unit}      a number
//   {id, type: 'color', text, value: 'blue', options?, custom?}       a colour
//   {type: 'heading', text}, {type: 'separator'}
//   {type: 'group', text, items: [...]}                              a titled block
//
// The value lives in the item and nowhere else.

export const LOOKS = ['drill', 'rows', 'tiles'];
export const SIZES = ['1/2', '1'];
export const TYPES = ['switch', 'choice', 'range', 'color', 'heading', 'separator', 'group'];
const VALUE_TYPES = new Set(['switch', 'choice', 'range', 'color']);

// ─── the colour row (owner decision C85) ─────────────────────────────────
//
// A colour setting -- a site's or a reader's colour in a settings menu, beside
// the theme -- is a row with the current colour as a circle in its lead; it
// opens a level of palette hues, each a circle and its word, and, unless
// custom is false, «Свой цвет…», which opens sf-input-color's window on «Своё».
// The value is what sf-input-color stores (C83): a palette hue by its name
// (blue), the same in every language, painted 50 light / 70 dark, or an own
// colour as its code (#rrggbb).

// The sixteen hues of the static palette (C17), the names a colour value may
// take (sf-input-color's PALETTE).
export const HUES = Object.freeze([
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'gray',
]);
// The level a colour row opens when its item names no options: the ten hues
// of the accepted menu (prototype theme-generator-study #practice-menu).
export const COLOR_OPTIONS = Object.freeze(['red', 'orange', 'amber', 'green', 'teal', 'sky', 'blue', 'violet', 'pink', 'gray']);
// The id of the «Свой цвет…» option in the menu's entries.
export const OWN_COLOR = '#own';

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/iu;
const LONG_HEX = /^#?([0-9a-f]{6})$/iu;

/** An own colour's code, lowercase #rrggbb; '' for anything else. */
export function colorCode(value) {
  const text = String(value ?? '').trim();
  const short = SHORT_HEX.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const long = LONG_HEX.exec(text);
  return long ? `#${long[1].toLowerCase()}` : '';
}

/** The CSS colour a colour value paints: a hue's tone for the theme (50 light, 70 dark), or the code. */
export const colorFill = (value) => (HUES.includes(value) ? `light-dark(var(--sf-${value}-50), var(--sf-${value}-70))` : colorCode(value));

// The hues a colour row offers: its options (names, or {id, text}) that are
// palette hues, else the default ten.
function colorOptions(item) {
  const given = Array.isArray(item?.options) ? item.options : null;
  const list = (given ?? COLOR_OPTIONS)
    .map((option) => (typeof option === 'string' ? {id: option} : option))
    .filter((option) => option && HUES.includes(option.id));
  return list;
}

const allowsOwn = (item) => item?.custom !== false;

const isItem = (item) => Boolean(item) && typeof item === 'object' && TYPES.includes(item.type);
const optionsOf = (item) => (Array.isArray(item?.options) ? item.options.filter((option) => option && typeof option === 'object' && option.id !== undefined && option.id !== null) : []);

/** Whether an item holds a value (a switch, a choice or a range with an id). */
export const holdsValue = (item) => isItem(item) && VALUE_TYPES.has(item.type) && typeof item.id === 'string' && item.id !== '';

/**
 * An item's value: a boolean for a switch, a number for a range, the chosen
 * option's id for a choice (its value, else the option marked checked, else
 * null).
 */
export function itemValue(item) {
  if (item?.type === 'switch') return Boolean(item.value);
  if (item?.type === 'range') {
    const number = Number(item.value ?? item.min ?? 0);
    return Number.isFinite(number) ? number : 0;
  }
  if (item?.type === 'choice') {
    const options = optionsOf(item);
    if (item.value !== undefined && item.value !== null && options.some((option) => option.id === item.value)) return item.value;
    return options.find((option) => option.checked)?.id ?? null;
  }
  if (item?.type === 'color') return colorPatch(item, item.value)?.value ?? null;
  return null;
}

// A colour row takes a hue it offers, or a code while it allows an own colour.
function colorPatch(item, value) {
  if (typeof value !== 'string') return null;
  if (colorOptions(item).some((option) => option.id === value)) return {value};
  const code = allowsOwn(item) ? colorCode(value) : '';
  return code ? {value: code} : null;
}

/**
 * What to write into an item to give it a value; null when the item cannot
 * hold that value (a choice without such an option, a range given no number).
 */
export function valuePatch(item, value) {
  if (item?.type === 'switch') return typeof value === 'boolean' ? {value} : null;
  if (item?.type === 'range') {
    if (value === null || value === '' || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isFinite(number) ? {value: number} : null;
  }
  if (item?.type === 'choice') return optionsOf(item).some((option) => option.id === value) ? {value} : null;
  if (item?.type === 'color') return colorPatch(item, value);
  return null;
}

/** Every setting's value by its id, at the depth it sits. */
export function valueMap(items, into = {}) {
  for (const item of Array.isArray(items) ? items : []) {
    if (holdsValue(item)) into[item.id] = itemValue(item);
    if (item?.type === 'group') valueMap(item.items, into);
  }
  return into;
}

/** The item carrying an id, at any depth; null when none does. */
export function findItem(items, id) {
  for (const item of Array.isArray(items) ? items : []) {
    if (holdsValue(item) && item.id === id) return item;
    if (item?.type === 'group') {
      const found = findItem(item.items, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The items with every setting a resolver answers for rewritten: a new list
 * (the lists above a rewritten item are copied), and how many were. A list
 * with nothing to change is given back as it was.
 */
export function rewriteValues(items, resolve) {
  if (!Array.isArray(items)) return {list: items, count: 0};
  let count = 0;
  const list = items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (holdsValue(item)) {
      const patch = resolve(item);
      if (!patch) return item;
      count += 1;
      return {...item, ...patch};
    }
    if (item.type === 'group') {
      const inner = rewriteValues(item.items, resolve);
      if (!inner.count) return item;
      count += inner.count;
      return {...item, items: inner.list};
    }
    return item;
  });
  return {list: count ? list : items, count};
}

// ─── entries of sf-menu-context ───────────────────────────────────────────

const own = (item, keys) => Object.fromEntries(keys.filter((key) => item[key] !== undefined && item[key] !== null).map((key) => [key, item[key]]));

// A colour row as the menu's choice: the current colour as the row's circle,
// the hues as options with their circles and words, and «Свой цвет…» last
// (OWN_COLOR) -- checked, with its circle and code, while the value is one.
function colorEntry(item, base, look, word) {
  const value = itemValue(item);
  const options = colorOptions(item).map((option) => ({
    id: option.id,
    text: option.text ?? word(`hue-${option.id}`),
    swatch: colorFill(option.id),
    checked: option.id === value,
  }));
  const code = colorCode(value);
  if (allowsOwn(item)) {
    options.push(code
      ? {id: OWN_COLOR, text: word('own-color-value', {value: code}), swatch: code, checked: true}
      : {id: OWN_COLOR, text: word('own-color'), icon: 'colorize', checked: false});
  }
  return {...base, type: 'choice', ...(look === 'drill' ? {view: 'drill'} : {}), ...(value ? {swatch: colorFill(value)} : {}), options};
}

// The words a colour row needs when the element gives none (the contract
// test, a server printing entries): the hue's name and the own colour's.
const plainWord = (key, vars = {}) => {
  if (key === 'own-color') return 'Own colour…';
  if (key === 'own-color-value') return `Own: ${vars.value ?? ''}`;
  return key.replace(/^hue-/u, '');
};

// One setting as a menu entry. A choice's value becomes its options' checked
// marks, the way the menu reads it; drill opens its options in the panel.
function settingEntry(item, look, word = plainWord) {
  const base = {...own(item, ['id', 'text', 'caption', 'icon', 'keywords']), type: item.type};
  if (item.disabled) base.disabled = true;
  if (item.type === 'color') return colorEntry(item, base, look, word);
  if (item.type === 'switch') return {...base, value: itemValue(item)};
  if (item.type === 'range') return {...base, ...own(item, ['min', 'max', 'step', 'unit']), value: itemValue(item)};
  const value = itemValue(item);
  const options = optionsOf(item).map((option) => ({
    ...own(option, ['id', 'text', 'icon']),
    ...(option.disabled ? {disabled: true} : {}),
    checked: option.id === value,
  }));
  return {...base, ...(look === 'drill' ? {view: 'drill'} : {}), options};
}

// The entries of a list of items: a group is its title (a heading) and its
// rows; an item of no known type is left out.
function entriesOf(items, look, skip, word) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!isItem(item)) continue;
    if (item.type === 'heading') {
      out.push({type: 'heading', text: item.text ?? ''});
    } else if (item.type === 'separator') {
      out.push({type: 'separator'});
    } else if (item.type === 'group') {
      const rows = entriesOf(item.items, look, skip, word);
      if (!rows.length) continue;
      if (item.text) out.push({type: 'heading', text: item.text});
      out.push({type: 'group', ...own(item, ['text']), items: rows});
    } else if (holdsValue(item) && !skip.has(item.id)) {
      out.push(settingEntry(item, look, word));
    }
  }
  // A separator does not open or close the list, and two do not stand together.
  return out.filter((entry, index, list) => entry.type !== 'separator'
    || (index > 0 && index < list.length - 1 && list[index + 1].type !== 'separator'));
}

/**
 * The switches the tiles look puts on top: those marked tile: true, at any
 * depth; when none is marked, the switches of the top level.
 */
export function tileItems(items) {
  const marked = [];
  const walk = (list) => {
    for (const item of Array.isArray(list) ? list : []) {
      if (holdsValue(item) && item.type === 'switch' && item.tile === true) marked.push(item);
      if (item?.type === 'group') walk(item.items);
    }
  };
  walk(items);
  if (marked.length) return marked;
  return (Array.isArray(items) ? items : []).filter((item) => holdsValue(item) && item.type === 'switch');
}

/**
 * The menu's entries for a look:
 *   drill  every choice opens its options in the panel (view: drill), the
 *          value under the name; the menu is submenu="drill";
 *   rows   the name at the start, the control at the end: quiet pills, a
 *          switch, a slider;
 *   tiles  the tile switches as tiles on top (a group with view: tiles named
 *          tilesLabel), the rest as rows below a separator.
 */
export function entriesFor(items, look = 'drill', {tilesLabel = '', word = plainWord} = {}) {
  if (look !== 'tiles') return entriesOf(items, look, new Set(), word);
  const tiles = tileItems(items);
  if (!tiles.length) return entriesOf(items, 'rows', new Set(), word);
  const rest = entriesOf(items, 'rows', new Set(tiles.map((item) => item.id)), word);
  const top = {type: 'group', view: 'tiles', text: tilesLabel, items: tiles.map((item) => settingEntry(item, 'rows'))};
  return rest.length ? [top, {type: 'separator'}, ...rest] : [top];
}
