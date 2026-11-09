// Shared by the menu probes (menu-simple, menu-amendments).
// The path's line on a box's border (R084, R072 e), read in the page: the
// row's ::before against the box the row stands in -- its outer start edge,
// its border, its padding, its radius -- and the neutral role.
export const PATH_LINE = (selector) => {
  const row = document.querySelector(selector);
  const box = row.closest('ul.sf-menu.sf-menu--bordered, .sf-menu--horizontal ul.sf-menu') || row.closest('ul.sf-menu');
  const before = getComputedStyle(row, '::before');
  const style = getComputedStyle(box);
  const rowBox = row.getBoundingClientRect();
  const outer = box.getBoundingClientRect();
  const probe = document.createElement('span');
  probe.style.color = 'var(--sf-primary)';
  probe.style.backgroundColor = 'var(--sf-on-surface-variant)';
  // In the box: a popup panel names its own variant ink (sf-place).
  box.append(probe);
  const primary = getComputedStyle(probe).color;
  const variant = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const top = parseFloat(before.top) || 0;
  const bottom = parseFloat(before.bottom) || 0;
  const left = rowBox.left + (parseFloat(before.left) || 0);
  const first = row.parentElement === box.firstElementChild;
  const last = row.parentElement === box.lastElementChild;
  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  const border = parseFloat(style.borderLeftWidth) || 0;
  const inset = parseFloat(style.paddingTop) || 0;
  const clear = Math.max(0, radius - inset - border);
  const chevron = row.querySelector('.sf-icon-button .sf-icon');
  return {
    content: before.content, width: before.width, background: before.backgroundColor, primary, variant,
    offset: left - outer.left, border, scroll: box.classList.contains('sf-menu--scroll'),
    height: rowBox.height - top - bottom, rowHeight: rowBox.height, top, bottom, clear, first, last,
    weight: getComputedStyle(row.querySelector('a') || row).fontWeight,
    chevron: chevron ? getComputedStyle(chevron).color : null,
    radiusEnd: before.borderTopRightRadius, radiusStart: before.borderTopLeftRadius,
  };
};
// Whether a path line reads as R084 asks: 2 px of primary, on the border
// pixel (one pixel in while the box scrolls), the row's height clear of the
// corner's curve, inner corners rounded, the › neutral.
export const lineOk = (line) => line.content !== 'none' && line.width === '2px' && line.background === line.primary
  && Math.abs(line.offset - (line.scroll ? line.border : 0)) <= 0.5
  && Math.abs(line.top - (line.first ? line.clear : 0)) <= 0.5 && Math.abs(line.bottom - (line.last ? line.clear : 0)) <= 0.5
  && line.radiusEnd === '2px' && line.radiusStart === '0px'
  && line.weight === '500' && (line.chevron === null || line.chevron === line.variant);
