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

const text = (value) => (value === null || value === undefined ? '' : String(value));

// One option: {value, label, caption?, icon?, badge?, price?, term?, image?,
// disabled?} -- the shape of sf-input-lookup's options, with an icon, a badge,
// a price with its term and an image. `title` is read as the label; a missing
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
