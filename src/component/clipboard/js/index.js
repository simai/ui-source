// Copy from a button (owner decision C48, 2026-11-11). Any <button>, sf-button
// or sf-button-icon that says what to copy copies on a press:
//
//   <button data-sf-copy="npm i @simai-studio/ui">…</button>
//   <sf-button-icon icon="content_copy" label="Скопировать ключ" data-sf-copy-target="#key"></sf-button-icon>
//
// data-sf-copy is the text itself; data-sf-copy-target="#id" names an element
// whose value (a field) or text (anything else, a numbered code block without
// its numbers) is copied whole. The feedback is sf-button-copy's, from the
// same core helper (core/js/copy-feedback.js): the icon is a check for two
// seconds, "Скопировано" is said politely, and on a refusal the source is
// selected and the words that say which keys copy it stand above the button.
// Nothing moves: the words are a Framework tooltip placed over the page
// (SF.Position), the status a screen reader hears takes no room. An icon-only
// button's name is a Framework tooltip on hover and keyboard focus, not the
// browser's title.
//
// The class route this component started with -- class sf-clipboard (or
// btn-clipboard) with data-copy, data-target or data-clipboard-target -- keeps
// working until 2027-01-01 and is noted in SF.deprecations (journal records
// class-clipboard-to-data-sf-copy, attribute-clipboard-sources-to-data-sf-copy).
import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import BundledPosition from '../../../core/js/position.js';
import { partId } from '../../../core/js/instance-path.js';
import { noteDeprecated } from '../../../core/js/deprecations.js';
import { copyText } from '../../../core/js/clipboard.js';
import { createCopyFeedback, readCopyText, copyWord, DURATION } from '../../../core/js/copy-feedback.js';

// Prefer the placement helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

const ROUTE_SELECTOR = '[data-sf-copy], [data-sf-copy-target]';
const LEGACY_SELECTOR = '.sf-clipboard, .btn-clipboard';
const COPY_SELECTOR = `${ROUTE_SELECTOR}, ${LEGACY_SELECTOR}`;
const ROUTE_ATTRIBUTES = ['data-sf-copy', 'data-sf-copy-target'];
const LEGACY_VALUE = 'data-copy';
const LEGACY_TARGETS = ['data-target', 'data-clipboard-target'];
const BOUND_FLAG = 'sfCopyBound';
const ICON_SELECTOR = 'sf-icon, .sf-icon';
const COPY_SIZES = new Set(['1/3', '1/2', '1', '2', '3']);
const COPY_TYPES = new Set(['default', 'tonal', 'outline', 'link']);
const COPY_SCHEMES = new Set(['primary', 'secondary', 'on-surface']);
const SOURCE_ERROR_CODES = new Set([
  'ambiguous_source',
  'empty_source',
  'missing_source',
  'missing_target',
]);
const DEPRECATED = { since: '2026-11-11', remove_after: '2027-01-01' };
// A box no one sees and a screen reader reads; inline, so it takes no room
// before the sheet has arrived either.
const UNSEEN = 'position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

function normalizeChoice(value, choices, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return choices.has(normalized) ? normalized : fallback;
}

// Two seconds, as sf-button-copy (it was five); data-duration keeps its range.
function normalizeDuration(value) {
  if (value === undefined || value === null || value === '') return DURATION;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DURATION;
  return Math.min(10000, Math.max(1000, parsed));
}

function normalizeCopyError(error) {
  if (SOURCE_ERROR_CODES.has(error?.message)) return error.message;
  if (error?.message === 'copy_unsupported') return 'copy_unsupported';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'copy_denied';
  }
  return 'copy_failed';
}

