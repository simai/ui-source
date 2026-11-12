import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import countryCodeUtility from '../json/country-code.utility.json';
import countriesData from '../data/countries.json';
import { bindFormReset } from '../../form-reset-helper';
import { maskService } from '../../mask-service';
import BundledPosition from '../../../core/js/position.js';
import { fieldSize, retireFieldSizeClass } from '../../field-size';
import { pageLanguage, pageText } from '../../../core/js/page-language';
import { holdOpenSurfaceMark } from '../../../core/js/open-surface-mark';
import { tagSelector } from '../../../core/js/tag-aliases.js';
// Every word this part says. A product adds a language with
// SF.language.register('sf-input-country', code, words); the locale here is
// also what the number itself is formatted by, which is why it stays.
const COUNTRY_CODE_TEXT = {
  en: {
    phoneLabel: 'Phone number',
    phoneRequired: 'Enter a phone number.',
    countryLabel: 'Country code',
    countryUnknown: 'Country code not recognised. Choose a country',
    searchPlaceholder: 'Country or code',
    frequent: 'Frequently chosen',
    allCountries: 'All countries',
  },
  ru: {
    phoneLabel: 'Телефон',
    phoneRequired: 'Введите номер телефона.',
    countryLabel: 'Код страны',
    countryUnknown: 'Код страны не узнан. Выбрать страну',
    searchPlaceholder: 'Страна или код',
    frequent: 'Часто выбирают',
    allCountries: 'Все страны',
  },
};


// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

const COUNTRY_CODE_SELECTOR = '.sf-country-code';
const COUNTRY_CODE_BOUND_FLAG = 'sfCountryCodeBound';
const COUNTRY_ITEMS = Array.isArray(countriesData?.items) ? countriesData.items : [];

let countryId = 0;
const countryGeneratedNames = new WeakMap();
const countryResetDefaults = new WeakMap();
const countryRequiredMessages = new WeakMap();
const countryFieldReferences = new WeakMap();
const countryMaskConfiguration = new WeakMap();

function syncCountryFieldReferences(root, input) {
  if (!input) return;
  const refs = countryFieldReferences.get(input) || {};
  const label = root.querySelector('.sf-country-code-text');
  const hint = root.querySelector('.sf-country-code-hint');
  const generatedName = countryGeneratedNames.get(input);
  const authorName = input.hasAttribute('aria-label') && input.getAttribute('aria-label') !== generatedName;
  for (const [attribute, candidate] of [['aria-labelledby', label], ['aria-describedby', hint]]) {
    const node = candidate?.textContent.trim() ? candidate : null;
    let tokens = (input.getAttribute(attribute) || '').split(/\s+/).filter(Boolean);
    // A clone retains generated markup, not WeakMap entries. Recognize only the
    // framework-owned id of its own local label/hint before repairing duplicates.
    const copiedId = candidate && /^sf-country-\d+$/.test(candidate.id) && tokens.includes(candidate.id) ? candidate.id : '';
    const previous = refs[attribute] || copiedId;
    tokens = tokens.filter(id => id !== previous);
    const attach = node && (attribute === 'aria-describedby' || (!authorName && tokens.length === 0));
    const next = attach ? ensureCountryId(node) : '';
    if (next) tokens.push(next);
    const value = [...new Set(tokens)].join(' ');
    if (value !== (input.getAttribute(attribute) || '')) {
      if (value) input.setAttribute(attribute, value); else input.removeAttribute(attribute);
    }
    refs[attribute] = next;
  }
  countryFieldReferences.set(input, refs);
  if (label?.textContent.trim() || input.hasAttribute('aria-labelledby')) {
    if (generatedName && input.getAttribute('aria-label') === generatedName) input.removeAttribute('aria-label');
  } else if (!authorName) {
    const name = pageText(COUNTRY_CODE_TEXT, 'phoneLabel', root, 'sf-input-country');
    if (input.getAttribute('aria-label') !== name) input.setAttribute('aria-label', name);
    countryGeneratedNames.set(input, name);
  }
}

function syncCountryRequired(root, input) {
  const previous = countryRequiredMessages.get(input);
  if (input.validity.customError && input.validationMessage !== previous) return;
  const config = root.__sfCountryConfig || {};
  const value = String(input.value || '').trim();
  const local = config.showCode ? extractLocalPart(value, root.dataset.dialCode) : value;
  const missing = input.required && value !== '' && !/\d/.test(local);
  const message = missing ? pageText(COUNTRY_CODE_TEXT, 'phoneRequired', root, 'sf-input-country') : '';
  input.setCustomValidity(message);
  countryRequiredMessages.set(input, message);
}

function ensureCountryId(node) {
  if (!node) return '';
  if (!node.id || (document.getElementById(node.id) && document.getElementById(node.id) !== node)) {
    do { node.id = `sf-country-${++countryId}`; } while (document.getElementById(node.id) && document.getElementById(node.id) !== node);
  }
  return node.id;
}

function setCountryName(node, value) {
  if (!node || node.hasAttribute('aria-labelledby')) return;
  const previous = countryGeneratedNames.get(node);
  if (!node.hasAttribute('aria-label') || node.getAttribute('aria-label') === previous) {
    node.setAttribute('aria-label', value);
    countryGeneratedNames.set(node, value);
  }
}

function syncCountryAccessibility(root) {
  const { input, toggle, list, items } = getNodes(root);
  const config = root.__sfCountryConfig || {};
  const open = root.classList.contains('open');
  const selected = root.__sfCountrySelected;
  const countryName = pageText(COUNTRY_CODE_TEXT, 'countryLabel', root, 'sf-input-country');
  syncCountryFieldReferences(root, input);
  root.querySelectorAll('.sf-country-code-required, .sf-country-code-left .sf-icon').forEach(node => node.setAttribute('aria-hidden', 'true'));
  if (toggle) {
    if (config.multiCountry && config.showCode && list) {
      // A code the text does not name (owner C87: the person erased or
      // retyped it) leaves the flag an empty frame; the button says so.
      const unknown = root.classList.contains('sf-country-code--unknown');
      setCountryName(toggle, unknown
        ? pageText(COUNTRY_CODE_TEXT, 'countryUnknown', root, 'sf-input-country')
        : `${countryName}${selected ? `: ${getCountryLabel(selected, config.locale)}` : ''}`);
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('aria-haspopup', 'listbox');
      toggle.setAttribute('aria-controls', ensureCountryId(list));
      toggle.setAttribute('aria-expanded', String(open));
    } else {
      // With one fixed country the flag and code are a picture, not a control.
      // A span without a role does not get a name: an aria-label or
      // aria-disabled left on it is not allowed there and is never read. The
      // dial code stays in the field's own value, which is what is read.
      toggle.removeAttribute('aria-haspopup');
      toggle.removeAttribute('aria-controls');
      toggle.removeAttribute('aria-expanded');
      toggle.removeAttribute('aria-disabled');
      toggle.removeAttribute('role');
      if (toggle.getAttribute('aria-label') === countryGeneratedNames.get(toggle)) {
        toggle.removeAttribute('aria-label');
        countryGeneratedNames.delete(toggle);
      }
      toggle.tabIndex = -1;
    }
  }
  if (list) {
    list.setAttribute('role', 'listbox');
    setCountryName(list, countryName);
    list.setAttribute('aria-hidden', String(!open));
    list.inert = !open;
  }
  let selectedFound = false;
  for (const item of items) {
    const matches = !selectedFound && !!selected && (selected.iso2
      ? normalizeIso2(item.dataset.iso2) === selected.iso2
      : item.dataset.code === selected.dialCode);
    selectedFound ||= matches;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(matches));
    item.tabIndex = open && item === document.activeElement ? 0 : -1;
  }
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'active', 'open', 'disabled'].includes(
    String(value).toLowerCase(),
  );
}

function normalizeIso2(value) {
  return String(value || '').trim().toUpperCase();
}

/* The field has always been able to draw flags from an SVG set -- the whole
   data-flag-base path below is built for it -- and the default base was an empty
   string, so nothing ever used it. What was drawn instead was country.flagEmoji
   through the system font: a waving flag on macOS, a flat one on Android, and on
   Windows no flag at all, because Segoe UI Emoji carries no country glyphs and a
   regional indicator pair renders as the letters.

   The Framework now ships the set, so the default points at it. A project with
   its own flags still overrides this with data-flag-base, and the emoji stays as
   the fallback for a runtime that cannot resolve its own root. */
