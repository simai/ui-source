// Form fields come in three sizes. 1/3 and 3 were retired: no consumer used
// them, and they could not hold a field's own pictures, tags and targets. A
// page written for a retired size keeps rendering at the nearest kept size, and
// says so once in the console so the markup can be updated.
//
// The fields of the field ladder below are the exception: they stand on all
// five steps, as sf-input does.
import { noteDeprecated } from '../core/js/deprecations.js';

export const FIELD_SIZES = Object.freeze(['1/2', '1', '2']);
export const RETIRED_FIELD_SIZES = Object.freeze({'1/3': '1/2', '3': '2'});

const warned = new Set();

// A control placed inside something with the whole scale (a list item, say)
// takes the nearest form size, quietly: the list is not wrong to be 1/3.
export function nearestFieldSize(value) {
  const size = String(value ?? '').trim().toLowerCase();
  if (FIELD_SIZES.includes(size)) return size;
  return Object.hasOwn(RETIRED_FIELD_SIZES, size) ? RETIRED_FIELD_SIZES[size] : '1';
}

export function fieldSize(value, component = 'field', fallback = '1') {
  const size = String(value ?? '').trim().toLowerCase();
  if (FIELD_SIZES.includes(size)) return size;
  if (Object.hasOwn(RETIRED_FIELD_SIZES, size)) {
    const kept = RETIRED_FIELD_SIZES[size];
    noteDeprecated({component, kind: 'value', attribute: 'size', from: size, to: kept});
    const key = `${component}:${size}`;
    if (!warned.has(key) && typeof console !== 'undefined') {
      warned.add(key);
      console.warn(`[SIMAI Framework] ${component}: size ${size} is retired for form fields; rendering size ${kept}.`);
    }
    return kept;
  }
  return fallback;
}

// The field ladder (fields ladder, 2026-11-14): one height per step for every
// field that stands on it, the control ladder sf-button and sf-button-icon
// stand on (--sf-ui-<size>--control-height: 28 / 32 / 40 / 48 / 56 on a
// desktop). A text field kept the outer steps first (actions block item 4,
// 2026-11-08: a toolbar search or a hero search stands beside buttons of 1/3
// and 3); sf-input-lookup, -quantity, -date, -code, -color and -country drew
// 32 / 48 or 40 at 1/3 and 3 beside it, so they take the same five steps and
// the stylesheets size their parts from the same steps
// (component/inputs/scss/_field-ladder.scss). The other fields (textarea,
// dropdown, file upload, image, rich text) keep the three sizes for now.
export const FIELD_LADDER = Object.freeze(['1/3', ...FIELD_SIZES, '3']);
export const INPUT_SIZES = FIELD_LADDER;

/** A size on the field ladder: one of the five steps, else the fallback. */
export function ladderSize(value, fallback = '1') {
  const size = String(value ?? '').trim().toLowerCase();
  return FIELD_LADDER.includes(size) ? size : fallback;
}

export function inputSize(value, fallback = '1') {
  return ladderSize(value, fallback);
}

// Markup written by hand carries its size as a class, so the binder moves a
// retired size class to the kept one before anything measures the field.
export function retireFieldSizeClass(root, block) {
  if (!root?.classList) return;
  for (const [retired, kept] of Object.entries(RETIRED_FIELD_SIZES)) {
    const name = `${block}--size-${retired}`;
    if (!root.classList.contains(name)) continue;
    root.classList.replace(name, `${block}--size-${fieldSize(retired, block)}`);
  }
}
