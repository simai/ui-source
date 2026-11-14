// What a screen reader says for a combination (owner decision C191 (10),
// 2026-11-15): the name of each key in the page's language -- «Command»,
// «Ввод», «Стрелка вверх» -- while the caps stay as printed (⌘, ↵, ↑; on
// Russian keyboards the caps are Latin too). ⌘ alone is read as «place of
// interest» or not at all, so the caps are hidden from the reader and these
// words stand in their place.
//
// The names follow the caps the shared helper prints (js/shortcut.js
// shortcutView), so a combination is heard as it is drawn, on either
// platform: ⌘ is Command, ⌃ Control, ⌥ Option on a Mac; Ctrl, Alt and Win
// elsewhere. A cap without a name of its own -- a letter, a digit, F5, / --
// is said as printed. Each name is a key of the kbd component's words
// (lang/<locale>.json, runtime); nothing here reads the page.

// A cap's word, by what it prints.
const CAP_WORDS = {
  '⌘': 'command',
  '⌃': 'control',
  '⌥': 'option',
  '⇧': 'shift',
  Ctrl: 'ctrl',
  Alt: 'alt',
  Shift: 'shift',
  Win: 'win',
  '↵': 'enter',
  Esc: 'escape',
  Tab: 'tab',
  Space: 'space',
  '⌫': 'backspace',
  Del: 'delete',
  '⌦': 'delete',
  '↑': 'up',
  '↓': 'down',
  '←': 'left',
  '→': 'right',
  Home: 'home',
  End: 'end',
  PgUp: 'pageup',
  PgDn: 'pagedown',
  '+': 'plus',
};

// The signs a key text a page wrote for people (⇧⌘L, given as one cap
// because it is not the notation) is read sign by sign.
const SIGNS = new Set(['⌘', '⌃', '⌥', '⇧', '↵', '⌫', '⌦', '↑', '↓', '←', '→']);

/**
 * The parts a reader says for printed caps, in order: `{word}` for a key
 * with a name of its own (a key of the words), `{text}` for one said as
 * printed.
 */
export function spokenParts(caps) {
  const parts = [];
  for (const cap of caps ?? []) {
    const text = String(cap?.text ?? '');
    if (!text) continue;
    const word = CAP_WORDS[text];
    if (word) {
      parts.push({word});
      continue;
    }
    // A cap of the page's own text: its signs by name, the rest as printed.
    let rest = '';
    for (const sign of text) {
      if (SIGNS.has(sign)) {
        if (rest.trim()) parts.push({text: rest.trim()});
        rest = '';
        parts.push({word: CAP_WORDS[sign]});
      } else {
        rest += sign;
      }
    }
    if (rest.trim()) parts.push({text: rest.trim()});
  }
  return parts;
}

/** The words for printed caps, each part said by `say(word)`, one space apart. */
export function spokenText(caps, say) {
  return spokenParts(caps).map((part) => (part.word ? say(part.word) : part.text)).join(' ');
}