function resolveDefaultFlagBase() {
  const root = typeof window !== 'undefined' ? window.sfPath : '';
  if (!root) return '';
  try {
    // sfPath may be written without its closing slash ('/ui/distr'); a URL
    // base without it drops the last segment, so the flags were asked for
    // beside distr rather than inside it.
    return new URL('component/flag/flags/rect', String(root).replace(/\/?$/u, '/')).href.replace(/\/$/, '');
  } catch {
    return String(root).replace(/\/$/, '') + '/component/flag/flags/rect';
  }
}

function getFlagSrc(iso2, flagBase) {
  const code = normalizeIso2(iso2).toLowerCase();
  if (!code || !flagBase) return '';
  return `${flagBase}/${code}.svg`;
}

function loadFlagImage(img) {
  if (!img || img.dataset.loaded === '1') return;
  const src = img.dataset.flagSrc || '';
  if (!src) return;
  img.src = src;
  img.dataset.loaded = '1';
}

// A flag of the list is the browser's own lazy image: its address is set when
// the row is built and `loading="lazy"` lets the browser fetch it when the row
// comes near the view, a closed list (display: none) fetching nothing. The
// field watched the rows with its own IntersectionObserver instead, and that
// never answered inside a sandboxed frame (an opaque origin): every flag of
// an open list stayed an empty image (docs pre-check 2026-11-10 CC-02).
// lazy-flags off (eager-flags) asks for every flag at once.
function observeFlagImage(img, lazy = true) {
  if (!img) return;
  img.loading = lazy ? 'lazy' : 'eager';
  loadFlagImage(img);
}

function createFlagNode(country, config, lazy = true) {
  const flag = document.createElement('div');
  flag.classList.add('sf-country-code-flag');
  flag.setAttribute('aria-hidden', 'true');

  const fallback = country?.flagEmoji || '';
  const src = getFlagSrc(country?.iso2, config.flagBase);

  if (!src) {
    flag.textContent = fallback;
    return flag;
  }

  const img = document.createElement('img');
  img.alt = country?.iso2 ? `${country.iso2} flag` : 'flag';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.dataset.flagSrc = src;
  img.dataset.flagFallback = fallback;
  img.addEventListener(
    'error',
    () => {
      flag.textContent = fallback;
    },
    { once: true },
  );

  observeFlagImage(img, lazy && config.lazyFlags);
  flag.append(img);
  return flag;
}

function getNodes(root) {
  const input = root?.querySelector?.('.sf-country-code-field input') || null;
  const toggle = root?.querySelector?.('.sf-country-code-left') || null;
  const list = root?.querySelector?.('.sf-country-code-list') || null;
  const itemsWrap = root?.querySelector?.('.sf-country-code-items') || null;
  const items = Array.from(root?.querySelectorAll?.('.sf-country-code-item') || []);
  const leftFlag =
    root?.querySelector?.('.sf-country-code-left .sf-country-code-flag-icon') ||
    root?.querySelector?.('.sf-country-code-left .sf-country-code-flag') ||
    null;
  return { input, toggle, list, itemsWrap, items, leftFlag };
}

function getCountryByIso2(iso2) {
  const code = normalizeIso2(iso2);
  if (!code) return null;
  return COUNTRY_ITEMS.find((item) => item.iso2 === code) || null;
}

function getCountryByDialCode(dialCode) {
  const code = String(dialCode || '').trim();
  if (!code) return null;
  return COUNTRY_ITEMS.find((item) => item.dialCode === code) || null;
}

function normalizeMaskPatternByStyle(pattern, style = 'native') {
  const value = String(pattern || '').trim();
  if (!value) return value;
  if (style !== 'brackets') return value;

  const normalized = value.replace(/[()]/g, '');
  const match = normalized.match(/^(\+\S+)\s+(.+)$/);
  if (!match) return normalized;

  const prefix = match[1];
  const tail = match[2].trim();
  if (!tail) return normalized;

  const firstSpaceIndex = tail.indexOf(' ');
  let firstToken =
    firstSpaceIndex >= 0 ? tail.slice(0, firstSpaceIndex) : tail;
  let rest =
    firstSpaceIndex >= 0 ? tail.slice(firstSpaceIndex + 1).trim() : '';

  let firstGroup = firstToken;
  if (firstToken.includes('-')) {
    const [firstChunk, ...nextChunks] = firstToken.split('-');
    firstGroup = firstChunk;
    const fromHyphen = nextChunks.join('-');
    rest = [fromHyphen, rest].filter(Boolean).join(' ');
  }

  if (!firstGroup) return normalized;
  return `${prefix} (${firstGroup})${rest ? ` ${rest}` : ''}`.trim();
}

