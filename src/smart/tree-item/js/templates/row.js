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
//   id, value, label, href, target, rel, open, selected, active, disabled,
//   openIcon, closedIcon, chevronOpenIcon, chevronClosedIcon, openLabel,
//   closeLabel, hasChildren
//   nodeIcon                   the type icon the caller chose (core
//                              file-types: icon, kind, extension, place);
//                              '' draws none (C102)
//   folder                     a branch or an empty folder: the row's class
//   note                       a second text after the name: a comment, a
//                              count, a size (C102 §7 items 7-8)
//   mark, more                 a highlighted line; the «…» line
//   pageHidden, hiddenWord     a hidden page, greyed, with its word (C102 8)
//   check                      'true' | 'false' | 'mixed': a check box in the
//                              row and aria-checked (selection="check")
//   placeholder, spinner       'loading' | 'error': the row a lazy branch
//                              shows while its children load or failed
//                              (C102 6); spinner is the Framework's spinner
//   retryLabel, onRetry        the error row's button
//   level, setsize, posinset   aria-level and the rest, for a flat tree
//   tabStop                    the one row Tab reaches
//   tipId                      a name cut to one line (TR-14): the id of the
//                              Framework tooltip that holds the whole name
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

// The whole name of a row whose name the line cuts (TR-14): the Framework's
// tooltip surface (component.tooltip), hidden in the markup and shown by its
// controller on hover and keyboard focus of the row, which names it with
// data-tooltip. No tail (C59). The row's aria-label is the same name, so the
// controller does not make the tooltip a description that repeats it.
function renderTip(row) {
  if (!row.tipId || !row.label) return nothing;
  return html`<span class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-tree-item-tip" id=${row.tipId} hidden><span
      class="sf-tooltip-content"><span class="sf-tooltip-text">${row.label}</span></span></span>`;
}

function renderName(row) {
  if (row.label) return html`<span>${row.label}</span>`;
  return row.content !== undefined && row.content !== nothing ? row.content : nothing;
}

// A check box of the Framework's class markup (component.checkbox): its box
// and mark only -- the row is the label, the press and the keys are the
// tree's, so the box is hidden from assistive technology and the treeitem
// says aria-checked.
function renderCheck(row) {
  if (!row.check) return nothing;
  const on = row.check === 'true';
  const mixed = row.check === 'mixed';
  return html`<span class="sf-checkbox sf-checkbox--size-1 sf-tree-check flex" aria-hidden="true"><span class="sf-checkbox-box flex"><input
      type="checkbox" tabindex="-1" .checked=${on} .indeterminate=${mixed} ?disabled=${row.disabled}><i class="sf-icon" aria-hidden="true">${mixed ? 'remove' : on ? 'check' : ''}</i></span></span>`;
}

function renderNote(row) {
  const word = row.pageHidden && row.hiddenWord
    ? html`<span class="sf-tree-item-note sf-tree-item-hidden-word">${row.hiddenWord}</span>`
    : nothing;
  const note = row.note ? html`<span class="sf-tree-item-note">${row.note}</span>` : nothing;
  return html`${word}${note}`;
}

// The row a lazy branch shows under itself: «Загрузка…» with the spinner, or
// the error with its retry button (C102 item 6).
function renderPlaceholder(row) {
  const level = row.level ? String(row.level) : nothing;
  const error = row.placeholder === 'error';
  return html`<div
      class=${joinClasses('sf-tree-item flex flex-col', `sf-tree-item--${row.placeholder}`)}
      style=${row.level ? `--sf-tree-level:${row.level}` : nothing}
      role="treeitem"
      tabindex=${row.tabStop ? '0' : '-1'}
      aria-level=${level}
      aria-setsize="1"
      aria-posinset="1"
      aria-busy=${error ? nothing : 'true'}
      aria-disabled=${error ? nothing : 'true'}
      data-sf-entry=${row.id}
      data-sf-tree-level=${level}
    ><div class="sf-tree-item-container flex items-cross-center relative"><span class="sf-tree-toggle-spacer" aria-hidden="true"></span>${error
        ? renderIcon('error', 'sf-tree-node-icon')
        : html`<span class="sf-tree-node-icon sf-tree-item-spinner" aria-hidden="true">${row.spinner ?? nothing}</span>`}<span class="sf-tree-item-name">${row.label}</span>${error
        ? html`<button type="button" tabindex="-1" class="sf-tree-item-retry" @click=${row.onRetry}>${row.retryLabel}</button>`
        : nothing}</div></div>`;
}

