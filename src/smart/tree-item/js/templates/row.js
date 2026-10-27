import { html, nothing } from 'lit';

// One row of a tree: the treeitem box, its chevron (or the spacer that keeps
// the chevron's column), its icon and its name. sf-tree draws every entry with
// it and sf-tree-item draws itself with it, so the row is one markup.
//
// Class markup only (standard 1.3.8 §18.4: a part that only shows a value is
// class markup): the icons are the icon font's <i class="sf-icon">, not sf-icon
// elements. Drawn as sf-tree-item and sf-icon elements, a row of a 2 000-node
// tree cost three Smart elements, and the tree took 33 s to draw
// (simai/ui-source#43).
//
// row:
//   id, value, label, href, target, rel, kind, open, selected, active,
//   disabled, icon, openIcon, closedIcon, chevronOpenIcon, chevronClosedIcon,
//   openLabel, closeLabel, hasChildren
//   level, setsize, posinset   aria-level and the rest, for a flat tree
//   tabStop                    the one row Tab reaches
//   selection                  'none' leaves aria-selected out
//   rootClass, itemClass, containerClass, nameClass, rootStyle
//   content                    what a standalone item draws for its name
//   onToggle, onName           handlers of the chevron and the name
// `children` is a template the caller draws after the container (the nested
// group of a standalone item); a tree passes none.

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// Regular, not filled. A filled glyph was how a tree's icons carried their
// weight while they were painted at a quarter strength; at full strength the
// fill is a solid block beside a regular name, which is heavier than anything
// else in the row (owner, 2026-10-08).
export function renderIcon(icon, className = '') {
  if (!icon) return nothing;
  return html`<i class=${joinClasses('sf-icon', className)} aria-hidden="true">${icon}</i>`;
}

function renderName(row) {
  if (row.label) return html`<span>${row.label}</span>`;
  return row.content !== undefined && row.content !== nothing ? row.content : nothing;
}

export function renderTreeRow(row, children = nothing) {
  const isFile = row.kind === 'file';
  const canToggle = !isFile && Boolean(row.hasChildren);
  const open = canToggle && Boolean(row.open);
  const itemClasses = joinClasses(
    'sf-tree-item flex flex-col',
    row.kind ? `sf-tree-item--${row.kind}` : '',
    open ? 'open' : '',
    canToggle ? 'has-children' : '',
    row.selected || row.active ? 'active' : '',
    row.disabled ? 'disabled' : '',
    row.rootClass,
    row.itemClass,
  );
  const containerClasses = joinClasses('sf-tree-item-container flex items-cross-center relative', row.containerClass);
  const nameClasses = joinClasses('sf-tree-item-name', row.nameClass);
  const nodeIcon = isFile ? 'draft' : open ? row.openIcon : row.closedIcon;
  const chevronIcon = open ? row.chevronOpenIcon : row.chevronClosedIcon;
  const level = row.level ? String(row.level) : nothing;

  return html`<div
      class=${itemClasses}
      style=${[row.rootStyle, row.level ? `--sf-tree-level:${row.level}` : ''].filter(Boolean).join(';') || nothing}
      role="treeitem"
      tabindex=${row.tabStop ? '0' : '-1'}
      aria-level=${level}
      aria-setsize=${row.setsize ? String(row.setsize) : nothing}
      aria-posinset=${row.posinset ? String(row.posinset) : nothing}
      aria-expanded=${canToggle ? String(open) : nothing}
      aria-selected=${row.selection === 'none' ? nothing : String(Boolean(row.selected))}
      aria-current=${row.active ? 'page' : nothing}
      aria-disabled=${row.disabled ? 'true' : nothing}
      data-open-icon=${row.openIcon || nothing}
      data-closed-icon=${row.closedIcon || nothing}
      data-value=${row.value || nothing}
      data-sf-entry=${row.id ?? nothing}
      data-sf-tree-level=${level}
    ><div class=${containerClasses}>${canToggle
        ? html`<button type="button" tabindex="-1" class="sf-icon-button sf-tree-toggle" ?disabled=${row.disabled} aria-expanded=${String(open)} aria-label=${open ? row.closeLabel : row.openLabel} @click=${row.onToggle}>${renderIcon(chevronIcon, 'sf-tree-chevron')}</button>`
        : html`<span class="sf-tree-toggle-spacer" aria-hidden="true"></span>`}${row.icon === false ? nothing : renderIcon(nodeIcon, 'sf-tree-node-icon')}${row.href && !row.disabled
        ? html`<a class=${nameClasses} href=${row.href} target=${row.target || nothing} rel=${row.rel || nothing} tabindex="-1" @click=${row.onName}>${renderName(row)}</a>`
        : html`<span class=${nameClasses} @click=${row.onName}>${renderName(row)}</span>`}</div>${children}</div>`;
}