function buildPlaceholderFromMask(maskPattern, placeholderChar, dialCode = '') {
  const pattern = String(maskPattern || '');
  if (!pattern) return '';

  const char = placeholderChar || '_';
  const dialDigits = String(dialCode || '').replace(/\D/g, '');
  let dialIndex = 0;

  return pattern.replace(/0/g, () => {
    if (dialIndex < dialDigits.length) {
      const next = dialDigits[dialIndex];
      dialIndex += 1;
      return next;
    }
    return char;
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLocalPart(fullValue, previousDialCode) {
  const value = String(fullValue || '').trim();
  if (!value) return '';

  if (previousDialCode) {
    const prev = escapeRegExp(previousDialCode.trim());
    const prevPattern = new RegExp(`^${prev}[\\s\\-()]*`, 'i');
    const stripped = value.replace(prevPattern, '').trim();
    if (stripped !== value) return stripped;
  }

  // Fallback: strip leading international prefix like +123 ... and keep user tail.
  // A bare «+» counts: the code the person erased (owner C87) leaves «+ 30…».
  return value.replace(/^\+\d*[\s\-()]*/, '').trim();
}

function closeAllCountryCodes(except = null) {
  document.querySelectorAll(COUNTRY_CODE_SELECTOR).forEach((node) => {
    if (except && node === except) return;
    setOpenState(node, false);
  });
}

function setOpenState(root, open) {
  if (!root) return;
  const { input } = getNodes(root);
  if (input?.disabled || root.classList.contains('disabled') || root.__sfCountryConfig?.multiCountry === false) open = false;
  if (open) root.classList.add('open');
  else root.classList.remove('open');
  // An open list of countries owns Escape: the root says so, and a drawer, a
  // modal or a record panel behind it stands back.
  holdOpenSurfaceMark(root, open);
  syncCountryAccessibility(root);
  // A closed list forgets its search; an open one is arranged before it is
  // placed, so the rows it is measured by are the rows it shows.
  if (!open && root.__sfCountryQuery) {
    root.__sfCountryQuery = '';
    const search = root.querySelector('.sf-country-code-search input');
    if (search) search.value = '';
  }
  arrangeCountryList(root);
  root.__sfCountryViewport?.(open);
  if (open) {
    // Every way a list opens -- a press, the keyboard, open at connect,
    // setState -- gives its rows their files. Only the press set them, so a
    // list drawn open kept empty images (DEV P1, owner R135).
    prefetchVisibleFlags(root);
    revealChosenCountry(root);
  }
}

function resolveConfig(root, input) {
  const locale = String(root.dataset.locale || input?.dataset.locale || pageLanguage(root)).toLowerCase();
  const rawMaskStyle = String(
    root.dataset.maskStyle ?? input?.dataset.maskStyle ?? 'native',
  ).toLowerCase();
  const maskStyle = rawMaskStyle === 'brackets' ? 'brackets' : 'native';
  return {
    locale: locale === 'ru' ? 'ru' : 'en',
    useMask: toBoolean(root.dataset.useMask ?? input?.dataset.useMask, false),
    useCountryMasks: toBoolean(
      root.dataset.useCountryMasks ?? input?.dataset.useCountryMasks,
      true,
    ),
    showCode: toBoolean(root.dataset.showCode ?? input?.dataset.showCode, true),
    maskStyle,
    multiCountry: toBoolean(root.dataset.multiCountry ?? input?.dataset.multiCountry, true),
    defaultIso2: normalizeIso2(root.dataset.iso2 ?? input?.dataset.iso2),
    fixedDialCode: String(root.dataset.dialCode ?? input?.dataset.dialCode ?? '').trim(),
    fixedMaskPattern: String(
      root.dataset.maskPattern ?? input?.dataset.maskPattern ?? '',
    ).trim(),
    flagBase: String(root.dataset.flagBase || input?.dataset.flagBase || '').trim() ||
      resolveDefaultFlagBase(),
    lazyFlags: toBoolean(root.dataset.lazyFlags ?? input?.dataset.lazyFlags, true),
    showMaskPlaceholder: toBoolean(
      root.dataset.showMaskPlaceholder ?? input?.dataset.showMaskPlaceholder,
      false,
    ),
    maskPlaceholderChar: String(
      root.dataset.maskPlaceholderChar ?? input?.dataset.maskPlaceholderChar ?? '_',
    ),
    maxItems: Number.parseInt(root.dataset.maxItems || input?.dataset.maxItems || '0', 10) || 0,
    // The countries on top of the list (owner C87): data-preferred="RU,KZ",
    // an empty one for none; without it the page language's own list.
    preferred: root.dataset.preferred === undefined ? undefined
      : String(root.dataset.preferred).split(/[\s,;]+/u).map(normalizeIso2).filter(Boolean),
  };
}

function getCountryLabel(country, locale) {
  if (!country) return '';
  if (country.label) return String(country.label);
  const name = (locale === 'en' ? country.nameEn || country.nameRu : country.nameRu || country.nameEn) || country.iso2;
  return name ? `${name} (${country.dialCode})` : String(country.dialCode || '');
}

function normalizeCountriesList(countries, locale = 'ru', maxItems = 0) {
  let items = Array.isArray(countries) && countries.length ? countries : COUNTRY_ITEMS;
  if (Number(maxItems) > 0) {
    items = items.slice(0, Number(maxItems));
  }

  return items.filter(country => country && typeof country === 'object').map(country => {
    const iso2 = normalizeIso2(country.iso2);
    const dialCode = String(country.dialCode || country.code || '').trim();
    const known = getCountryByIso2(iso2) || (!iso2 && getCountryByDialCode(dialCode)) || {};
    const item = {...known, ...country, iso2: iso2 || known.iso2 || '', dialCode: dialCode || known.dialCode || ''};
    item.label = getCountryLabel(item, locale);
    return item;
  });
}

function readCountryItem(item, locale) {
  const text = item.cloneNode(true);
  text.querySelectorAll('.sf-country-code-flag, [aria-hidden="true"]').forEach(node => node.remove());
  return normalizeCountriesList([{
    iso2: item.dataset.iso2,
    code: item.dataset.code,
    label: text.textContent.trim(),
    ...(item.hasAttribute('data-mask-pattern') ? {maskPattern: item.dataset.maskPattern} : {}),
  }], locale)[0];
}

function resolveCountry(root, iso2 = '', dialCode = '') {
  const countries = root.__sfCountryOptions || [];
  const iso = normalizeIso2(iso2), code = String(dialCode || '').trim();
  // Explicit known countries outside the visible list remain supported for
  // compatibility. Local descriptors take precedence over the shared dataset.
  return (iso && countries.find(country => country.iso2 === iso)) ||
    (code && countries.find(country => country.dialCode === code)) ||
    getCountryByIso2(iso) || getCountryByDialCode(code);
}

function ensureListMarkup(root, config) {
  const { list, itemsWrap } = getNodes(root);
  if (list && itemsWrap) return { list, itemsWrap };

  const newList = document.createElement('span');
  newList.classList.add('sf-country-code-list');
  const newItemsWrap = document.createElement('span');
  newItemsWrap.classList.add('sf-country-code-items', 'flex', 'flex-col');
  newList.append(newItemsWrap);

  const field = root.querySelector('.sf-country-code-field');
  if (field) {
    field.insertAdjacentElement('afterend', newList);
  } else {
    root.append(newList);
  }

  if (!config.multiCountry) {
    newList.classList.add('hidden');
  }
  return { list: newList, itemsWrap: newItemsWrap };
}

function renderDatasetItems(root, config) {
  if (!config.multiCountry) return;

  const { itemsWrap } = ensureListMarkup(root, config);
  if (!itemsWrap) return;
  if (itemsWrap.children.length > 0) return;

  const sliced = config.maxItems > 0 ? COUNTRY_ITEMS.slice(0, config.maxItems) : COUNTRY_ITEMS;
  const frag = document.createDocumentFragment();
  sliced.forEach((country) => {
    const item = document.createElement('span');
    item.classList.add('sf-country-code-item', 'flex', 'items-center', 'transition');
    item.dataset.iso2 = country.iso2;
    item.dataset.code = country.dialCode;
    if (country.maskPattern) item.dataset.maskPattern = country.maskPattern;

    const flag = createFlagNode(country, config, true);
    const text = document.createElement('span');
    text.textContent = getCountryLabel(country, config.locale);

    item.append(flag, text);
    frag.append(item);
  });
  itemsWrap.append(frag);
}

function prefetchVisibleFlags(root) {
  const { list } = getNodes(root);
  if (!list) return;
  const lazy = root.__sfCountryConfig?.lazyFlags !== false;
  list.querySelectorAll('img[data-flag-src]').forEach((img) => {
    // A file that does not come draws the emoji, as the field's own flag
    // does; a row image of the template or of authored markup had no
    // fallback and stayed a broken picture.
    if (!img.__sfFlagFallback) {
      img.__sfFlagFallback = true;
      img.addEventListener('error', () => {
        const fallback = img.dataset.flagFallback || '';
        const holder = img.parentElement;
        if (holder && fallback) holder.textContent = fallback;
      }, { once: true });
    }
    observeFlagImage(img, lazy);
  });
}

// Caps the scrolling rows at `visibleItems` real rows (default 8). The list is
// a flex column while open, so when SF.Position limits the list to the free
// viewport height the rows shrink and scroll instead of overflowing.
function applyDropdownViewport(root, visibleItems = 8) {
  const { list, itemsWrap } = getNodes(root);
  if (!list || !itemsWrap || visibleItems <= 0 || !root.classList.contains('open')) return 0;
  const items = Array.from(itemsWrap.querySelectorAll('.sf-country-code-item')).slice(0, visibleItems);
  const heights = items.map(item => item.offsetHeight);
  if (!heights.some(Boolean)) return 0;
  const wrapStyle = window.getComputedStyle(itemsWrap);
  const gap = Number.parseFloat(wrapStyle.rowGap || '') || Number.parseFloat(wrapStyle.gap || '') || 0;
  const total = heights.reduce((sum, height) => sum + height, 0) + (items.length - 1) * gap
    + (Number.parseFloat(wrapStyle.paddingTop || '') || 0) + (Number.parseFloat(wrapStyle.paddingBottom || '') || 0);
  Object.assign(itemsWrap.style, {maxHeight: `${total}px`, minHeight: '0', overflowY: 'auto', overflowX: 'hidden'});
  return total;
}

function bindCountryViewport(root) {
  const {list, itemsWrap} = getNodes(root);
  if (!list || !itemsWrap) return;
  let anchor = null;
  let saved = null;
  let lower = null;
  root.__sfCountryViewport = open => {
    if (open && !anchor && !lower && root.isConnected && countryListOnPhone()) {
      // On a phone the list is a sheet at the bottom of the screen, the
      // screen's width, its rows the sheet's height (owner C87, V4; the
      // sheet of C32). It is lifted into the top layer and not anchored.
      saved = ['display', 'flex-direction', 'overflow'].map(name => [name, list.style.getPropertyValue(name), list.style.getPropertyPriority(name)]);
      Object.assign(list.style, {display: 'flex', flexDirection: 'column', overflow: 'hidden'});
      list.setAttribute('data-sf-sheet', '');
      for (const name of ['maxHeight', 'minHeight']) itemsWrap.style[name] = '';
      lower = positioning().liftToTopLayer?.(list) || (() => {});
    } else if (open && !anchor && !lower && root.isConnected) {
      saved = ['display', 'flex-direction', 'overflow'].map(name => [name, list.style.getPropertyValue(name), list.style.getPropertyPriority(name)]);
      Object.assign(list.style, {display: 'flex', flexDirection: 'column', overflow: 'hidden'});
      applyDropdownViewport(root);
      // Shared Framework geometry: below the field, flipped above when the
      // rows do not fit and there is more room, shifted inside the viewport.
      // The height is the list's own: eight rows (the stylesheet and
      // applyDropdownViewport), never the room left in the viewport. A frame
      // that grows with its document is that room: a list that took it
      // followed the frame and the frame followed the list -- 9.8k px in a
      // documentation example, or squeezed to 16 px with no row in a frame
      // that counts only the list's box (DEV acceptance 2026-11-11, CC-01).
      // At least the field's width; the list with its search is the panel
      // step (C32: 20rem) where the field is narrower.
      anchor = positioning().anchor(root, list, {
        side: 'block-end', align: 'start', matchWidth: 'min', fitHeight: false,
        onPosition: () => {
          const box = root.getBoundingClientRect();
          if (box.bottom <= 0 || box.top >= window.innerHeight) setOpenState(root, false);
        },
      });
    } else if (!open && (anchor || lower)) {
      if (anchor) anchor.stop();
      anchor = null;
      lower?.();
      lower = null;
      list.removeAttribute('data-sf-sheet');
      for (const [name, value, priority] of saved) {
        if (value) list.style.setProperty(name, value, priority);
        else list.style.removeProperty(name);
      }
    } else if (open && anchor) {
      applyDropdownViewport(root);
      anchor.update();
    }
  };
}

// A phone, by the rule sf-menu-context uses for its sheet: the md breakpoint
// variable is empty below md.
function countryListOnPhone() {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return false;
  return !getComputedStyle(document.documentElement).getPropertyValue('--sf-breakpoint-md').trim();
}

/* Whether a property can be assigned, not merely whether it is there. The two
   differ: an accessor declared with a getter and no setter answers to
   hasOwnProperty and still throws when written, and an implementation may put
   the same property on a prototype instead of the instance, where
   hasOwnProperty does not see it at all. */
function writable(instance, name) {
  for (let node = instance; node; node = Object.getPrototypeOf(node)) {
    const descriptor = Object.getOwnPropertyDescriptor(node, name);
    if (descriptor) return typeof descriptor.set === 'function' || descriptor.writable === true;
  }
  return false;
}

async function applyMaskForRoot(root, input, maskPattern, config = null) {
  if (!input) return;
  // Requests can overlap across unbind/rebind or mask removal. A counter that
  // restarts on rebind lets an old request match a new one (the ABA problem).
  const token = Symbol('country-code-mask');
  root.__sfCountryMaskToken = token;
  if (root.__sfCountryMask) {
    window.SF?.Mask?.destroy?.(root.__sfCountryMask);
    delete root.__sfCountryMask;
  }
  if (!maskPattern) return;
  const service = await maskService();
  if (token !== root.__sfCountryMaskToken) return;

  const current = input.value;
  try {
    const resolvedConfig = config || root.__sfCountryConfig || resolveConfig(root, input);
    const hasInitialValue = String(current || '').trim() !== '';
    const showMaskTemplate = resolvedConfig.showMaskPlaceholder && hasInitialValue;
    if (!hasInitialValue && maskPattern) {
      const dialCode = root?.dataset?.dialCode || resolvedConfig.fixedDialCode || '';
      input.placeholder = buildPlaceholderFromMask(
        maskPattern,
        resolvedConfig.maskPlaceholderChar || '_',
        dialCode,
      );
    }
    const instance = await service.create(input, {
      mask: maskPattern,
      lazy: !showMaskTemplate,
      placeholderChar: resolvedConfig.maskPlaceholderChar || '_',
    });
    if (!instance || token !== root.__sfCountryMaskToken) {
      window.SF?.Mask?.destroy?.(instance);
      return;
    }
    root.__sfCountryMask = instance;
    if (current) {
      const digitsOnly = String(current).replace(/\D+/g, '');
      if (digitsOnly && writable(instance, 'unmaskedValue')) {
        instance.unmaskedValue = digitsOnly;
      } else if (writable(instance, 'value')) {
        instance.value = String(current);
      }
      if (typeof instance.updateValue === 'function') {
        instance.updateValue();
      }
      input.value = instance.value || input.value;
    }
    syncCountryRequired(root, input);
  } catch (error) {
    console.warn('SF.CountryCode mask init failed', error);
  }
}

function resolveInitialCountry(config, root, value = '') {
  return resolveCountry(root, config.defaultIso2) || resolveCountry(root, '', config.fixedDialCode) ||
    countryFromNumber(root, value) ||
    root.__sfCountryOptions?.[0] || COUNTRY_ITEMS[0] || null;
}

// Where several countries share a dial code, the one a number with that code
// means unless its next digits say otherwise (+7 6xx and +7 7xx are
// Kazakhstan).
const SHARED_DIAL_CODES = {
  '+1': 'US', '+7': 'RU', '+39': 'IT', '+44': 'GB', '+47': 'NO', '+61': 'AU',
  '+212': 'MA', '+262': 'RE', '+358': 'FI', '+590': 'GP', '+599': 'CW',
};

// The country a stored number names by its own dial code: the longest dial
// code its digits start with. A field that gets '+7 900 123-45-67' and no
// country used to take the first country of the list (Australia, +61) and
// read the number through its mask as '+79 0 0123 4567' (simai/ui-source#34).
function countryFromNumber(root, value) {
  const text = String(value || '').trim();
  if (!text.startsWith('+')) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const options = root.__sfCountryOptions?.length ? root.__sfCountryOptions : COUNTRY_ITEMS;
  for (let length = Math.min(4, digits.length); length > 0; length -= 1) {
    const code = `+${digits.slice(0, length)}`;
    const matches = options.filter((country) => country.dialCode === code);
    if (!matches.length) continue;
    if (matches.length === 1) return matches[0];
    if (code === '+7' && /^[67]/u.test(digits.slice(1))) {
      const kazakhstan = matches.find((country) => country.iso2 === 'KZ');
      if (kazakhstan) return kazakhstan;
    }
    return matches.find((country) => country.iso2 === SHARED_DIAL_CODES[code]) || matches[0];
  }
  return null;
}

// The number text names its country (owner C87, variant V4 of ui-control
// prototypes/phone-country-study.html#r3-variant): the code is the first group
// of the text and the flag follows it.
//   «+49 30 123456»     Germany, by the first group;
//   «+374 50…»          asks for +374, never for +3745;
//   «+7 7…», «+7 6…»    Kazakhstan; +7 otherwise Russia (countryFromNumber);
//   «8 9…»              Russia from any country: the trunk 8 becomes +7; a
//                       lone «8» waits for the next digit;
//   «903 …» (no «+»)    the current country's code goes in front;
//   «+ 30 123456»       the code was erased: no country, the number is kept.
// A code the person has finished gets a space after it, unless a longer code
// starts with it (+1 and +1242 Bahamas). Digits are never cut.
// Returns {text, country, wait}; country null is an unknown code.
function readTypedNumber(root, value, current = null, {deleting = false} = {}) {
  let text = String(value ?? '');
  const options = root?.__sfCountryOptions?.length ? root.__sfCountryOptions : COUNTRY_ITEMS;
  if (!text.trim()) return {text, country: current, wait: false};
  const digitsOf = (part) => String(part || '').replace(/\D/gu, '');
  let digits = digitsOf(text);
  if (!text.trim().startsWith('+')) {
    if (digits === '8') return {text, country: current, wait: true};
    const trunk = /^89/u.test(digits) || (current?.dialCode === '+7' && digits.length === 11 && digits[0] === '8');
    if (trunk) text = text.replace(/^(\s*)8/u, '$1+7');
    else if (current?.dialCode) text = `${current.dialCode} ${text.trimStart()}`;
    else text = `+${text.trimStart()}`;
    digits = digitsOf(text);
  }
  if (/^\s*\+(\s|$)/u.test(text) && digits) return {text, country: null, wait: false};
  const group = text.match(/^\s*\+(\d{1,4})[\s\-()]/u);
  let country = null;
  if (group) {
    const code = `+${group[1]}`;
    const matches = options.filter((item) => item.dialCode === code);
    if (current && current.dialCode === code && (digits.length === group[1].length || code !== '+7')) country = current;
    else if (code === '+7') country = countryFromNumber(root, text);
    else country = matches.find((item) => item.iso2 === SHARED_DIAL_CODES[code]) || matches[0] || null;
  } else {
    country = countryFromNumber(root, text);
    if (country && current && current.dialCode === country.dialCode && digits.length === digitsOf(country.dialCode).length) country = current;
  }
  if (!country || deleting) return {text, country, wait: false};
  const code = digitsOf(country.dialCode);
  if (digits.length === code.length) {
    const longer = options.some((item) => item.dialCode !== country.dialCode && digitsOf(item.dialCode).startsWith(code));
    if (!longer && !/\s$/u.test(text)) text = `${text.trimEnd()} `;
  } else if (digits.length > code.length) {
    // The space after the code: «+79031234567» reads «+7 9031234567».
    let seen = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (!/\d/u.test(text[index])) continue;
      seen += 1;
      if (seen === code.length) {
        if (/\d/u.test(text[index + 1] || '')) text = `${text.slice(0, index + 1)} ${text.slice(index + 1)}`;
        break;
      }
    }
  }
  return {text, country, wait: false};
}

// A code the text does not name: the flag is an empty frame, no row is the
// chosen one, the number stays as typed (owner C87).
function markCountryUnknown(root) {
  if (root.classList.contains('sf-country-code--unknown')) return;
  root.classList.add('sf-country-code--unknown');
  root.dataset.iso2 = '';
  root.dataset.dialCode = '';
  root.__sfCountrySelected = null;
  syncCountryAccessibility(root);
}

function syncDisabledState(root) {
  const { input, toggle } = getNodes(root);
  if (!input) return;
  const disabledByClass = root.classList.contains('disabled');
  const disabledByAttr = toBoolean(input.disabled, false);
  const disabled = disabledByClass || disabledByAttr;

  root.classList.toggle('disabled', disabled);
  if (toggle) {
    toggle.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    toggle.tabIndex = disabled ? -1 : 0;
  }
  if (disabled) setOpenState(root, false);
  syncCountryAccessibility(root);
}

// The code is locked in the text only where the person cannot choose another
// country (fixed-country) or a country mask writes the text (use-mask); in
// every other field the code is the start of the text the person edits
// (owner C87, readTypedNumber).
function getLockedPrefix(root, config) {
  if (!config?.showCode) return '';
  if (config.multiCountry && !config.useMask) return '';
  const dialCode = String(root?.dataset?.dialCode || '').trim();
  if (!dialCode) return '';
  return `${dialCode} `;
}

function enforceDialCodePrefix(root, input, config) {
  if (!input) return;
  const prefix = getLockedPrefix(root, config);
  if (!prefix) return;

  const current = String(input.value || '');
  if (current.startsWith(prefix)) return;

  const localPart = extractLocalPart(current, root?.dataset?.dialCode || '');
  input.value = `${prefix}${localPart}`.trimEnd();
}

function keepCaretAfterPrefix(input, prefix) {
  if (!input || !prefix) return;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start >= prefix.length && end >= prefix.length) return;
  const safePos = prefix.length;
  input.setSelectionRange(safePos, safePos);
}

function applyCountrySelection(root, country, source = 'runtime') {
  if (!root || !country) return;
  const { input, leftFlag } = getNodes(root);
  if (!input) return;
  const config = root.__sfCountryConfig || resolveConfig(root, input);
  const previousDialCode = root.dataset.dialCode || '';

  root.dataset.iso2 = country.iso2;
  root.dataset.dialCode = country.dialCode;
  root.dataset.maskPattern = country.maskPattern || '';
  root.classList.remove('sf-country-code--unknown');
  root.__sfCountryLast = country;
  const maskConfiguration = countryMaskConfiguration.get(root);
  if (maskConfiguration) maskConfiguration.selected = root.dataset.maskPattern;
  root.__sfCountrySelected = country;

  if (config.showCode && leftFlag) {
    const flagNode = createFlagNode(country, config, false);
    const img = flagNode.querySelector('img');
    leftFlag.textContent = '';
    if (img) {
      leftFlag.append(img);
    } else {
      leftFlag.textContent = flagNode.textContent || '';
    }
  }

  if (source === 'item' || source === 'state') {
    // The national digits stay when another country is chosen, also from an
    // erased or half-typed code («+ 30…», «+3 30…»).
    const localPart = extractLocalPart(input.value, previousDialCode);
    // The previous country's mask must not consume events for the new prefix.
    applyMaskForRoot(root, input, '', config);
    const prefix = country.dialCode ? `${country.dialCode} ` : '';
    input.value = `${prefix}${localPart}`.trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (config.useMask) {
    const basePattern = config.useCountryMasks
      ? country.maskPattern
      : config.fixedMaskPattern || country.maskPattern;
    const pattern = normalizeMaskPatternByStyle(basePattern, config.maskStyle);
    applyMaskForRoot(root, input, pattern, config);
  } else {
    applyMaskForRoot(root, input, '', config);
  }
  syncCountryAccessibility(root);
  syncCountryRequired(root, input);
}

// ─── The list: search, «Часто выбирают», the chosen row (owner C87) ─────────
// The rows stay where the template or the markup put them -- a Lit list must
// not be reordered under it -- and the list is a flex column, so the order a
// person sees is the rows' `order`: the frequent ones first under their
// heading, then «Все страны»; while searching only the matches, best first.
const RECENT_KEY = 'sf-input-country:recent';
const RECENT_MAX = 2;
const FREQUENT_MAX = 6;
// The product's own list for its audience when it names none (preferred):
// a Russian page asks for its neighbours first.
const PREFERRED_BY_LOCALE = {ru: ['RU', 'KZ', 'BY', 'UZ', 'KG', 'AM']};

function readRecentCountries() {
  try {
    const list = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.map(normalizeIso2).filter(Boolean).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberCountry(iso2) {
  const iso = normalizeIso2(iso2);
  if (!iso) return;
  try {
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify([iso, ...readRecentCountries().filter((code) => code !== iso)].slice(0, RECENT_MAX)));
  } catch { /* storage refused: a private window keeps no history */ }
}

// Up to two of the person's last choices, then the product's list, six rows
// at most; only countries the list has, each once.
function frequentCountries(config, items) {
  const present = new Set(items.map((item) => normalizeIso2(item.dataset.iso2)).filter(Boolean));
  const product = config.preferred ?? PREFERRED_BY_LOCALE[config.locale] ?? [];
  return [...new Set([...readRecentCountries(), ...product])].filter((iso) => present.has(iso)).slice(0, FREQUENT_MAX);
}

// How well a row answers a query: its ISO code or its whole dial code first,
// then a dial code it starts, a name it starts (Russian or English), a word
// of a name, any part of a name; null is no match.
function countryMatchRank(item, query) {
  const q = String(query || '').trim().toLocaleLowerCase();
  if (!q) return 0;
  const iso = normalizeIso2(item.dataset.iso2).toLowerCase();
  const code = String(item.dataset.code || '').replace(/\D/gu, '');
  const known = getCountryByIso2(iso) || {};
  const shown = (item.querySelector(':scope > span')?.textContent || item.textContent).trim()
    .replace(/\s*\(\+?[\d\s-]*\)\s*$/u, '').toLocaleLowerCase();
  const names = [shown, known.nameRu, known.nameEn].filter(Boolean).map((name) => String(name).toLocaleLowerCase());
  const digits = q.replace(/\D/gu, '');
  if (iso && q === iso) return 1;
  if (/^\+?[\d\s]+$/u.test(q) && digits) {
    if (code === digits) return 1;
    return code.startsWith(digits) ? 2 : null;
  }
  if (names.some((name) => name.startsWith(q))) return 3;
  if (names.some((name) => name.split(/[\s-]+/u).some((word) => word.startsWith(q)))) return 4;
  if (names.some((name) => name.includes(q))) return 5;
  return null;
}

function ensureCountryGroups(itemsWrap) {
  const heads = {};
  for (const kind of ['frequent', 'all']) {
    let head = itemsWrap.querySelector(`:scope > .sf-country-code-group[data-group="${kind}"]`);
    if (!head) {
      head = document.createElement('span');
      head.className = 'sf-country-code-group';
      head.dataset.group = kind;
      head.setAttribute('role', 'presentation');
      itemsWrap.append(head);
    }
    heads[kind] = head;
  }
  return heads;
}

function arrangeCountryList(root) {
  const { itemsWrap, items } = getNodes(root);
  const config = root?.__sfCountryConfig;
  if (!itemsWrap || !config?.multiCountry || !config.showCode) return;
  const query = root.__sfCountryQuery || '';
  const frequent = query ? [] : frequentCountries(config, items);
  const heads = ensureCountryGroups(itemsWrap);
  heads.frequent.textContent = pageText(COUNTRY_CODE_TEXT, 'frequent', root, 'sf-input-country');
  heads.all.textContent = pageText(COUNTRY_CODE_TEXT, 'allCountries', root, 'sf-input-country');
  heads.frequent.hidden = heads.all.hidden = !frequent.length;
  heads.frequent.style.order = '0';
  heads.all.style.order = String(FREQUENT_MAX + 1);
  for (const item of items) {
    const at = frequent.indexOf(normalizeIso2(item.dataset.iso2));
    const rank = query ? countryMatchRank(item, query) : 0;
    item.hidden = rank === null;
    if (at >= 0) item.dataset.group = 'frequent';
    else delete item.dataset.group;
    item.style.order = query ? String(rank ?? 0) : String(at >= 0 ? at + 1 : FREQUENT_MAX + 2);
  }
}

// The rows in the order a person sees them.
function visibleCountryItems(items) {
  return items.filter((item) => !item.hidden)
    .map((item, index) => [Number(item.style.order) || 0, index, item])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , item]) => item);
}