export function renderTreeRow(row, children = nothing) {
  if (row.placeholder) return renderPlaceholder(row);
  const isFile = row.kind === 'file';
  const canToggle = !isFile && Boolean(row.hasChildren);
  const open = canToggle && Boolean(row.open);
  const folder = row.folder ?? canToggle;
  const itemClasses = joinClasses(
    'sf-tree-item flex flex-col',
    folder ? 'sf-tree-item--folder' : 'sf-tree-item--file',
    open ? 'open' : '',
    canToggle ? 'has-children' : '',
    row.selected || row.active ? 'active' : '',
    row.disabled ? 'disabled' : '',
    row.mark ? 'sf-tree-item--mark' : '',
    row.more ? 'sf-tree-item--more' : '',
    row.pageHidden ? 'sf-tree-item--hidden' : '',
    row.rootClass,
    row.itemClass,
  );
  const containerClasses = joinClasses('sf-tree-item-container flex items-cross-center relative', row.containerClass);
  const nameClasses = joinClasses('sf-tree-item-name', row.nameClass);
  const nodeIcon = row.more ? 'more_horiz' : row.nodeIcon;
  const chevronIcon = open ? row.chevronOpenIcon : row.chevronClosedIcon;
  const level = row.level ? String(row.level) : nothing;
  const checked = row.check ? row.check : nothing;

  return html`<div
      class=${itemClasses}
      style=${[row.rootStyle, row.level ? `--sf-tree-level:${row.level}` : ''].filter(Boolean).join(';') || nothing}
      role="treeitem"
      tabindex=${row.tabStop ? '0' : '-1'}
      aria-level=${level}
      aria-setsize=${row.setsize ? String(row.setsize) : nothing}
      aria-posinset=${row.posinset ? String(row.posinset) : nothing}
      aria-expanded=${canToggle ? String(open) : nothing}
      aria-selected=${row.selection === 'none' || row.check ? nothing : String(Boolean(row.selected))}
      aria-checked=${checked}
      aria-current=${row.active ? 'page' : nothing}
      aria-disabled=${row.disabled ? 'true' : nothing}
      aria-label=${row.tipId && row.label ? row.label : nothing}
      data-tooltip=${row.tipId && row.label ? row.tipId : nothing}
      data-open-icon=${folder ? row.openIcon || nothing : nothing}
      data-closed-icon=${folder ? row.closedIcon || nothing : nothing}
      data-value=${row.value || nothing}
      data-sf-entry=${row.id ?? nothing}
      data-sf-tree-level=${level}
      draggable=${row.draggable ? 'true' : nothing}
    ><div class=${containerClasses}>${canToggle
        ? html`<button type="button" tabindex="-1" class="sf-icon-button sf-tree-toggle" ?disabled=${row.disabled} aria-expanded=${String(open)} aria-label=${open ? row.closeLabel : row.openLabel} @click=${row.onToggle}>${renderIcon(chevronIcon, 'sf-tree-chevron')}</button>`
        : html`<span class="sf-tree-toggle-spacer" aria-hidden="true"></span>`}${renderCheck(row)}${renderIcon(nodeIcon, 'sf-tree-node-icon')}${row.href && !row.disabled
        ? html`<a class=${nameClasses} href=${row.href} target=${row.target || nothing} rel=${row.rel || nothing} tabindex="-1" @click=${row.onName}>${renderName(row)}</a>`
        : html`<span class=${nameClasses} @click=${row.onName}>${renderName(row)}</span>`}${renderNote(row)}${renderTip(row)}</div>${children}</div>`;
}
