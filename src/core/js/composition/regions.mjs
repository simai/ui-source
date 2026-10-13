import { canonical, isPlainObject, stableStringify } from './canonical.mjs';

// Declared-region layout rules. Region names are chosen by the document author;
// Framework owns only landmark semantics, placement, cardinality and nesting.
export const REGION_LANDMARKS = Object.freeze(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'none']);
export const REGION_PLACEMENTS = Object.freeze(['block', 'start', 'center', 'end']);
export const REGION_ACCEPTS = Object.freeze(['layout', 'content', 'smart']);
export const REGION_LIMITS = Object.freeze({ maxRegionsPerLayout: 12, maxRegionLayoutNesting: 4 });
export const REGION_ELEMENTS = Object.freeze({
  banner: 'header',
  navigation: 'nav',
  main: 'main',
  complementary: 'aside',
  contentinfo: 'footer',
  region: 'section',
  none: 'div',
});

const DOCUMENT_LEVEL_LANDMARKS = new Set(['banner', 'main', 'contentinfo']);
const PLACEMENT_RANK = { start: 0, center: 1, end: 2 };

const diagnostic = (code, path, message) => ({ code, path, message });

function landmarkOf(node) {
  return node?.type === 'layout.region' && typeof node.props?.landmark === 'string' ? node.props.landmark : null;
}

function validateRegionList(node, path, diagnostics) {
  const regions = Array.isArray(node.slots?.regions) ? node.slots.regions : [];
  const names = new Set();
  let bandRank = -1;
  regions.forEach((region, index) => {
    const regionPath = `${path}.slots.regions[${index}]`;
    if (region?.type !== 'layout.region') return;
    const name = region.props?.name;
    if (typeof name === 'string') {
      if (names.has(name)) diagnostics.push(diagnostic('region_name_duplicate', `${regionPath}.props.name`, `Region ${name} is declared twice in one layout`));
      names.add(name);
    }
    const placement = region.props?.placement ?? 'block';
    if (placement === 'block') {
      bandRank = -1;
      return;
    }
    const rank = PLACEMENT_RANK[placement];
    if (rank === undefined) return;
    if (rank < bandRank) diagnostics.push(diagnostic('region_order_invalid', `${regionPath}.props.placement`, 'Side-by-side regions must be declared in start, center, end order'));
    bandRank = Math.max(bandRank, rank);
  });
}

function validateRegionNode(node, path, context, diagnostics) {
  const props = isPlainObject(node.props) ? node.props : {};
  const landmark = landmarkOf(node);
  if (landmark && DOCUMENT_LEVEL_LANDMARKS.has(landmark) && (context.insideLandmark || context.insidePage)) {
    diagnostics.push(diagnostic('region_landmark_context', `${path}.props.landmark`, `${landmark} is only allowed outside other landmarks and layout.page`));
  }
  if (landmark === 'region' && props.label === undefined) {
    diagnostics.push(diagnostic('region_label_required', `${path}.props.label`, 'A region landmark requires an accessible label'));
  }
  if (landmark === 'none' && props.label !== undefined) {
    diagnostics.push(diagnostic('region_label_forbidden', `${path}.props.label`, 'A region without a landmark cannot carry an accessible label'));
  }
  const children = Array.isArray(node.slots?.default) ? node.slots.default : [];
  const min = Number.isInteger(props.min_items) ? props.min_items : 0;
  const max = Number.isInteger(props.max_items) ? props.max_items : 500;
  if (min > max) diagnostics.push(diagnostic('region_bounds_invalid', `${path}.props`, 'min_items must not exceed max_items'));
  else if (children.length < min || children.length > max) diagnostics.push(diagnostic('region_cardinality', `${path}.slots.default`, 'Region child count is outside its declared range'));
  if (Array.isArray(props.accepts)) {
    const accepted = new Set(props.accepts);
    children.forEach((child, index) => {
      const manifest = context.registry.types.get(child?.type);
      if (manifest && !accepted.has(manifest.category)) {
        diagnostics.push(diagnostic('region_child_category_forbidden', `${path}.slots.default[${index}]`, `${manifest.category} is not accepted by this region`));
      }
    });
  }
}