// The list opens on the chosen country, not at its top.
function revealChosenCountry(root) {
  const { itemsWrap, items } = getNodes(root);
  const chosen = items.find((item) => item.getAttribute('aria-selected') === 'true' && !item.hidden);
  if (!itemsWrap || !chosen) return;
  const box = itemsWrap.getBoundingClientRect(), row = chosen.getBoundingClientRect();
  if (row.top >= box.top && row.bottom <= box.bottom) return;
  itemsWrap.scrollTo({ top: itemsWrap.scrollTop + row.top - box.top - (itemsWrap.clientHeight - row.height) / 2, behavior: 'instant' });
}

// The search header of the list (C06, as sf-dropdown's): a span, not a label
// -- the root is the label of the phone input -- with the search glyph and
// the field.
function ensureCountrySearch(root, config) {
  const { list, itemsWrap } = getNodes(root);
  if (!list || !itemsWrap || !config.multiCountry || !config.showCode) return null;
  let head = list.querySelector(':scope > .sf-country-code-search');
  if (!head) {
    head = document.createElement('span');
    head.className = 'sf-country-code-search';
    const icon = document.createElement('i');
    icon.className = 'sf-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'search';
    const field = document.createElement('input');
    field.type = 'search';
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('enterkeyhint', 'search');
    head.append(icon, field);
    list.insertBefore(head, list.firstChild);
  }
  const field = head.querySelector('input');
  const word = pageText(COUNTRY_CODE_TEXT, 'searchPlaceholder', root, 'sf-input-country');
  field.placeholder = word;
  field.setAttribute('aria-label', word);
  field.setAttribute('aria-controls', ensureCountryId(itemsWrap));
  return field;
}

