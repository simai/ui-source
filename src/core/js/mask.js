function getGlobalRoot() {
  if (!window.SF) window.SF = {};
  return window.SF;
}

function resolveElement(target) {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (typeof target === 'string') return document.querySelector(target);
  return null;
}

function digits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

// The pattern grammar the fields document, IMask's: `0` a digit, `a` a letter,
// `*` any character, `{...}` a fixed part that belongs to the value (`+{7}`),
// `[` `]` mark an optional tail and are dropped, `\` escapes the next character,
// and every other character is a fixed part that is only shown. The pattern
// used to be read one way only -- `0` a digit, everything else printed -- and
// the formatter then re-read the digits of its own fixed parts as input, so
// `+{7} (000)` printed its braces and turned `916` into `(777)`.
const SLOT_TESTS = {
  0: (character) => /\d/u.test(character),
  a: (character) => /\p{L}/u.test(character),
  '*': () => true,
};

function parsePattern(pattern) {
  const tokens = [];
  let unmasked = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '\\') {
      index += 1;
      if (index < pattern.length) tokens.push({ fixed: pattern[index], unmasked });
    } else if (character === '{') {
      unmasked = true;
    } else if (character === '}') {
      unmasked = false;
    } else if (character === '[' || character === ']') {
      // Optional sections: every slot is optional while lazy anyway.
    } else if (SLOT_TESTS[character]) {
      tokens.push({ test: SLOT_TESTS[character] });
    } else {
      tokens.push({ fixed: character, unmasked });
    }
  }
  return tokens;
}

// What the person typed, read against the pattern position by position: a
// character that matches the fixed part the pattern expects there is that
// fixed part, a placeholder in a slot is an empty slot, and anything else is
// input for the next slot that accepts it. `before` counts the input taken
// from the first `caret` characters, so the caret can be put back after it.
function extractInput(value, tokens, options = {}, caret = -1) {
  const placeholder = options.placeholderChar || '_';
  const source = String(value ?? '');
  const slots = tokens.filter((token) => token.test);
  const accepted = [];
  let before = 0;
  let pointer = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    while (pointer < tokens.length && tokens[pointer].fixed !== undefined
      && tokens[pointer].fixed !== character) {
      pointer += 1;
    }
    if (pointer >= tokens.length) {
      // Typed past the end of a shown template -- a caret left after the
      // placeholders: the character fills the first empty slot, not nothing.
      if (options.lazy === false && accepted.length < slots.length
        && slots[accepted.length].test(character)) {
        accepted.push(character);
        if (index < caret) before = accepted.length;
      }
      continue;
    }
    const token = tokens[pointer];
    if (token.fixed !== undefined) {
      pointer += 1;
    } else if (options.lazy === false && character === placeholder) {
      pointer += 1;
    } else if (token.test(character)) {
      accepted.push(character);
      if (index < caret) before = accepted.length;
      pointer += 1;
    }
  }
  return { accepted, before };
}

function renderPattern(input, tokens, options = {}) {
  const placeholder = options.placeholderChar || '_';
  const full = options.lazy === false;
  let display = '';
  let unmasked = '';
  const caretAfter = [];
  let firstSlot = -1;
  let cursor = 0;
  for (const token of tokens) {
    if (token.fixed !== undefined) {
      if (cursor >= input.length && !full) break;
      display += token.fixed;
      if (token.unmasked && cursor < input.length) unmasked += token.fixed;
    } else if (cursor < input.length) {
      if (cursor === 0) firstSlot = display.length;
      display += input[cursor];
      unmasked += input[cursor];
      cursor += 1;
      caretAfter[cursor] = display.length;
    } else if (full) {
      display += placeholder;
    } else {
      break;
    }
  }
  if (!full && cursor === 0) display = '';
  if (firstSlot >= 0) caretAfter[0] = firstSlot;
  else caretAfter[0] = full && display.includes(placeholder) ? display.indexOf(placeholder) : display.length;
  return { display, unmasked, caretAfter };
}

function applyPattern(value, pattern, options = {}) {
  if (typeof pattern !== 'string' || pattern === '') return String(value ?? '');
  const tokens = parsePattern(pattern);
  return renderPattern(extractInput(value, tokens, options).accepted, tokens, options).display;
}

// Number itself, the string from JSON options, or Number from another realm --
// a documentation example runs in a frame of its own.
function isNumberMask(options) {
  const { mask } = options;
  return mask === Number || mask === 'Number'
    || (typeof mask === 'function' && mask.name === 'Number' && mask(' 1 ') === 1);
}