function resolveIdTarget(button, value) {
  const normalized = String(value || '').trim();
  if (!/^#[A-Za-z][\w:.-]*$/.test(normalized)) return null;
  return button.ownerDocument.getElementById(normalized.slice(1));
}

// Kept under its old name: Highlight's numbered blocks are read by it.
function readTargetText(target) {
  return readCopyText(target);
}

const isLegacy = button => button.matches?.(LEGACY_SELECTOR) === true;

function noteLegacy(button) {
  if (!isLegacy(button)) return;
  const component = 'clipboard';
  for (const name of ['sf-clipboard', 'btn-clipboard']) {
    if (button.classList.contains(name)) noteDeprecated({ component, kind: 'class', from: name, to: 'data-sf-copy', ...DEPRECATED });
  }
  if (button.hasAttribute(LEGACY_VALUE)) noteDeprecated({ component, kind: 'attribute', from: LEGACY_VALUE, to: 'data-sf-copy', ...DEPRECATED });
  for (const name of LEGACY_TARGETS) {
    if (button.hasAttribute(name)) noteDeprecated({ component, kind: 'attribute', from: name, to: 'data-sf-copy-target', ...DEPRECATED });
  }
}

// The sources a button names: data-sf-copy (a text) and data-sf-copy-target
// (an element), and on a legacy class button data-copy, data-target and
// data-clipboard-target. One is copied; two are ambiguous and copy nothing.
function copySources(button) {
  const values = [];
  const targets = new Set();
  const target = button.getAttribute('data-sf-copy-target');
  if (target !== null && target.trim() !== '') targets.add(target.trim());
  // A bare data-sf-copy beside a target marks the button, it names no text.
  if (button.hasAttribute('data-sf-copy') && (button.getAttribute('data-sf-copy') !== '' || !targets.size)) {
    values.push(button.getAttribute('data-sf-copy'));
  }
  if (isLegacy(button)) {
    if (button.hasAttribute(LEGACY_VALUE)) values.push(button.getAttribute(LEGACY_VALUE) || '');
    for (const name of LEGACY_TARGETS) {
      const value = button.getAttribute(name);
      if (value !== null && value.trim() !== '') targets.add(value.trim());
    }
  }
  return { values, targets: [...targets] };
}

function resolveCopySource(button) {
  const { values, targets } = copySources(button);
  if (values.length + targets.length > 1) throw new Error('ambiguous_source');
  if (values.length) return String(values[0] || '');
  if (targets.length) {
    const target = resolveIdTarget(button, targets[0]);
    if (!target) throw new Error('missing_target');
    return readTargetText(target);
  }
  throw new Error('missing_source');
}

function sourceElement(button) {
  const { values, targets } = copySources(button);
  if (values.length || targets.length !== 1) return null;
  return resolveIdTarget(button, targets[0]);
}

// The copy itself, with its fallback, is the core helper (core/js/clipboard.js).
// Kept under its old name, which this module exports.
function writeText(text, documentRef = document) {
  return copyText(text, { document: documentRef });
}

// What stands for the button in the page: an sf-button or sf-button-icon
// host (display: contents) for its inner control, else the button.
function outerOf(button) {
  const host = button.parentElement?.closest?.('sf-button, sf-button-icon');
  return host && host.contains(button) ? host : button;
}

function ensureStatus(button) {
  const selector = button.getAttribute('data-status');
  const authored = selector ? resolveIdTarget(button, selector) : null;
  if (authored) {
    authored.setAttribute('role', 'status');
    authored.setAttribute('aria-live', 'polite');
    authored.setAttribute('aria-atomic', 'true');
    return { element: authored, generated: false };
  }
  const status = button.ownerDocument.createElement('span');
  status.className = 'sf-clipboard-status';
  status.style.cssText = UNSEEN;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  outerOf(button).after(status);
  return { element: status, generated: true };
}

// The Framework's plain tooltip (component.tooltip, class markup): the
// inverse surface at the small text step, as sf-button-copy draws it.
function tooltipSurface(doc, className, text) {
  const surface = doc.createElement('span');
  surface.className = `sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 ${className}`;
  surface.hidden = true;
  const content = doc.createElement('span');
  content.className = 'sf-tooltip-content';
  const words = doc.createElement('span');
  words.className = 'sf-tooltip-text';
  words.textContent = text;
  content.append(words);
  surface.append(content);
  return surface;
}

function uniqueId(doc, base) {
  let id = base;
  for (let index = 2; doc.getElementById(id); index++) id = `${base}-${index}`;
  return id;
}

function hasVisibleText(button) {
  const walker = button.ownerDocument.createTreeWalker(button, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest?.('.sf-icon, sf-icon, [aria-hidden="true"]')) continue;
    if (node.textContent.trim()) return true;
  }
  return false;
}

// An icon-only button's name, shown as the Framework tooltip on hover and
// keyboard focus (the tooltip component's controller owns showing it). A
// title becomes the name and goes: the browser drew it late, on hover only,
// in its own look. A button that has a tooltip of its own keeps it.
function ensureNameTooltip(button, controller) {
  if (button.hasAttribute('data-tooltip') || hasVisibleText(button)) return;
  const outer = outerOf(button);
  const title = (button.getAttribute('title') || outer.getAttribute('title') || '').trim();
  const name = (button.getAttribute('aria-label') || title).trim();
  if (!name) return;
  if (title) {
    button.removeAttribute('title');
    if (outer !== button) outer.removeAttribute('title');
    if (!button.getAttribute('aria-label')) {
      button.setAttribute('aria-label', name);
      if (outer !== button) outer.setAttribute('aria-label', name);
    }
  }
  const doc = button.ownerDocument;
  const path = button.id ? `page/${button.id}` : `data-sf-copy[${[...doc.querySelectorAll(COPY_SELECTOR)].indexOf(button) + 1}]`;
  const surface = tooltipSurface(doc, 'sf-clipboard-name', name);
  surface.id = uniqueId(doc, partId(path, 'name'));
  outer.after(surface);
  button.setAttribute('data-tooltip', surface.id);
  controller.name = surface;
}