function bindCountryCode(root, { resetCountry = false, countries, maskPattern } = {}) {
  retireFieldSizeClass(root, 'sf-country-code');
  // Both ordinary and Smart bundles may contain this module. Keep reattachment
  // with the original owner of WeakMap defaults and authored configuration.
  if (root?.__sfCountryCodeBind && root.__sfCountryCodeBind !== bindCountryCode) {
    return root.__sfCountryCodeBind(root, {resetCountry, countries, maskPattern});
  }
  if (!root || typeof root.__sfCountryCodeInput === 'function') return;
  const { input, toggle, leftFlag } = getNodes(root);
  if (!input) return;
  root.__sfCountryCodeBind = bindCountryCode;
  root.__sfCountryCodeSetState = setCountryCodeState;

  const config = resolveConfig(root, input);
  const previousMask = countryMaskConfiguration.get(root);
  const fixedPattern = maskPattern !== undefined ? String(maskPattern).trim()
    : previousMask && config.fixedMaskPattern === previousMask.selected ? previousMask.fixed : config.fixedMaskPattern;
  config.fixedMaskPattern = fixedPattern;
  countryMaskConfiguration.set(root, {fixed: fixedPattern, selected: root.dataset.maskPattern});
  root.__sfCountryConfig = config;

  renderDatasetItems(root, config);
  applyDropdownViewport(root, 8);
  const nodes = getNodes(root);
  const items = nodes.items;
  bindCountryViewport(root);
  root.__sfCountryOptions = countries === undefined
    ? items.map(item => readCountryItem(item, config.locale))
    : normalizeCountriesList(countries, config.locale, config.maxItems);

  const search = ensureCountrySearch(root, config);

  if (!config.showCode && toggle) {
    toggle.classList.add('hidden');
  } else if (toggle) {
    toggle.classList.remove('hidden');
  }

  if (!config.multiCountry) {
    root.classList.add('sf-country-code--fixed-dial-code');
    root.classList.remove('open');
    nodes.list?.classList?.add('hidden');
    const toggleIcon = toggle?.querySelector?.('.sf-icon');
    if (toggleIcon) toggleIcon.remove();
  } else {
    root.classList.remove('sf-country-code--fixed-dial-code');
    nodes.list?.classList?.remove('hidden');
  }

  const initialCountry = resolveInitialCountry(config, root, input.value || input.getAttribute('value') || '');
  if (resetCountry || !countryResetDefaults.has(input)) countryResetDefaults.set(input, initialCountry);
  if (initialCountry) {
    applyCountrySelection(root, initialCountry, 'init');
  } else if (leftFlag) {
    leftFlag.textContent = '';
  }

  // Opened by the person, the cursor goes to the search (owner C87); a list
  // opened by markup or from code takes no focus.
  const focusSearch = () => search?.focus({ preventScroll: true });
  const onToggleClick = (event) => {
    event.preventDefault();
    if (!config.multiCountry || input.disabled || root.classList.contains('disabled')) return;
    const willOpen = !root.classList.contains('open');
    closeAllCountryCodes(root);
    setOpenState(root, willOpen);
    if (willOpen) {
      prefetchVisibleFlags(root);
      focusSearch();
    }
  };

  const onToggleKeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || input.disabled || root.classList.contains('disabled') || !config.multiCountry) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleClick(event);
      if (root.classList.contains('open') && !search) focusItem();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!root.classList.contains('open')) onToggleClick(event);
      if (search) focusSearch();
      else focusItem(event.key === 'ArrowUp' ? -1 : undefined);
    }
    // Escape over an open list closes the list and is consumed; it closed the
    // list and then, travelling on, the drawer the field sat in.
    if (event.key === 'Escape' && root.classList.contains('open')) {
      event.preventDefault();
      event.stopPropagation();
      setOpenState(root, false);
    }
  };

  const onDocumentClick = (event) => {
    if (!root.contains(event.target)) {
      setOpenState(root, false);
    }
  };

  const onItemClick = (event) => {
    event.preventDefault();
    if (input.disabled || root.classList.contains('disabled') || !config.multiCountry) return;
    const item = event.currentTarget;
    if (item.getAttribute('aria-disabled') === 'true' || item.classList.contains('disabled')) return;
    const selected = readCountryItem(item, config.locale);
    if (!selected) return;
    applyCountrySelection(root, selected, 'item');
    rememberCountry(selected.iso2);
    setOpenState(root, false);
    // Preserve pointer workflow: after choosing a code, continue typing the phone.
    // Keyboard confirmation returns to the selector instead.
    (event.type === 'keydown' ? toggle : input)?.focus({ preventScroll: true });
  };

  const enabledItems = () => visibleCountryItems(items).filter(item => item.getAttribute('aria-disabled') !== 'true' && !item.classList.contains('disabled'));
  const focusItem = (index) => {
    const choices = enabledItems();
    const selectedIndex = choices.findIndex(item => item.getAttribute('aria-selected') === 'true');
    const next = index === undefined ? Math.max(0, selectedIndex) : index < 0 ? choices.length - 1 : Math.min(index, choices.length - 1);
    items.forEach(item => { item.tabIndex = -1; });
    const item = choices[next];
    if (!item) return;
    item.tabIndex = 0;
    item.focus({ preventScroll: true });
    // Scroll only the options viewport; focusing must not move the whole page.
    const wrap = nodes.itemsWrap;
    if (wrap) {
      const box = wrap.getBoundingClientRect(), option = item.getBoundingClientRect();
      if (option.top < box.top) wrap.scrollTo({ top: wrap.scrollTop - (box.top - option.top), behavior: 'instant' });
      else if (option.bottom > box.bottom) wrap.scrollTo({ top: wrap.scrollTop + (option.bottom - box.bottom), behavior: 'instant' });
    }
  };
  let typed = '', typedTime = 0;
  const onItemKeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || input.disabled || root.classList.contains('disabled')) return;
    const choices = enabledItems(), current = choices.indexOf(event.currentTarget);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpenState(root, false); toggle?.focus({ preventScroll: true }); return;
    }
    if (event.key === 'Enter' || event.key === ' ') { onItemClick(event); return; }
    if (event.key === 'ArrowUp' && current === 0 && search) {
      event.preventDefault(); focusSearch(); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1));
      focusItem(index); return;
    }
    if (event.key.length === 1) {
      const now = performance.now();
      typed = now - typedTime > 700 ? event.key : typed + event.key;
      typedTime = now;
      const query = [...typed].every(char => char === typed[0]) ? typed[0] : typed;
      const ordered = [...choices.slice(current + 1), ...choices.slice(0, current + 1)];
      const found = ordered.find(item => (item.querySelector('span')?.textContent || item.textContent).trim().toLocaleLowerCase().startsWith(query.toLocaleLowerCase()));
      if (found) { event.preventDefault(); focusItem(choices.indexOf(found)); }
    }
  };
  const onFocusOut = (event) => {
    if (!root.contains(event.relatedTarget)) setOpenState(root, false);
  };

  const onInput = (event) => {
    if (getLockedPrefix(root, config) || !config.showCode || !config.multiCountry) {
      enforceDialCodePrefix(root, input, config);
      keepCaretAfterPrefix(input, getLockedPrefix(root, config));
      syncCountryRequired(root, input);
      return;
    }
    // The text decides the country (owner C87, readTypedNumber).
    const deleting = /^delete/u.test(event?.inputType || '');
    const before = input.value;
    const read = readTypedNumber(root, before, root.__sfCountryLast || root.__sfCountrySelected || null, {deleting});
    if (read.text !== before) {
      const caret = input.selectionStart ?? before.length;
      const atEnd = caret >= before.length;
      input.value = read.text;
      const at = atEnd ? read.text.length : Math.max(0, caret + read.text.length - before.length);
      if (document.activeElement === input) input.setSelectionRange(at, at);
    }
    if (!read.wait && before.trim()) {
      if (read.country) {
        if (read.country !== root.__sfCountrySelected) applyCountrySelection(root, read.country, 'text');
        else root.classList.remove('sf-country-code--unknown');
      } else {
        markCountryUnknown(root);
      }
    }
    syncCountryRequired(root, input);
  };

  const onPaste = (event) => {
    if (!getLockedPrefix(root, config) && config.showCode && config.multiCountry) {
      // A whole number pasted -- «+49 30 123456», «8 903 123-45-67» -- takes
      // the field's place; digits alone go where the caret is. The input
      // event that follows reads it.
      const text = event.clipboardData?.getData('text') ?? '';
      if (!text.trim()) return;
      const whole = /^\s*\+/u.test(text) || text.replace(/\D/gu, '').length >= 10;
      if (whole) {
        event.preventDefault();
        input.value = text.trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    requestAnimationFrame(() => {
      enforceDialCodePrefix(root, input, config);
      keepCaretAfterPrefix(input, getLockedPrefix(root, config));
    });
  };

  const onKeydownInput = (event) => {
    const prefix = getLockedPrefix(root, config);
    if (!prefix) return;
    if (!['Backspace', 'Delete'].includes(event.key)) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;

    if (event.key === 'Backspace' && start <= prefix.length) {
      event.preventDefault();
      keepCaretAfterPrefix(input, prefix);
      return;
    }

    if (event.key === 'Delete' && start < prefix.length) {
      event.preventDefault();
      keepCaretAfterPrefix(input, prefix);
      return;
    }

    if (start < prefix.length || end < prefix.length) {
      event.preventDefault();
      keepCaretAfterPrefix(input, prefix);
    }
  };

  if (toggle) {
    toggle.addEventListener('click', onToggleClick);
    toggle.addEventListener('keydown', onToggleKeydown);
    toggle.setAttribute('role', 'button');
  }

  const onSearchInput = () => {
    root.__sfCountryQuery = search.value;
    arrangeCountryList(root);
    nodes.itemsWrap?.scrollTo({ top: 0, behavior: 'instant' });
  };
  const onSearchKeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); focusItem(0); return; }
    if (event.key === 'Enter') {
      // Enter takes the best match, and never submits the form.
      event.preventDefault();
      const first = enabledItems()[0];
      if (root.__sfCountryQuery && first) onItemClick({type: 'keydown', currentTarget: first, preventDefault() {}});
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpenState(root, false); toggle?.focus({ preventScroll: true });
    }
  };
  // The root is the phone input's label: a press on the search glyph would
  // move the cursor to the number.
  const onSearchHeadClick = (event) => {
    if (event.target !== search) { event.preventDefault(); focusSearch(); }
  };
  if (search) {
    search.addEventListener('input', onSearchInput);
    search.addEventListener('keydown', onSearchKeydown);
    search.parentElement?.addEventListener('click', onSearchHeadClick);
    root.__sfCountrySearchListeners = () => {
      search.removeEventListener('input', onSearchInput);
      search.removeEventListener('keydown', onSearchKeydown);
      search.parentElement?.removeEventListener('click', onSearchHeadClick);
    };
  }

  input.addEventListener('input', onInput);
  input.addEventListener('paste', onPaste);
  input.addEventListener('keydown', onKeydownInput);

  items.forEach((item) => { item.addEventListener('click', onItemClick); item.addEventListener('keydown', onItemKeydown); });
  root.addEventListener('focusout', onFocusOut);
  document.addEventListener('click', onDocumentClick);

  root.__sfCountryCodeToggleClick = onToggleClick;
  root.__sfCountryCodeToggleKeydown = onToggleKeydown;
  root.__sfCountryCodeDocClick = onDocumentClick;
  root.__sfCountryCodeItemClick = onItemClick;
  root.__sfCountryCodeItemKeydown = onItemKeydown;
  root.__sfCountryCodeFocusOut = onFocusOut;
  root.__sfCountryCodeInput = onInput;
  root.__sfCountryCodePaste = onPaste;
  root.__sfCountryCodeInputKeydown = onKeydownInput;
  root.__sfCountryReleaseReset = bindFormReset(input, () => {
    const country = countryResetDefaults.get(input);
    if (country) applyCountrySelection(root, country, 'reset');
    setOpenState(root, false);
    syncCountryRequired(root, input);
  });
  root.__sfCountryRequiredObserver = new MutationObserver(() => {
    syncCountryRequired(root, input);
    syncCountryFieldReferences(root, input);
  });
  root.__sfCountryRequiredObserver.observe(root, { attributes: true, attributeFilter: ['required', 'aria-label', 'aria-labelledby', 'aria-describedby', 'id'], childList: true, characterData: true, subtree: true });
  root.dataset[COUNTRY_CODE_BOUND_FLAG] = '1';
  syncDisabledState(root);
  // Drawn open (the class open, the element's open): the same open path as a
  // press, without the focus.
  if (root.classList.contains('open')) setOpenState(root, true);
  else root.__sfCountryViewport?.(false);
}

