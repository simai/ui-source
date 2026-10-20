// The spinner's drawing, without the component's side effects (no registry, no
// observer), so a control that shows work in place of its icon -- a button, an
// icon button, a group's segment -- draws the one spinner of the Framework
// without loading or binding the spinner component (simai/ui-source#10).
//
// The ladder: a spinner is drawn on the icon grid. Material Symbols are drawn on
// 24 units and, at the regular weight the Framework's controls use, stroke 2 of
// them; a spinner on the same grid, scaled to the icon box of a step, strokes as
// the icons of that step do, and needs no stroke of its own per step.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const SPINNER_GRID = 24;
export const SPINNER_STROKE = 2;

export function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    node.setAttribute(key, String(value));
  });
  return node;
}

// The arc on the icon grid. The circles carry presentation attributes as well
// as their classes: the spinner sheet styles them (track colour, the arc's
// motion, the still arc under reduced motion), and until that sheet has arrived
// they draw a faint ring in the current ink rather than a filled black disc.
export function createLadderArcSvg() {
  const centre = SPINNER_GRID / 2;
  const radius = centre - SPINNER_STROKE / 2;
  const svg = createSvgNode('svg', {
    class: 'sf-loader-svg',
    viewBox: `0 0 ${SPINNER_GRID} ${SPINNER_GRID}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const filled = createSvgNode('circle', {
    class: 'sf-loader-ring-filled',
    cx: centre,
    cy: centre,
    r: radius,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': SPINNER_STROKE,
    opacity: '0.3',
  });
  const accent = createSvgNode('circle', {
    class: 'sf-loader-ring-accent',
    cx: centre,
    cy: centre,
    r: radius,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': SPINNER_STROKE,
    'stroke-linecap': 'round',
    pathLength: 100,
    'stroke-dasharray': '0 100',
    transform: `rotate(90 ${centre} ${centre})`,
  });
  svg.append(filled, accent);
  return svg;
}

// A spinner that stands in a control: an endless arc, decorative (the control
// keeps its label and says aria-busy), and marked bound so the spinner
// component, when it is on the page, leaves it as drawn. `className` names the
// control's slot for it; `overlay` lays it over the control's hidden label
// instead of in the place of an icon.
export function createInlineSpinner({className = '', overlay = false} = {}) {
  const root = document.createElement('span');
  root.className = [
    'sf-loader-container',
    'sf-loader--infinite',
    className,
    className && overlay ? `${className}--overlay` : '',
  ].filter(Boolean).join(' ');
  root.dataset.sfSpinnerBound = '1';
  root.dataset.infinite = 'true';
  root.setAttribute('aria-hidden', 'true');
  const indicator = document.createElement('span');
  indicator.className = 'sf-loader--loading-indicator';
  indicator.append(createLadderArcSvg());
  root.append(indicator);
  return root;
}
