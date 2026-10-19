// Form fields come in three sizes. 1/3 and 3 were retired: no consumer used
// them, and they could not hold a field's own pictures, tags and targets. A
// page written for a retired size keeps rendering at the nearest kept size, and
// says so once in the console so the markup can be updated.
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
