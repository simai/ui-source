// sf-steps' list and states (owner decision C101, 2026-11-12), apart from the
// element so that they can be tested without a page: the item state words,
// the one list format and the old forms it still reads, each step's drawn
// state and whether a person may go to it.
import { noteDeprecated } from '../../../core/js/deprecations.js';

// The state words of an item (C101). done, skipped, running and error are an
// item's own; current and ahead come from its place (an item may also say
// ahead itself: a step before current that was never done).
export const STATES = ['done', 'current', 'ahead', 'error', 'skipped', 'running'];
const OWN = ['done', 'ahead', 'skipped', 'running', 'error'];
export const MARKERS = ['number', 'dot'];
export const LAYOUTS = ['auto', 'row', 'column', 'count'];
export const NAVIGATION = ['', 'visited', 'free'];
// Under this many rem of its own width an automatic list is the count line.
export const COUNT_BELOW_REM = 20;

// The old forms (sf-steps 1.3 and before) are read until 2027-01-01 and each
// use is noted in SF.deprecations with its dates: the item state words
// completed and default, the string form label::flag|label, error-step and
// separator-icon.
const SINCE = '2026-11-12';
const REMOVE_AFTER = '2027-01-01';
const FORMER_STATES = { completed: 'done', default: 'ahead' };

export function noteOld(kind, attribute, from, to) {
  noteDeprecated({
    component: 'sf-steps',
    tag: 'sf-steps',
    kind,
    attribute,
    from,
    to,
    since: SINCE,
    remove_after: REMOVE_AFTER,
  });
}

/** An item's own state in today's words; the former completed and default are read (noted once). */
export function ownState(value) {
  const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (Object.hasOwn(FORMER_STATES, word)) {
    noteOld('value', 'items.state', word, FORMER_STATES[word]);
    return FORMER_STATES[word];
  }
  return OWN.includes(word) ? word : '';
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

function normalizeItem(item) {
  if (typeof item === 'string') return { label: item.trim() };
  if (!item || typeof item !== 'object') return null;
  const label = text(item.label);
  const note = text(item.text);
  const state = ownState(item.state);
  return {
    label,
    ...(note ? { text: note } : {}),
    ...(item.disabled === true ? { disabled: true } : {}),
    ...(state ? { state } : {}),
  };
}

export function parseItems(items = '') {
  // The list as JSON in the attribute reads like the property.
  if (typeof items === 'string' && items.trim().startsWith('[')) {
    try {
      return parseItems(JSON.parse(items));
    } catch {
      // Not JSON: the old "label::flag|label" form below.
    }
  }
  if (Array.isArray(items)) {
    return items.map(normalizeItem).filter(Boolean);
  }

  const source = String(items || '').trim();
  if (!source) return [];
  // The old string form: "label::disabled,completed|label".
  noteOld('attribute', 'items', 'label::flag|label', 'items as JSON [{label, state}]');
  return source
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelPart, flagsPart = ''] = entry.split('::');
      const flags = flagsPart
        .split(',')
        .map((flag) => flag.trim().toLowerCase())
        .filter(Boolean);
      const word = flags.find((flag) => OWN.includes(flag) || Object.hasOwn(FORMER_STATES, flag));
      const state = word ? ownState(word) : '';
      return {
        label: labelPart.trim(),
        ...(flags.includes('disabled') ? { disabled: true } : {}),
        ...(state ? { state } : {}),
      };
    });
}

/**
 * Each item's drawn state from its own state, its place against current and
 * the old error-step. running and error win over the place (C73: a real
 * status is stronger); the step at current is current; before it a step is
 * done unless it says skipped or ahead; after it a step is ahead unless it says
 * done or skipped. current equal to the number of steps is «all done»: no
 * step is current.
 */
export function resolveStates(items, current, errorStep = null) {
  return items.map((item, index) => {
    const own = item.state || '';
    let state;
    if (own === 'running' || own === 'error') state = own;
    else if (errorStep === index) state = 'error';
    else if (index === current) state = 'current';
    else if (own) state = own;
    else state = index < current ? 'done' : 'ahead';
    return { ...item, index, state, passed: index < current, current: index === current };
  });
}

/** Whether a person may go to this step: navigation visited (a step behind, or one done, skipped or failed) or free (any). */
export function reachable(item, navigation) {
  if (item.disabled || item.current) return false;
  if (navigation === 'free') return true;
  if (navigation === 'visited') return item.passed || ['done', 'skipped', 'error'].includes(item.state);
  return false;
}
