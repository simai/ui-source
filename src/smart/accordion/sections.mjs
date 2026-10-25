// The parts of sf-accordion that are about data, not the page: the shape a
// section takes, from the items a host gives or from a <details> written in
// the markup, and which sections are open. Kept apart from the element so the
// contract tests can run them in Node, as sf-image-field's value.mjs is.

// The sizes of the class accordion's control ladder; '' keeps its roomy
// default header, the look of a content page.
export const ACCORDION_SIZES = Object.freeze(['', '1/3', '1/2', '1', '2', '3']);
// The class accordion's appearances: a filled surface, a hairline border, or
// no fill and no radius with a line between sections.
export const ACCORDION_APPEARANCES = Object.freeze(['default', 'outline', 'flush']);
// What marks a section open or closed: the class accordion's chevron, or its
// plus and minus.
export const ACCORDION_MARKERS = Object.freeze(['chevron', 'plus-minus']);
// More open panels than this, and a landmark for each would crowd the page
// (WAI-ARIA accordion pattern): the panels stop being regions.
export const REGION_LIMIT = 6;

const text = (value) => (value === null || value === undefined ? '' : String(value));

// An id a section can be named by in open(id), in the events and in an
// element id: the host's own, or its place.
function sectionId(raw, index) {
  const id = text(raw).trim();
  return id || `section-${index + 1}`;
}

// One section, as the element draws it. `content` is text, never markup: the
// host's markup goes in a slot (`slot` names it), so nothing a record holds
// is parsed as HTML.
export function normaliseSection(item, index = 0) {
  if (typeof item === 'string') item = {title: item};
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  return {
    id: sectionId(item.id ?? item.key, index),
    title: text(item.title ?? item.label ?? item.text),
    content: text(item.content),
    slot: text(item.slot).trim(),
    open: Boolean(item.open),
    disabled: Boolean(item.disabled),
    icon: text(item.icon).trim(),
    badge: text(item.badge).trim(),
  };
}

// The sections from what a host gave: an array, or the same array as JSON in
// the `items` attribute. A section whose id repeats an earlier one is left
// out, as one id must name one section.
export function normaliseSections(items) {
  let list = items;
  if (typeof list === 'string') {
    const raw = list.trim();
    if (!raw) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const sections = [];
  list.forEach((item, index) => {
    const section = normaliseSection(item, index);
    if (!section || seen.has(section.id)) return;
    seen.add(section.id);
    sections.push(section);
  });
  return sections;
}

// Which sections are open: what the person or the host set, else what the
// section says. In single mode only the first of them stays open.
export function openSections(sections, overrides = new Map(), single = false) {
  const open = new Set();
  for (const section of sections) {
    const state = overrides.has(section.id) ? overrides.get(section.id) : section.open;
    if (!state) continue;
    if (single && open.size) break;
    open.add(section.id);
  }
  return open;
}

// The chevron's glyph, or plus and minus: the words the class accordion's
// runtime writes.
export function markerGlyph(marker, open) {
  if (marker === 'plus-minus') return open ? 'remove' : 'add';
  return 'chevron_right';
}

// The badge is a size the header carries: 1/3 up to a size 1 header, then one
// rung below the header (sf-badge has 1/3, 1/2 and 1).
export const BADGE_SIZE = Object.freeze({'': '1/3', '1/3': '1/3', '1/2': '1/3', 1: '1/3', 2: '1/2', 3: '1'});
