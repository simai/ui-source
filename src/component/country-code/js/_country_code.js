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
// Every word this part says. A product adds a language with
// SF.language.register('sf-country-code', code, words); the locale here is
// also what the number itself is formatted by, which is why it stays.
const COUNTRY_CODE_TEXT = {
  en: {
    phoneLabel: 'Phone number',
    phoneRequired: 'Enter a phone number.',
    countryLabel: 'Country code',
  },
  ru: {
    phoneLabel: 'Телефон',
    phoneRequired: 'Введите номер телефона.',
    countryLabel: 'Код страны',
  },
};


// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

const COUNTRY_CODE_SELECTOR = '.sf-country-code';
const COUNTRY_CODE_BOUND_FLAG = 'sfCountryCodeBound';
const COUNTRY_ITEMS = Array.isArray(countriesData?.items) ? countriesData.items : [];

let flagObserver = null;
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
    const name = pageText(COUNTRY_CODE_TEXT, 'phoneLabel', root, 'sf-country-code');
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
  const message = missing ? pageText(COUNTRY_CODE_TEXT, 'phoneRequired', root, 'sf-country-code') : '';
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
  const countryName = pageText(COUNTRY_CODE_TEXT, 'countryLabel', root, 'sf-country-code');
  syncCountryFieldReferences(root, input);
  root.querySelectorAll('.sf-country-code-required, .sf-country-code-left .sf-icon').forEach(node => node.setAttribute('aria-hidden', 'true'));
  if (toggle) {
    if (config.multiCountry && config.showCode && list) {
      setCountryName(toggle, `${countryName}${selected ? `: ${getCountryLabel(selected, config.locale)}` : ''}`);
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
    return new URL('component/flag/flags/rect', root).href.replace(/\/$/, '');
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

function getFlagObserver() {
  if (flagObserver || !('IntersectionObserver' in window)) return flagObserver;
  flagObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        loadFlagImage(img);
        flagObserver?.unobserve?.(img);
      });
    },
    { rootMargin: '120px' },
  );
  return flagObserver;
}

function observeFlagImage(img, lazy = true) {
  if (!img) return;
  if (!lazy) {
    loadFlagImage(img);
    return;
  }
  const observer = getFlagObserver();
  if (!observer) {
    loadFlagImage(img);
    return;
  }
  observer.observe(img);
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
  return value.replace(/^\+\d+[\s\-()]*/, '').trim();
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
  root.__sfCountryViewport?.(open);
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
  list.querySelectorAll('img[data-flag-src]').forEach((img) => observeFlagImage(img, true));
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
  root.__sfCountryViewport = open => {
    if (open && !anchor && root.isConnected) {
      saved = ['display', 'flex-direction', 'overflow'].map(name => [name, list.style.getPropertyValue(name), list.style.getPropertyPriority(name)]);
      Object.assign(list.style, {display: 'flex', flexDirection: 'column', overflow: 'hidden'});
      applyDropdownViewport(root);
      // Shared Framework geometry: below the field, flipped above when the
      // rows do not fit and there is more room, shifted inside the viewport.
      anchor = positioning().anchor(root, list, {
        side: 'block-end', align: 'start', matchWidth: true, fitHeight: true,
        onPosition: () => {
          const box = root.getBoundingClientRect();
          if (box.bottom <= 0 || box.top >= window.innerHeight) setOpenState(root, false);
        },
      });
    } else if (!open && anchor) {
      anchor.stop();
      anchor = null;
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

function resolveInitialCountry(config, root) {
  return resolveCountry(root, config.defaultIso2) || resolveCountry(root, '', config.fixedDialCode) ||
    root.__sfCountryOptions?.[0] || COUNTRY_ITEMS[0] || null;
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

function getLockedPrefix(root, config) {
  if (!config?.showCode) return '';
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

  const initialCountry = resolveInitialCountry(config, root);
  if (resetCountry || !countryResetDefaults.has(input)) countryResetDefaults.set(input, initialCountry);
  if (initialCountry) {
    applyCountrySelection(root, initialCountry, 'init');
  } else if (leftFlag) {
    leftFlag.textContent = '';
  }

  const onToggleClick = (event) => {
    event.preventDefault();
    if (!config.multiCountry || input.disabled || root.classList.contains('disabled')) return;
    const willOpen = !root.classList.contains('open');
    closeAllCountryCodes(root);
    setOpenState(root, willOpen);
    if (willOpen) {
      prefetchVisibleFlags(root);
    }
  };

  const onToggleKeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || input.disabled || root.classList.contains('disabled') || !config.multiCountry) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleClick(event);
      if (root.classList.contains('open')) focusItem();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!root.classList.contains('open')) onToggleClick(event);
      focusItem(event.key === 'ArrowUp' ? -1 : undefined);
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
    setOpenState(root, false);
    // Preserve pointer workflow: after choosing a code, continue typing the phone.
    // Keyboard confirmation returns to the selector instead.
    (event.type === 'keydown' ? toggle : input)?.focus({ preventScroll: true });
  };

  const enabledItems = () => items.filter(item => item.getAttribute('aria-disabled') !== 'true' && !item.classList.contains('disabled') && !item.hidden);
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
  let search = '', searchTime = 0;
  const onItemKeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || input.disabled || root.classList.contains('disabled')) return;
    const choices = enabledItems(), current = choices.indexOf(event.currentTarget);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpenState(root, false); toggle?.focus({ preventScroll: true }); return;
    }
    if (event.key === 'Enter' || event.key === ' ') { onItemClick(event); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1));
      focusItem(index); return;
    }
    if (event.key.length === 1) {
      const now = performance.now();
      search = now - searchTime > 700 ? event.key : search + event.key;
      searchTime = now;
      const query = [...search].every(char => char === search[0]) ? search[0] : search;
      const ordered = [...choices.slice(current + 1), ...choices.slice(0, current + 1)];
      const found = ordered.find(item => (item.querySelector('span')?.textContent || item.textContent).trim().toLocaleLowerCase().startsWith(query.toLocaleLowerCase()));
      if (found) { event.preventDefault(); focusItem(choices.indexOf(found)); }
    }
  };
  const onFocusOut = (event) => {
    if (!root.contains(event.relatedTarget)) setOpenState(root, false);
  };

  const onInput = () => {
    enforceDialCodePrefix(root, input, config);
    keepCaretAfterPrefix(input, getLockedPrefix(root, config));
    syncCountryRequired(root, input);
  };

  const onPaste = () => {
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
  root.__sfCountryViewport?.(root.classList.contains('open'));
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
  root.querySelectorAll('img[data-flag-src]').forEach(img => flagObserver?.unobserve(img));

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
    if (!root.closest('sf-country-code')) bindCountryCode(root);
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
    icon.classList.add('sf-icon');
    icon.textContent = toBoolean(open) ? 'expand_less' : 'expand_more';
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
      for (const root of roots) if (!root.isConnected && !root.closest('sf-country-code')) unbindCountryCode(root);
    });
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(COUNTRY_CODE_SELECTOR) && !node.closest('sf-country-code')) {
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