/**
 * Applies declared-region rules to a structurally valid Document root.
 * The generic validator has already checked manifests, props and slot types.
 */
export function validateRegionRules(root, registry, diagnostics) {
  const landmarkUse = new Map();
  const visit = (node, path, context) => {
    if (!isPlainObject(node)) return;
    if (node.type === 'layout.region' && context.parentType !== 'layout.regions') {
      diagnostics.push(diagnostic('region_parent_invalid', path, 'layout.region must be a direct child of layout.regions'));
    }
    let next = { ...context, parentType: node.type };
    if (node.type === 'layout.page') next.insidePage = true;
    if (node.type === 'layout.regions') {
      next.regionDepth = context.regionDepth + 1;
      if (next.regionDepth > REGION_LIMITS.maxRegionLayoutNesting) diagnostics.push(diagnostic('region_nesting_limit', path, 'Region layouts are nested too deeply'));
      validateRegionList(node, path, diagnostics);
    }
    if (node.type === 'layout.region') {
      validateRegionNode(node, path, { ...context, registry }, diagnostics);
      const landmark = landmarkOf(node);
      if (landmark && landmark !== 'none') {
        if (!landmarkUse.has(landmark)) landmarkUse.set(landmark, []);
        landmarkUse.get(landmark).push({ path, label: node.props?.label });
        next = { ...next, insideLandmark: true };
      }
    }
    for (const [slotName, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (!Array.isArray(children)) continue;
      children.forEach((child, index) => visit(child, `${path}.slots.${slotName}[${index}]`, next));
    }
  };
  visit(root, '$.root', { parentType: null, insidePage: false, insideLandmark: false, regionDepth: 0 });
  for (const [landmark, uses] of landmarkUse) {
    if (landmark === 'main' && uses.length > 1) {
      for (const use of uses.slice(1)) diagnostics.push(diagnostic('region_landmark_duplicate', `${use.path}.props.landmark`, 'A document can contain only one main region'));
      continue;
    }
    if (uses.length < 2) continue;
    const labels = new Set();
    for (const use of uses) {
      if (use.label === undefined) {
        // A region landmark without a label is already reported once above.
        if (landmark !== 'region') diagnostics.push(diagnostic('region_label_required', `${use.path}.props.label`, `Repeated ${landmark} regions require distinct labels`));
        continue;
      }
      if (labels.has(use.label)) diagnostics.push(diagnostic('region_label_duplicate', `${use.path}.props.label`, `Repeated ${landmark} regions require distinct labels`));
      else labels.add(use.label);
    }
  }
}

async function sha256(value) {
  const bytes = new globalThis.TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Lists every declared region of an already normalized Document with a
 * digest of its canonical subtree. Products use the digest to invalidate only
 * outputs that depend on a changed region; the list order is document order.
 */
export async function describeRegions(document) {
  const regions = [];
  const visit = async (node, path, layout) => {
    if (!isPlainObject(node)) return;
    if (node.type === 'layout.region' && layout) {
      const props = node.props || {};
      regions.push({
        layout,
        node: node.id,
        name: props.name,
        landmark: props.landmark,
        placement: props.placement ?? 'block',
        path,
        digest: `sha256:${await sha256(stableStringify(canonical(node)))}`,
      });
    }
    const nextLayout = node.type === 'layout.regions' ? node.id : null;
    for (const [slotName, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (!Array.isArray(children)) continue;
      for (let index = 0; index < children.length; index += 1) await visit(children[index], `${path}.slots.${slotName}[${index}]`, nextLayout);
    }
  };
  await visit(document?.root, '$.root', null);
  return regions;
}

export default { describeRegions, validateRegionRules };