function unbindCountryCode(root) {
  if (!root || typeof root.__sfCountryCodeInput !== 'function') return;
  const { input, toggle, items } = getNodes(root);
  root.__sfCountryReleaseReset?.();
  delete root.__sfCountryReleaseReset;
  root.__sfCountryRequiredObserver?.disconnect();
  delete root.__sfCountryRequiredObserver;
  root.__sfCountryViewport?.(false);
  delete root.__sfCountryViewport;
  // Removed while open, it must not leave the mark raised for the whole page.
  holdOpenSurfaceMark(root, false);

  if (toggle && root.__sfCountryCodeToggleClick) {
    toggle.removeEventListener('click', root.__sfCountryCodeToggleClick);
  }
  if (toggle && root.__sfCountryCodeToggleKeydown) {
    toggle.removeEventListener('keydown', root.__sfCountryCodeToggleKeydown);
  }
  if (root.__sfCountryCodeDocClick) {
    document.removeEventListener('click', root.__sfCountryCodeDocClick);
  }
  items.forEach((item) => {
    if (root.__sfCountryCodeItemKeydown) item.removeEventListener('keydown', root.__sfCountryCodeItemKeydown);
    if (root.__sfCountryCodeItemClick) {
      item.removeEventListener('click', root.__sfCountryCodeItemClick);
    }
  });
  if (root.__sfCountryCodeFocusOut) root.removeEventListener('focusout', root.__sfCountryCodeFocusOut);
  if (input && root.__sfCountryCodeInput) {
    input.removeEventListener('input', root.__sfCountryCodeInput);
  }
  if (input && root.__sfCountryCodePaste) {
    input.removeEventListener('paste', root.__sfCountryCodePaste);
  }
  if (input && root.__sfCountryCodeInputKeydown) {
    input.removeEventListener('keydown', root.__sfCountryCodeInputKeydown);
  }
  if (root.__sfCountryMask) {
    window.SF?.Mask?.destroy?.(root.__sfCountryMask);
  }
  root.__sfCountrySearchListeners?.();

  delete root.__sfCountrySearchListeners;
  delete root.__sfCountryQuery;
  delete root.__sfCountryLast;
  delete root.__sfCountryCodeToggleClick;
  delete root.__sfCountryCodeToggleKeydown;
  delete root.__sfCountryCodeDocClick;
  delete root.__sfCountryCodeItemClick;
  delete root.__sfCountryCodeItemKeydown;
  delete root.__sfCountryCodeFocusOut;
  delete root.__sfCountryCodeInput;
  delete root.__sfCountryCodePaste;
  delete root.__sfCountryCodeInputKeydown;
  delete root.__sfCountryMask;
  delete root.__sfCountryMaskToken;
  delete root.__sfCountrySelected;
  delete root.__sfCountryConfig;
  delete root.__sfCountryOptions;
  delete root.dataset[COUNTRY_CODE_BOUND_FLAG];
}