function numberRadix(options) {
  return options.radix || ',';
}

function parseNumber(value, options = {}) {
  let candidate = String(value ?? '');
  if (options.thousandsSeparator) candidate = candidate.replaceAll(options.thousandsSeparator, '');
  candidate = candidate.replace(/\s+/gu, '');
  const radix = numberRadix(options);
  if (radix !== '.') candidate = candidate.replace(radix, '.');
  if (candidate === '' || candidate === '-' || candidate === '.') return null;
  const number = Number(candidate);
  return Number.isFinite(number) ? number : null;
}

function groupInteger(integer, separator) {
  if (!separator) return integer;
  return integer.replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
}

// A number while it is typed: digits, one radix (either mark typed becomes the
// radix), a leading minus when negatives are allowed, no more fraction digits
// than the scale -- grouped, but not clamped or padded, so `12,` and `-` stay
// on the way to a number. `typedBefore` counts what was kept before the caret
// -- digits, the radix, the minus -- so the caret goes back after the same.
function typingNumber(value, options = {}, caret = -1) {
  const radix = numberRadix(options);
  const marks = new Set([radix, ...(options.mapToRadix || ['.', ','])]);
  const scale = Math.max(0, Number(options.scale ?? 2) || 0);
  const signed = options.signed === true || (Number.isFinite(options.min) && options.min < 0);
  let negative = false;
  let integer = '';
  let fraction = '';
  let hasRadix = false;
  let typedBefore = 0;
  const source = String(value ?? '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const counted = index < caret;
    if (/\d/u.test(character)) {
      if (hasRadix) {
        if (fraction.length >= scale) continue;
        fraction += character;
      } else {
        integer += character;
      }
      if (counted) typedBefore += 1;
    } else if (character === '-' && signed && !negative && !integer && !hasRadix) {
      negative = true;
      if (counted) typedBefore += 1;
    } else if (marks.has(character) && character !== options.thousandsSeparator
      && scale > 0 && !hasRadix) {
      hasRadix = true;
      if (counted) typedBefore += 1;
    }
  }
  if (options.normalizeZeros !== false) integer = integer.replace(/^0+(?=\d)/u, '');
  if (hasRadix && !integer) integer = '0';
  const display = `${negative ? '-' : ''}${groupInteger(integer, options.thousandsSeparator)}`
    + (hasRadix ? `${radix}${fraction}` : '');
  return { display, typedBefore };
}

// The number committed: clamped to min and max, the scale applied and, when
// asked, the fraction padded. This is what typedValue, value and pipe write.
function formatNumber(value, options = {}) {
  if (value === '' || value === null || value === undefined) return '';
  const number = typeof value === 'number' ? value : parseNumber(typingNumber(value, options).display, options);
  if (number === null || !Number.isFinite(number)) return '';
  const minimum = Number.isFinite(options.min) ? options.min : number;
  const maximum = Number.isFinite(options.max) ? options.max : number;
  const normalized = Math.min(maximum, Math.max(minimum, number));
  const precision = Math.max(0, Number(options.scale ?? 2) || 0);
  const fixed = normalized.toFixed(precision);
  const [integer, fraction = ''] = (options.padFractionalZeros ? fixed : String(Number(fixed))).split('.');
  const sign = integer.startsWith('-') ? '-' : '';
  const grouped = groupInteger(integer.replace('-', ''), options.thousandsSeparator);
  return `${sign}${grouped}${fraction ? `${numberRadix(options)}${fraction}` : ''}`;
}

function format(value, options = {}) {
  if (isNumberMask(options)) return formatNumber(value, options);
  if (typeof options.mask === 'function') return String(options.mask(value));
  if (options.mask instanceof RegExp) {
    const candidate = String(value ?? '');
    return options.mask.test(candidate) ? candidate : candidate.slice(0, -1);
  }
  return applyPattern(value, options.mask, options);
}

function caretOf(element) {
  try {
    return typeof element.selectionStart === 'number' ? element.selectionStart : -1;
  } catch {
    return -1;
  }
}

function placeCaret(element, position) {
  if (position < 0 || typeof element.setSelectionRange !== 'function') return;
  if (element.ownerDocument?.activeElement !== element) return;
  try {
    element.setSelectionRange(position, position);
  } catch {
    /* Inputs of some types refuse a selection; the value is what matters. */
  }
}