// Where the icon is changed: an sf-button-icon's icon, an sf-button's icon
// attribute, or the glyph inside a plain button. None: a button without one.
function iconHandle(button) {
  const outer = outerOf(button);
  if (outer !== button) {
    const attribute = outer.localName === 'sf-button-icon'
      ? 'icon'
      : ['icon-start', 'icon-end', 'icon'].find(name => outer.hasAttribute(name));
    if (!attribute) return null;
    return { get: () => outer.getAttribute(attribute), set: value => outer.setAttribute(attribute, value) };
  }
  const icon = button.querySelector(ICON_SELECTOR);
  if (!icon) return null;
  if (icon.localName === 'sf-icon') return { get: () => icon.getAttribute('icon'), set: value => icon.setAttribute('icon', value) };
  return { get: () => icon.textContent.trim(), set: (value) => { icon.textContent = value; } };
}

function showResult(button, controller, message) {
  if (!controller.result) {
    controller.result = tooltipSurface(button.ownerDocument, 'sf-clipboard-result', '');
    // The status says the words; the surface shows them, and is not heard twice.
    controller.result.setAttribute('aria-hidden', 'true');
    outerOf(button).after(controller.result);
  }
  controller.result.querySelector('.sf-tooltip-text').textContent = message;
  controller.result.hidden = false;
  controller.placed?.stop?.();
  controller.placed = positioning().anchor(button, controller.result, { side: 'block-start', align: 'center', fitHeight: false });
}

function hideResult(controller) {
  controller.placed?.stop?.();
  controller.placed = null;
  if (controller.result) controller.result.hidden = true;
}

function onPhase(button, controller, phase, message) {
  const icon = controller.icon;
  if (phase === 'pending') {
    button.setAttribute('aria-disabled', 'true');
    button.dataset.copyState = 'pending';
    if (icon && controller.restIcon === null) controller.restIcon = icon.get();
    return;
  }
  button.removeAttribute('aria-disabled');
  controller.status.element.textContent = message;
  if (phase === 'idle') {
    delete button.dataset.copyState;
    if (icon && controller.restIcon !== null) icon.set(controller.restIcon);
    controller.restIcon = null;
    hideResult(controller);
    return;
  }
  button.dataset.copyState = phase;
  if (icon) icon.set(phase === 'success' ? 'check' : 'error');
  // Words on screen: a failure always; a copy only where no icon says it.
  if (message && (phase === 'error' || !icon)) showResult(button, controller, message);
  else hideResult(controller);
}

async function activateCopy(button, controller) {
  if (!controller || controller.feedback.pending) return;
  const result = await controller.feedback.run({
    read: () => resolveCopySource(button),
    element: () => sourceElement(button),
    host: outerOf(button).parentElement || button.ownerDocument.body,
    holderClass: 'sf-clipboard-holder',
    node: button,
    document: button.ownerDocument,
    messages: { copied: button.dataset.success, failed: button.dataset.error },
  });
  if (result.outcome === 'applied') {
    button.dispatchEvent(new CustomEvent('sf:copy-success', {
      bubbles: true,
      detail: { method: result.method, text: result.text },
    }));
  } else if (result.reason !== 'busy') {
    const code = normalizeCopyError(result.error);
    button.dispatchEvent(new CustomEvent('sf:copy-error', {
      bubbles: true,
      detail: { code },
    }));
  }
}

let preloaded = false;
function preloadResultIcons() {
  if (preloaded) return;
  const preload = globalThis.SF?.Loader?.preloadIcons;
  if (typeof preload !== 'function') return;
  preloaded = true;
  // Asked for now, not when first drawn: a glyph the subset has not got draws
  // nothing until a second font arrives (the error came a second late).
  preload.call(globalThis.SF.Loader, ['check', 'error']);
}

function bindCopyButton(button) {
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.dataset[BOUND_FLAG] === 'true' && button._sfCopyController) return button._sfCopyController;
  noteLegacy(button);
  const controller = {
    status: ensureStatus(button),
    icon: iconHandle(button),
    restIcon: null,
    name: null,
    result: null,
    placed: null,
  };
  controller.feedback = createCopyFeedback({
    duration: () => normalizeDuration(button.dataset.duration),
    onPhase: (phase, message) => onPhase(button, controller, phase, message),
  });
  ensureNameTooltip(button, controller);
  if (controller.icon) preloadResultIcons();
  button.dataset[BOUND_FLAG] = 'true';
  button._sfCopyController = controller;
  return controller;
}

