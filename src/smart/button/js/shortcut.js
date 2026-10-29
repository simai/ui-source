// A key combination as sf-button's shortcut setting writes it: words joined
// by +, the modifiers first and the key last -- mod+k, shift+/, /, escape.
// `mod` is the platform's command modifier: Cmd on Apple platforms, Ctrl
// elsewhere. Read once per render; nothing here holds state.

const MODIFIERS = ['mod', 'ctrl', 'alt', 'shift', 'meta'];

// What a person reads on a key cap, per platform.
const MAC_CAPS = {mod: '⌘', meta: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧'};
const OTHER_CAPS = {mod: 'Ctrl', meta: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift'};
// A modifier's cap reads differently per platform (⌘ or Ctrl), but a server
// prints one of them and the visitor's browser draws the other: the cap keeps
// the box of its wider word on every platform, in characters of the keys'
// monospace face, so the first paint does not move (sheet:
// .sf-button-shortcut-key--chars-N).
const MODIFIER_CHARS = Object.fromEntries(Object.keys(OTHER_CAPS).map((name) => [name, Math.max(MAC_CAPS[name].length, OTHER_CAPS[name].length)]));
const KEY_CAPS = {
  enter: '↵', return: '↵', escape: 'Esc', esc: 'Esc', tab: 'Tab', space: 'Space', backspace: '⌫', delete: 'Del',
  up: '↑', down: '↓', left: '←', right: '→', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  home: 'Home', end: 'End', pageup: 'PgUp', pagedown: 'PgDn',
};
// The names of KeyboardEvent.key for the words above.
const KEY_NAMES = {
  enter: 'Enter', return: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab', space: ' ', backspace: 'Backspace',
  delete: 'Delete', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', home: 'Home', end: 'End',
  pageup: 'PageUp', pagedown: 'PageDown',
};
// KeyboardEvent.code of the punctuation a shortcut is usually written with,
// so the combination is heard on any keyboard layout.
const PUNCTUATION_CODES = {'/': 'Slash', '.': 'Period', ',': 'Comma', ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight', '-': 'Minus', '=': 'Equal', '`': 'Backquote', '\\': 'Backslash'};

export function isApplePlatform() {
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '';
  return /mac|iphone|ipad|ipod/iu.test(platform);
}

/**
 * The combination as parts: `{modifiers: Set, key}`, or null when there is
 * none. `+` as the key itself is written `mod+plus`.
 */
export function parseShortcut(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;
  const words = text === '+' ? ['+'] : text.split('+').map((word) => word.trim()).filter(Boolean);
  if (!words.length) return null;
  const key = words.at(-1) === 'plus' ? '+' : words.at(-1);
  const modifiers = new Set(words.slice(0, -1).filter((word) => MODIFIERS.includes(word)));
  return {modifiers, key};
}

/**
 * What the keys read, one cap per key in the platform's words: {text, chars},
 * chars the width a modifier's cap keeps on every platform (null for the key).
 */
export function shortcutCaps(parsed, apple = isApplePlatform()) {
  if (!parsed) return [];
  const caps = apple ? MAC_CAPS : OTHER_CAPS;
  const order = apple ? ['ctrl', 'alt', 'shift', 'mod', 'meta'] : ['mod', 'ctrl', 'meta', 'alt', 'shift'];
  const modifiers = [];
  for (const name of order.filter((one) => parsed.modifiers.has(one))) {
    // On a Mac mod and meta are one key.
    if (modifiers.some((cap) => cap.text === caps[name])) continue;
    modifiers.push({text: caps[name], chars: MODIFIER_CHARS[name]});
  }
  const key = KEY_CAPS[parsed.key] ?? (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1));
  return [...modifiers, {text: key, chars: null}];
}

/** The value of aria-keyshortcuts (WAI-ARIA 1.2): Meta+K, Control+K, /. */
export function ariaKeyShortcuts(parsed, apple = isApplePlatform()) {
  if (!parsed) return '';
  const names = [];
  if (parsed.modifiers.has('ctrl') || (parsed.modifiers.has('mod') && !apple)) names.push('Control');
  if (parsed.modifiers.has('alt')) names.push('Alt');
  if (parsed.modifiers.has('shift')) names.push('Shift');
  if (parsed.modifiers.has('meta') || (parsed.modifiers.has('mod') && apple)) names.push('Meta');
  const key = KEY_NAMES[parsed.key] ?? (parsed.key === ' ' ? 'Space' : parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key);
  return [...names, key === ' ' ? 'Space' : key].join('+');
}

// Whether the event's key is the combination's key: by the character it
// typed, or by the physical key for a letter, a digit or the punctuation
// above, so mod+k is heard on a Russian layout too.
function sameKey(event, key) {
  const name = KEY_NAMES[key];
  if (name) return event.key === name;
  if (String(event.key).toLowerCase() === key) return true;
  if (/^[a-z]$/u.test(key)) return event.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/u.test(key)) return event.code === `Digit${key}`;
  return PUNCTUATION_CODES[key] !== undefined && event.code === PUNCTUATION_CODES[key];
}

/** Whether a keydown is the combination. */
export function matchesShortcut(event, parsed, apple = isApplePlatform()) {
  if (!parsed || !event) return false;
  const wants = {
    ctrl: parsed.modifiers.has('ctrl') || (parsed.modifiers.has('mod') && !apple),
    meta: parsed.modifiers.has('meta') || (parsed.modifiers.has('mod') && apple),
    alt: parsed.modifiers.has('alt'),
    shift: parsed.modifiers.has('shift'),
  };
  if (Boolean(event.ctrlKey) !== wants.ctrl || Boolean(event.metaKey) !== wants.meta || Boolean(event.altKey) !== wants.alt) return false;
  // Shift is part of typing a punctuation mark on many layouts (? is shift+/):
  // a combination that does not name it does not mind it for punctuation, and
  // minds it for a letter, a digit or a named key.
  const punctuation = parsed.key.length === 1 && !/^[a-z0-9]$/u.test(parsed.key);
  if (!punctuation && Boolean(event.shiftKey) !== wants.shift) return false;
  if (punctuation && wants.shift && !event.shiftKey) return false;
  return sameKey(event, parsed.key);
}

/** A combination with mod, ctrl, alt or meta is a command even in a field. */
export function isCommandShortcut(parsed) {
  return Boolean(parsed) && ['mod', 'ctrl', 'alt', 'meta'].some((name) => parsed.modifiers.has(name));
}

/** Whether focus is where a person types: a field, a select or editable text. */
export function isEditableTarget(target) {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.localName;
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag !== 'input') return false;
  const type = (element.getAttribute('type') || 'text').toLowerCase();
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden'].includes(type);
}