function createNativeMask(element, options) {
  const state = { destroyed: false };
  const tokens = typeof options.mask === 'string' && !isNumberMask(options)
    ? parsePattern(options.mask)
    : null;

  const show = (next, caret) => {
    if (next !== element.value) element.value = next;
    placeCaret(element, caret);
  };

  const sync = () => {
    if (state.destroyed) return;
    const caret = caretOf(element);
    if (tokens) {
      const { accepted, before } = extractInput(element.value, tokens, options, caret);
      const rendered = renderPattern(accepted, tokens, options);
      show(rendered.display, caret < 0 ? -1 : rendered.caretAfter[before] ?? rendered.display.length);
    } else if (isNumberMask(options)) {
      const { display, typedBefore } = typingNumber(element.value, options, caret);
      let position = display.length;
      if (caret >= 0) {
        let seen = 0;
        position = 0;
        const radix = numberRadix(options);
        while (position < display.length && seen < typedBefore) {
          const character = display[position];
          if (/\d/u.test(character) || character === radix || character === '-') seen += 1;
          position += 1;
        }
      }
      show(display, caret < 0 ? -1 : position);
    } else {
      show(format(element.value, options), -1);
    }
  };

  // A number is committed when the field is left: clamped, scaled, padded.
  const commit = () => {
    if (state.destroyed || !isNumberMask(options)) return;
    const next = formatNumber(element.value, options);
    if (next !== element.value) element.value = next;
  };

  // With the template shown, a click lands anywhere in it -- usually past the
  // placeholders, where a typed character falls off the end of the pattern.
  // The caret goes to the first empty slot instead, as IMask puts it.
  // A click has placed the caret by the time it fires; a focus from the
  // keyboard or a pointer places it a moment later.
  const settleCaretNow = () => {
    if (state.destroyed || !tokens || options.lazy !== false) return;
    const caret = caretOf(element);
    const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : caret;
    if (caret < 0 || caret !== end) return;
    const { accepted } = extractInput(element.value, tokens, options);
    const rendered = renderPattern(accepted, tokens, options);
    const filled = rendered.caretAfter[accepted.length] ?? rendered.display.length;
    if (caret > filled) placeCaret(element, filled);
  };
  const settleCaret = () => {
    if (state.destroyed || !tokens || options.lazy !== false) return;
    setTimeout(settleCaretNow, 0);
  };

  element.addEventListener('input', sync);
  element.addEventListener('blur', commit);
  element.addEventListener('focus', settleCaret);
  element.addEventListener('click', settleCaretNow);
  if (isNumberMask(options)) {
    if (element.value !== '') element.value = formatNumber(element.value, options);
  } else {
    sync();
  }

  const unmasked = () => {
    if (tokens) {
      return renderPattern(extractInput(element.value, tokens, options).accepted, tokens, options).unmasked;
    }
    if (isNumberMask(options)) {
      const number = parseNumber(element.value, options);
      return number === null ? '' : String(number);
    }
    return digits(element.value);
  };

  return {
    get value() { return element.value; },
    set value(value) { element.value = format(value, options); },
    get unmaskedValue() { return unmasked(); },
    // Readable and writable, like the two next to it. A consumer that holds a
    // raw number and wants it shown through the mask -- the country code field
    // does exactly that with a value the page arrived with -- writes it here;
    // a getter alone turns that assignment into a throw under strict mode,
    // which modules are.
    set unmaskedValue(value) { element.value = format(tokens ? String(value ?? '') : digits(value), options); },
    get typedValue() {
      if (!isNumberMask(options) || element.value.trim() === '') return null;
      return parseNumber(element.value, options);
    },
    set typedValue(value) { element.value = format(value, options); },
    updateValue: sync,
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      element.removeEventListener('input', sync);
      element.removeEventListener('blur', commit);
      element.removeEventListener('focus', settleCaret);
      element.removeEventListener('click', settleCaretNow);
    },
  };
}

const Mask = {
  async load() {
    return createNativeMask;
  },

  async create(target, options) {
    const element = resolveElement(target);
    if (!element || !options) return null;
    return createNativeMask(element, options);
  },

  async pipe(value, masked) {
    return format(value, typeof masked === 'object' ? masked : { mask: masked });
  },

  destroy(instance) {
    instance?.destroy?.();
  },
};

getGlobalRoot().Mask = Mask;
// Fields whose scripts ran before Core wait for this (component/mask-service).
if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
  window.dispatchEvent(new CustomEvent('sf-mask-ready'));
}

export { applyPattern, createNativeMask, format };
export default Mask;