function initExistingCountryCodes(target = document) {
  target.querySelectorAll(COUNTRY_CODE_SELECTOR).forEach(root => {
    // The Smart owner binds its own root after render. Ordinary auto-init must
    // not claim it first with a different bundled module's reset state.
    if (!root.closest(tagSelector('sf-input-country'))) bindCountryCode(root);
  });
}

function setCountryCodeState(target, state = {}) {
  const root =
    target instanceof HTMLElement
      ? target.closest(COUNTRY_CODE_SELECTOR) || target
      : null;
  if (!root) return false;
  if (root.__sfCountryCodeSetState && root.__sfCountryCodeSetState !== setCountryCodeState) {
    return root.__sfCountryCodeSetState(root, state);
  }
  const { input } = getNodes(root);
  if (!input) return false;

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    const disabled = toBoolean(state.disabled, false);
    input.disabled = disabled;
    root.classList.toggle('disabled', disabled);
    syncDisabledState(root);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'active')) {
    setOpenState(root, toBoolean(state.active, false));
  }
  if (Object.prototype.hasOwnProperty.call(state, 'open')) {
    setOpenState(root, toBoolean(state.open, false));
  }
  if (Object.prototype.hasOwnProperty.call(state, 'value')) {
    input.value = String(state.value ?? '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (Object.prototype.hasOwnProperty.call(state, 'iso2')) {
    const country = resolveCountry(root, state.iso2);
    if (country) applyCountrySelection(root, country, 'state');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'dialCode')) {
    const country = resolveCountry(root, '', state.dialCode);
    if (country) applyCountrySelection(root, country, 'state');
  }
  return true;
}

