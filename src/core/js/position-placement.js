// Pure logical ⇄ physical placement mapping for SF.Position. No DOM and no
// dependencies, so it is testable without Floating UI installed.
const SIDES = ['block-start', 'block-end', 'inline-start', 'inline-end'];
const ALIGNS = ['start', 'center', 'end'];

/** Maps a logical side and alignment to a Floating UI placement. */
export function physicalPlacement(side = 'block-end', align = 'start', rtl = false) {
  if (!SIDES.includes(side)) throw new TypeError(`Unknown placement side: ${side}`);
  if (!ALIGNS.includes(align)) throw new TypeError(`Unknown placement alignment: ${align}`);
  const physical = side === 'block-start' ? 'top'
    : side === 'block-end' ? 'bottom'
      : side === 'inline-start' ? (rtl ? 'right' : 'left')
        : (rtl ? 'left' : 'right');
  // Floating UI mirrors start/end alignment itself for right-to-left elements.
  return align === 'center' ? physical : `${physical}-${align}`;
}

/** Maps a Floating UI placement back to the logical side. */
export function logicalSide(placement, rtl = false) {
  const physical = String(placement).split('-')[0];
  if (physical === 'top') return 'block-start';
  if (physical === 'bottom') return 'block-end';
  if (physical === 'left') return rtl ? 'inline-end' : 'inline-start';
  return rtl ? 'inline-start' : 'inline-end';
}
