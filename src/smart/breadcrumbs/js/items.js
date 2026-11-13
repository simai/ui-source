// The items of sf-breadcrumbs: read from the attribute's JSON or
// "label::flag,key=value|label" form, from the property, or from the
// sf-breadcrumbs-item children, and the page of the trail decided over the
// whole list (R177 BC-01). No DOM and no import: the unit tests read it in
// node, the element imports it into its bundle.

export function parseItemFlags(flagsPart = '') {
  const flags = String(flagsPart || '')
    .split(',')
    .map((flag) => flag.trim())
    .filter(Boolean);
  const item = {};

  flags.forEach((flag) => {
    const [rawKey, ...rawValue] = flag.split('=');
    const key = String(rawKey || '').trim().toLowerCase();
    const value = rawValue.join('=').trim();

    if (!key) return;

    if (['current', 'active', 'disabled', 'ellipsis'].includes(key)) {
      item[key] = value ? !['0', 'false', 'no'].includes(value.toLowerCase()) : true;
      return;
    }

    item[key] = value;
  });

  return item;
}

export function normalizeItem(item = {}, index = 0, total = 0, options = {}) {
  if (typeof item === 'string') {
    return normalizeItem({ label: item }, index, total, options);
  }

  // Which crumb is the page is decided over the whole trail (markCurrent):
  // here only what the item itself says -- true, false, or nothing.
  const label = item.label || item.text || item.title || '';
  // An item read once already carries its flag: reading it again keeps it
  // (its current is only the flag's true).
  const currentFlag = Object.prototype.hasOwnProperty.call(item, 'currentFlag')
    ? item.currentFlag
    : readFlag(item.current) ?? (item.active ? true : undefined);
  const current = currentFlag === true;
  const ellipsis = Boolean(item.ellipsis || label === '...' || label === '…');
  const hiddenItemsSource =
    item.hiddenItems || item.hiddenitems || item['hidden-items'] || item.items;
  const hiddenItems = hiddenItemsSource
    ? parseItems(hiddenItemsSource, { defaultCurrent: false })
    : [];

  return {
    label: ellipsis ? '…' : label,
    href: item.href || item.url || '',
    icon: item.icon || '',
    current,
    currentFlag,
    active: Boolean(item.active || current),
    disabled: Boolean(item.disabled),
    ellipsis,
    target: item.target || '',
    rel: item.rel || '',
    itemClass: item.itemClass || item['item-class'] || '',
    containerClass: item.containerClass || item['container-class'] || '',
    ariaLabel: item.ariaLabel || item['aria-label'] || '',
    value: item.value || '',
    hiddenItems,
    // The crumb's siblings (C93 item 3): shown when the host says siblings.
    siblings: item.siblings ? parseItems(item.siblings) : [],
    index,
  };
}

// true, false or undefined (not said) from a JSON value, a flag or an attribute.
export function readFlag(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(text);
}

// The page of the trail (R177 BC-01). With current="none" -- a trail of
// parents above the page's heading (owner decision C93 item 4) -- no crumb is
// the page and every crumb with an address is a link. Otherwise a crumb that
// says current is the page (the last one that says it), and when none says
// it the last crumb is, unless it says current: false.
export function markCurrent(items = [], mode = 'last') {
  let page = -1;

  if (mode !== 'none') {
    items.forEach((item, index) => {
      if (item.currentFlag === true) page = index;
    });
    if (page < 0 && items.length && items[items.length - 1].currentFlag !== false) {
      page = items.length - 1;
    }
  }

  return items.map((item, index) => {
    const current = index === page && !item.ellipsis;
    return {
      ...item,
      current,
      active: Boolean(
        current || (mode !== 'none' && item.active && item.currentFlag !== false),
      ),
    };
  });
}

export function parseItems(items = '', options = {}) {
  if (Array.isArray(items)) {
    return items.map((item, index) =>
      normalizeItem(item, index, items.length, options),
    );
  }

  const raw = String(items || '').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) =>
        normalizeItem(item, index, parsed.length, options),
      );
    }
  } catch {
    // Plain string format is handled below.
  }

  const entries = raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.map((entry, index) => {
    const [labelPart, ...flagParts] = entry.split('::');
    const flags = parseItemFlags(flagParts.join(','));

    return normalizeItem(
      {
        label: labelPart.trim(),
        ...flags,
      },
      index,
      entries.length,
      options,
    );
  });
}