class CountryCode extends ComponentObserver {
  static componentName = 'CountryCode';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1',
      label = '',
      required = false,
      name = '',
      form = '',
      hint = '',
      value = '',
      placeholder = '+7(___)___-__-__',
      disabled = false,
      active = false,
      open = active,
      countries = [],
      locale = 'ru',
      useMask = false,
      useCountryMasks = true,
      showCode = true,
      maskStyle = 'native',
      multiCountry = true,
      iso2 = '',
      dialCode = '',
      maskPattern = '',
      flagBase = '',
      lazyFlags = true,
      showMaskPlaceholder = false,
      maskPlaceholderChar = '_',
      maxItems = 0,
      preferred,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    this.template = document.createElement('label');
    if (this.id) this.template.id = this.id;
    this.template.classList.add('sf-country-code', `sf-country-code--size-${fieldSize(size, 'sf-country-code')}`);
    if (toBoolean(disabled)) this.template.classList.add('disabled');
    if (toBoolean(open)) this.template.classList.add('open');
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    this.template.dataset.locale = String(locale);
    this.template.dataset.useMask = String(toBoolean(useMask, false));
    this.template.dataset.useCountryMasks = String(toBoolean(useCountryMasks, true));
    this.template.dataset.showCode = String(toBoolean(showCode, true));
    this.template.dataset.maskStyle =
      String(maskStyle).toLowerCase() === 'brackets' ? 'brackets' : 'native';
    this.template.dataset.multiCountry = String(toBoolean(multiCountry, true));
    this.template.dataset.lazyFlags = String(toBoolean(lazyFlags, true));
    this.template.dataset.showMaskPlaceholder = String(
      toBoolean(showMaskPlaceholder, false),
    );
    this.template.dataset.maskPlaceholderChar = String(maskPlaceholderChar || '_');
    if (iso2) this.template.dataset.iso2 = normalizeIso2(iso2);
    if (dialCode) this.template.dataset.dialCode = String(dialCode);
    if (maskPattern) this.template.dataset.maskPattern = String(maskPattern);
    if (flagBase) this.template.dataset.flagBase = String(flagBase).replace(/\/$/, '');
    if (Number(maxItems) > 0) this.template.dataset.maxItems = String(Number(maxItems));
    if (preferred !== undefined) this.template.dataset.preferred = Array.isArray(preferred) ? preferred.join(',') : String(preferred);

    const labelWrap = document.createElement('span');
    labelWrap.classList.add('sf-country-code-label');

    const labelText = document.createElement('span');
    labelText.classList.add('sf-country-code-text');
    labelText.textContent = String(label);
    labelWrap.append(labelText);

    if (toBoolean(required, false)) {
      const requiredMark = document.createElement('span');
      requiredMark.classList.add('sf-country-code-required');
      requiredMark.textContent = '*';
      labelWrap.append(requiredMark);
    }

    const field = document.createElement('span');
    field.classList.add('sf-country-code-field');

    const left = document.createElement('span');
    left.classList.add('sf-country-code-left');

    const flag = document.createElement('div');
    flag.classList.add('sf-country-code-flag-icon');
    flag.setAttribute('aria-hidden', 'true');

    const icon = document.createElement('i');
    icon.classList.add('sf-icon', 'sf-country-code-caret');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'arrow_drop_down';
    left.append(flag, icon);

    const input = document.createElement('input');
    input.type = 'tel';
    input.name = String(name);
    if (form) input.setAttribute('form', String(form));
    input.required = toBoolean(required, false);
    input.defaultValue = String(value ?? '');
    input.placeholder = String(placeholder ?? '');
    input.disabled = toBoolean(disabled, false);
    field.append(left, input);
    this.template.append(labelWrap, field);

    const sourceCountries = normalizeCountriesList(countries, locale, maxItems);

    if (sourceCountries.length) {
      const list = document.createElement('span');
      list.classList.add('sf-country-code-list');
      const itemsWrap = document.createElement('span');
      itemsWrap.classList.add('sf-country-code-items', 'flex', 'flex-col');
      sourceCountries.forEach((country) => {
        const item = document.createElement('span');
        item.classList.add('sf-country-code-item');
        if (country?.iso2) item.dataset.iso2 = normalizeIso2(country.iso2);
        if (country?.dialCode || country?.code) {
          item.dataset.code = String(country.dialCode || country.code);
        }
        if (country?.maskPattern !== undefined) item.dataset.maskPattern = String(country.maskPattern || '');

        const itemFlag = createFlagNode(
          { iso2: country?.iso2, flagEmoji: country?.flagEmoji || '' },
          {
            flagBase: this.template.dataset.flagBase || resolveDefaultFlagBase(),
            lazyFlags: toBoolean(this.template.dataset.lazyFlags, true),
          },
          true,
        );

        const text = document.createElement('span');
        if (country?.label) {
          text.textContent = String(country.label);
        } else {
          const fallbackLabel = country?.nameRu || country?.nameEn || country?.dialCode || '';
          const fallbackDial = country?.dialCode || country?.code || '';
          text.textContent = fallbackDial ? `${fallbackLabel} (${fallbackDial})` : fallbackLabel;
        }
        item.append(itemFlag, text);
        this.applyLayoutUtilities(item, '.sf-country-code .sf-country-code-item');
        this.applyLayoutUtilities(itemFlag, '.sf-country-code .sf-country-code-flag');
        itemsWrap.append(item);
      });
      list.append(itemsWrap);
      this.template.append(list);
    }

    if (hint) {
      const hintWrap = document.createElement('span');
      hintWrap.classList.add('sf-country-code-hint');
      hintWrap.textContent = String(hint);
      this.template.append(hintWrap);
    }

    this.applyLayoutUtilities(this.template, '.sf-country-code');
    this.applyLayoutUtilities(labelWrap, '.sf-country-code .sf-country-code-label');
    this.applyLayoutUtilities(field, '.sf-country-code .sf-country-code-field');
    this.applyLayoutUtilities(left, '.sf-country-code .sf-country-code-left');
    this.applyLayoutUtilities(input, '.sf-country-code .sf-country-code-field input');
    this.applyLayoutUtilities(flag, '.sf-country-code .sf-country-code-flag-icon');
  }

  init() {
    bindCountryCode(this.template, {maskPattern: this.params?.maskPattern || ''});
  }

  destroyInternal() {
    unbindCountryCode(this.template);
  }
}

CountryCode.utilityMap = countryCodeUtility;
registerComponent('CountryCode', CountryCode);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.CountryCode = window.SF.CountryCode || {};
  window.SF.CountryCode.setState = setCountryCodeState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingCountryCodes());
} else {
  initExistingCountryCodes();
}

const countryCodeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      const roots = [...node.querySelectorAll(COUNTRY_CODE_SELECTOR)];
      if (node.matches(COUNTRY_CODE_SELECTOR)) roots.unshift(node);
      for (const root of roots) if (!root.isConnected && !root.closest(tagSelector('sf-input-country'))) unbindCountryCode(root);
    });
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(COUNTRY_CODE_SELECTOR) && !node.closest(tagSelector('sf-input-country'))) {
        bindCountryCode(node);
      }
      initExistingCountryCodes(node);
    });
  });
});

countryCodeObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindCountryCode,
  normalizeCountriesList,
  normalizeIso2,
  resolveDefaultFlagBase,
  setCountryCodeState,
  toBoolean,
  unbindCountryCode,
};
