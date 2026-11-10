// One button, several values (docs review R039, owner decision D11d;
// research ui-control control/research/2026-11-08-cycle-button.md).
//
// sf-button and sf-button-icon share this: the `cycle` setting is a list of
// items shaped like sf-segmented's items ({value, label, icon} and an
// optional `pressed`, which draws the item with the pressed look), `value`
// is the current item, and a press moves to the next item and wraps. The
// `theme-cycle` setting draws a ready theme switch over SF.Loader's theme
// (the same contract as sf-segmented's theme-switch: themePreference,
// setTheme, sf-theme-change).
//
// The name and the icon say the current value («Тема: тёмная»), the tooltip
// says the current and the next («Тема: тёмная. Нажмите — как в системе»),
// and a polite live region says the new value after a press. A cycle is a
// plain button: it carries no aria-pressed, so pressed, label-pressed and
// text-pressed are ignored beside it (with one console warning).

const THEME_VALUES = ['system', 'light', 'dark'];
// «Как в системе» in a cycle is the half-dark, half-light circle (D11d): a
// monitor alone does not say a theme.
export const THEME_ICONS = Object.freeze({system: 'contrast', light: 'light_mode', dark: 'dark_mode'});

function parseList(source) {
  if (Array.isArray(source)) return source;
  const text = String(source ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  // value::label::flags|… as sf-segmented's items take it; a flag icon=<name>
  // names the icon, pressed draws the pressed look.
  return text.split('|').map((entry) => {
    const [value, label = value, flags = ''] = entry.split('::');
    const list = flags.split(',').map((flag) => flag.trim()).filter(Boolean);
    const icon = list.find((flag) => flag.startsWith('icon='));
    return {value: value.trim(), label: label.trim(), icon: icon ? icon.slice(5) : '', pressed: list.includes('pressed')};
  });
}

/** The cycle's items, normalised: a value each, once, in the given order. */
/** Reads the attribute's JSON or value::label::flags form; a list stays a list. */
export function parseCycle(value) {
  return parseList(value);
}

export function cycleItems(source) {
  const seen = new Set();
  return parseList(source)
    .map((item, index) => {
      const one = typeof item === 'string' ? {value: item, label: item} : item;
      if (!one || typeof one !== 'object') return null;
      const value = String(one.value ?? one.id ?? index).trim();
      if (!value || seen.has(value)) return null;
      seen.add(value);
      return {
        value,
        label: String(one.label ?? one.text ?? value),
        icon: String(one.icon || ''),
        lang: String(one.lang || '').trim(),
        pressed: Boolean(one.pressed),
      };
    })
    .filter(Boolean);
}

/** The themes a theme-cycle offers: all three, or the two it names. */
export function themeCycleValues(attribute) {
  const named = String(attribute ?? '').trim().toLowerCase().split(/[\s,]+/u)
    .map((word) => (word === 'auto' ? 'system' : word))
    .filter((word) => THEME_VALUES.includes(word));
  const unique = [...new Set(named)];
  // Two themes without «as the system» flip the visible theme; anything else
  // (empty, one word, all three) is the full cycle.
  if (unique.length === 2 && !unique.includes('system')) return ['light', 'dark'];
  return THEME_VALUES;
}

const opposite = (theme) => (theme === 'dark' ? 'light' : 'dark');

function loader() {
  return globalThis.SF?.Loader;
}

/** The theme drawn now (light or dark), whatever the preference. */
export function visibleTheme() {
  const theme = loader()?.theme;
  if (theme === 'dark' || theme === 'light') return theme;
  const root = globalThis.document?.documentElement;
  if (root?.classList?.contains('theme-dark')) return 'dark';
  if (root?.classList?.contains('theme-light')) return 'light';
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/** What the person chose: system, light or dark. */
export function themePreference() {
  const preference = loader()?.themePreference;
  return THEME_VALUES.includes(preference) ? preference : 'system';
}

/**
 * The owner's order (D11d): first the theme opposite to the visible one,
 * then the other, then «as the system». It needs the value before the
 * current one: from an explicit theme reached from the other explicit theme
 * the next is system; from system, or from a theme the page loaded with, the
 * opposite theme. Two themes: always the opposite of the visible theme.
 */
export function nextTheme({values, current, previous}) {
  if (!values.includes('system')) return opposite(visibleTheme());
  if (current === 'system') return opposite(visibleTheme());
  if (previous && previous !== 'system' && previous === opposite(current)) return 'system';
  return opposite(current);
}

/**
 * The cycle state the template reads: {items, item, next, index, name,
 * tooltip}. `words(key, vars)` gives the element's words; `base` is the
 * button's own name (aria-label, or the text of an sf-button).
 */
export function hasCycle(host) {
  if (host.hasAttribute('theme-cycle')) return true;
  const own = host.getProp?.('cycle');
  return Boolean(host.hasAttribute('cycle') || (Array.isArray(own) && own.length));
}

export function cycleState(host, {base = '', words}) {
  if (host.hasAttribute('theme-cycle')) {
    const values = themeCycleValues(host.getAttribute('theme-cycle'));
    const two = !values.includes('system');
    const current = two ? visibleTheme() : themePreference();
    const label = (value) => words(`theme-${value}`);
    const items = values.map((value) => ({value, label: label(value), icon: THEME_ICONS[value], lang: '', pressed: false}));
    const item = items.find((one) => one.value === current) ?? items[0];
    const nextValue = nextTheme({values, current: item.value, previous: host.__sfCyclePrevious});
    const next = items.find((one) => one.value === nextValue) ?? items[0];
    const title = base || words('theme');
    const now = item.value === 'system' ? words('theme-system-now', {vars: {theme: label(visibleTheme())}}) : item.label;
    const name = `${title}: ${now}`;
    return {theme: true, items, item, next, name, tooltip: words('cycle-next', {vars: {name, next: next.label}})};
  }
  const items = cycleItems(host.getProp?.('cycle') ?? host.getAttribute('cycle'));
  if (!items.length) return null;
  const at = Math.max(0, items.findIndex((one) => one.value === (host.getAttribute('value') ?? '')));
  const item = items[at];
  const next = items[(at + 1) % items.length];
  const name = base ? `${base}: ${item.label}` : item.label;
  return {theme: false, items, item, next, name, tooltip: words('cycle-next', {vars: {name, next: next.label}})};
}

/** A cycle beside a toggle's settings: the toggle's are ignored, said once. */
export function warnCycleToggle(host, names) {
  const given = names.filter((name) => host.hasAttribute(name));
  if (!given.length || host.__sfCycleWarned) return;
  host.__sfCycleWarned = true;
  globalThis.console?.warn?.(`[SIMAI Framework] ${host.localName}: cycle and theme-cycle are not toggles; ${given.join(', ')} ignored.`);
}

/**
 * A person's press of a cycle: the next value, the change event and the
 * announcement. Answers true when it moved.
 */
export function pressCycle(host, state) {
  if (!state) return false;
  const previous = state.item.value;
  const value = state.next.value;
  // Said after the drawing that follows: the flag first, as the drawing may
  // come at once.
  const before = host.__sfCyclePrevious;
  host.__sfCycleAnnounce = true;
  host.__sfCyclePrevious = previous;
  if (state.theme) {
    // The Loader moves the page first, so a listener of change finds the
    // page in the theme it chose; a Loader that cannot (absent, or the
    // theme switched off) leaves the cycle where it is.
    host.__sfCycleExpect = value;
    if (loader()?.setTheme?.(value) !== true) {
      host.__sfCycleAnnounce = false;
      host.__sfCyclePrevious = before;
      host.__sfCycleExpect = undefined;
      return false;
    }
  } else {
    host.setAttribute('value', value);
  }
  host.requestComponentUpdate?.('value');
  const item = state.items.find((one) => one.value === value) ?? null;
  host.sfEmit('change', {previous, value, item: item ? {...item} : null});
  return true;
}

/**
 * sf-theme-change for a theme cycle: a theme set elsewhere (another switch,
 * SF.Loader.setTheme) starts the order afresh from what is shown.
 */
export function themeCycleFollow(host) {
  if (!host.hasAttribute('theme-cycle')) return;
  const values = themeCycleValues(host.getAttribute('theme-cycle'));
  const now = values.includes('system') ? themePreference() : visibleTheme();
  if (host.__sfCycleExpect !== now) host.__sfCyclePrevious = undefined;
  host.__sfCycleExpect = undefined;
  host.requestComponentUpdate?.('theme-cycle');
}

// The icons a control can switch to, asked for before it switches (R074).
// Only the icon on screen was tracked, so the first press that showed another
// one asked the subset service for a grown font on the click, and the new
// icon stayed blank while the service built it (up to ~30 s when it was busy).
// Asked for when the control is drawn, the names join the page's first icon
// request (held until the Loader is ready); a control added later costs one
// grown font off the click.

/**
 * The icon entries ({icon, filled}) a cycle, a theme cycle or a toggle can
 * show. `icons` are a toggle's own icon names: with `pressed` present they
 * are drawn filled while on, so both forms are asked for. `filled` is the
 * control's own filled setting (every form filled).
 */
export function switchIconEntries(host, {icons = [], filled = false} = {}) {
  const entries = [];
  const add = (icon, fill) => {
    const name = String(icon || '').trim();
    if (name) entries.push({icon: name, filled: Boolean(fill || filled)});
  };
  if (host.hasAttribute('theme-cycle')) {
    themeCycleValues(host.getAttribute('theme-cycle')).forEach((value) => add(THEME_ICONS[value], false));
  } else if (hasCycle(host)) {
    cycleItems(host.getProp?.('cycle') ?? host.getAttribute('cycle')).forEach((item) => add(item.icon, item.pressed));
  } else if (host.hasAttribute('pressed')) {
    icons.forEach((icon) => {
      add(icon, false);
      add(icon, true);
    });
  }
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.icon}|${entry.filled}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Asks the Loader for these icon entries once per distinct list (a render
 * that draws the same items asks nothing). Answers the number of new names.
 */
export function preloadControlIcons(host, entries) {
  if (!Array.isArray(entries) || !entries.length) return 0;
  const key = JSON.stringify(entries);
  if (host.__sfPreloadedIcons === key) return 0;
  const preload = loader()?.preloadIcons;
  if (typeof preload !== 'function') return 0;
  host.__sfPreloadedIcons = key;
  return preload.call(loader(), entries) || 0;
}

/** switchIconEntries, asked for. */
export function preloadSwitchIcons(host, options = {}) {
  return preloadControlIcons(host, switchIconEntries(host, options));
}