function unbindCopyButton(button) {
  const controller = button?._sfCopyController;
  if (!controller) return;
  controller.feedback.cancel();
  hideResult(controller);
  if (controller.icon && controller.restIcon !== null) controller.icon.set(controller.restIcon);
  if (controller.status.generated) controller.status.element.remove();
  controller.result?.remove();
  if (controller.name) {
    if (button.getAttribute('data-tooltip') === controller.name.id) button.removeAttribute('data-tooltip');
    controller.name.remove();
  }
  delete button._sfCopyController;
  delete button.dataset[BOUND_FLAG];
  delete button.dataset.copyState;
  button.removeAttribute('aria-disabled');
}

function initCopyTree(target = document) {
  if (target instanceof Element && target.matches?.(COPY_SELECTOR)) bindCopyButton(target);
  target.querySelectorAll?.(COPY_SELECTOR).forEach(bindCopyButton);
}

// One press handler for the document: an sf-button may draw its inner button
// again, and a listener on the old one would be lost with it. Enter and Space
// press a button, so the keyboard comes here too.
function onDocumentClick(event) {
  const button = event.target?.closest?.(COPY_SELECTOR);
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  activateCopy(button, bindCopyButton(button));
}

class Copy extends ComponentObserver {
  static componentName = 'Copy';

  constructor(props) {
    super(props);
    const {
      size = '1', type = 'link', scheme = 'on-surface', text = '', copy = text,
      done = '', error = '', label = '',
    } = this.params || {};
    const normalizedSize = normalizeChoice(size, COPY_SIZES, '1');
    const normalizedType = normalizeChoice(type, COPY_TYPES, 'link');
    const normalizedScheme = normalizeChoice(scheme, COPY_SCHEMES, 'on-surface');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add(`sf-clipboard-${normalizedSize}`, 'm-0');
    button.dataset.sfCopy = String(copy || '');
    if (done) button.dataset.success = done;
    if (error) button.dataset.error = error;
    const hasText = Boolean(String(text).trim());
    const accessibleLabel = String(this.attrs['aria-label'] || label || '').trim();
    if (accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
    else if (!hasText) button.disabled = true;
    button.classList.add(
      hasText ? 'sf-button' : 'sf-icon-button',
      'flex',
      'items-cross-center',
      hasText ? `sf-button--size-${normalizedSize}` : 'sf-icon-button--icon',
      hasText ? `sf-button--${normalizedScheme}` : `sf-icon-button--size-${normalizedSize}`,
      hasText ? `sf-button--${normalizedType}` : `sf-icon-button--${normalizedScheme}`,
    );
    if (!hasText) button.classList.add(`sf-icon-button--${normalizedType}`);
    const icon = document.createElement('sf-icon');
    icon.setAttribute('icon', 'content_copy');
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);
    if (hasText) {
      const span = document.createElement('span');
      span.className = 'sf-button-text-container';
      span.textContent = text;
      button.append(span);
    }
    this.template = button;
  }

  init() { bindCopyButton(this.html); }
  destroyInternal() { unbindCopyButton(this.html); }
}

registerComponent('Copy', Copy);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Clipboard = {
    bind: bindCopyButton,
    copy: button => activateCopy(button, button?._sfCopyController || bindCopyButton(button)),
    unbind: unbindCopyButton,
  };
}

// Once per document, whichever bundle copy of this module runs first.
if (!document.__sfCopyRoute) {
  document.__sfCopyRoute = true;
  document.addEventListener('click', onDocumentClick);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCopyTree(), { once: true });
  } else {
    initCopyTree();
  }

  // Added buttons, and an attribute that arrives later: an sf-button moves the
  // data-* written on it onto its inner button after it draws.
  new MutationObserver((mutations) => mutations.forEach((mutation) => {
    if (mutation.type === 'attributes') {
      if (mutation.target instanceof Element && mutation.target.matches(COPY_SELECTOR)) bindCopyButton(mutation.target);
      return;
    }
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) initCopyTree(node);
    });
  })).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ROUTE_ATTRIBUTES,
  });
}

export {
  activateCopy,
  bindCopyButton,
  copyWord,
  initCopyTree,
  readTargetText,
  resolveCopySource,
  normalizeCopyError,
  unbindCopyButton,
  writeText,
};
