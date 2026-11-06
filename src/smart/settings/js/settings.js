// sf-settings' data: the items a page gives, their values, and the entries of
// sf-menu-context they become in each look. Pure functions, no DOM, so the
// contract test reads them without a browser.
//
// An item is a setting or what stands between settings:
//
//   {id, type: 'switch', text, value: true}                         a boolean
//   {id, type: 'choice', text, value: 'dark', options: [{id, text}]} one of a few
//   {id, type: 'range', text, value: 100, min, max, step, unit}      a number
//   {type: 'heading', text}, {type: 'separator'}
//   {type: 'group', text, items: [...]}                              a titled block
//
// The value lives in the item and nowhere else.

export const LOOKS = ['drill', 'rows', 'tiles'];
export const SIZES = ['1/2', '1'];
export const TYPES = ['switch', 'choice', 'range', 'heading', 'separator', 'group'];
const VALUE_TYPES = new Set(['switch', 'choice', 'range']);

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
  return null;
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

// One setting as a menu entry. A choice's value becomes its options' checked
// marks, the way the menu reads it; drill opens its options in the panel.
function settingEntry(item, look) {
  const base = {...own(item, ['id', 'text', 'caption', 'icon', 'keywords']), type: item.type};
  if (item.disabled) base.disabled = true;
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
function entriesOf(items, look, skip) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!isItem(item)) continue;
    if (item.type === 'heading') {
      out.push({type: 'heading', text: item.text ?? ''});
    } else if (item.type === 'separator') {
      out.push({type: 'separator'});
    } else if (item.type === 'group') {
      const rows = entriesOf(item.items, look, skip);
      if (!rows.length) continue;
      if (item.text) out.push({type: 'heading', text: item.text});
      out.push({type: 'group', ...own(item, ['text']), items: rows});
    } else if (holdsValue(item) && !skip.has(item.id)) {
      out.push(settingEntry(item, look));
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
export function entriesFor(items, look = 'drill', {tilesLabel = ''} = {}) {
  if (look !== 'tiles') return entriesOf(items, look, new Set());
  const tiles = tileItems(items);
  if (!tiles.length) return entriesOf(items, 'rows', new Set());
  const rest = entriesOf(items, 'rows', new Set(tiles.map((item) => item.id)));
  const top = {type: 'group', view: 'tiles', text: tilesLabel, items: tiles.map((item) => settingEntry(item, 'rows'))};
  return rest.length ? [top, {type: 'separator'}, ...rest] : [top];
}
