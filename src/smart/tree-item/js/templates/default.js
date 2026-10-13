import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// Regular, not filled. A filled glyph was how a tree's icons carried their
// weight while they were painted at a quarter strength; at full strength the
// fill is a solid block beside a regular name, which is heavier than anything
// else in the row (owner, 2026-10-08).
function renderIcon(icon, className = '') {
  if (!icon) return nothing;

  return html`
    <sf-icon icon=${icon} class=${className || nothing}></sf-icon>
  `;
}

function renderLabel(context) {
  if (context.label) {
    return html`<span>${context.label}</span>`;
  }

  return context.content !== nothing ? context.content : nothing;
}

function renderTreeItemData(item = {}) {
  return html`
    <sf-tree-item
      label=${item.label || nothing}
      href=${item.href || nothing}
      target=${item.target || nothing}
      rel=${item.rel || nothing}
      kind=${item.type || nothing}
      value=${item.value || nothing}
      open-icon=${item.openIcon || nothing}
      closed-icon=${item.closedIcon || nothing}
      chevron-open-icon=${item.chevronOpenIcon || nothing}
      chevron-closed-icon=${item.chevronClosedIcon || nothing}
      open-label=${item.openLabel || nothing}
      close-label=${item.closeLabel || nothing}
      icon=${item.icon === false ? 'false' : nothing}
      ?open=${Boolean(item.open)}
      ?selected=${Boolean(item.selected)}
      ?active=${Boolean(item.active)}
      ?disabled=${Boolean(item.disabled)}
      .itemsData=${item.children || []}
    ></sf-tree-item>
  `;
}

export function renderTreeItemTemplate(context) {
  const itemClasses = joinClasses(
    'sf-tree-item flex flex-col',
    context.type ? `sf-tree-item--${context.kind ?? context.type}` : '',
    context.open ? 'open' : '',
    context.hasChildren ? 'has-children' : '',
    context.selected || context.active ? 'active' : '',
    context.disabled ? 'disabled' : '',
    context.rootClass,
    context.itemClass,
  );
  const containerClasses = joinClasses(
    'sf-tree-item-container flex items-cross-center relative',
    context.containerClass,
  );
  const nameClasses = joinClasses('sf-tree-item-name', context.nameClass);
  const nodeIcon = context.open ? context.openIcon : context.closedIcon;
  const chevronIcon = context.open
    ? context.chevronOpenIcon
    : context.chevronClosedIcon;
  const canToggle = !context.isFile && context.hasChildren;

  return html`
    <div
      class=${itemClasses}
      style=${context.rootStyle || nothing}
      role="treeitem"
      tabindex="-1"
      aria-expanded=${canToggle ? String(context.open) : nothing}
      aria-selected=${String(Boolean(context.selected))}
      aria-current=${context.active ? 'page' : nothing}
      aria-disabled=${context.disabled ? 'true' : nothing}
      data-open-icon=${context.openIcon || nothing}
      data-closed-icon=${context.closedIcon || nothing}
      data-value=${context.value || nothing}
    >
      <div class=${containerClasses}>
        ${canToggle
          ? html`
              <button
                type="button"
                tabindex="-1"
                class="sf-icon-button sf-tree-toggle"
                ?disabled=${context.disabled}
                aria-expanded=${String(context.open)}
                aria-label=${context.open
                  ? context.closeLabel
                  : context.openLabel}
                @click=${context.onToggle}
              >
                ${renderIcon(chevronIcon, 'sf-tree-chevron')}
              </button>
            `
          : html`<span class="sf-tree-toggle-spacer" aria-hidden="true"></span>`}
        ${context.icon
          ? context.isFile
            ? renderIcon('draft', 'sf-tree-node-icon')
            : renderIcon(nodeIcon, 'sf-tree-node-icon')
          : nothing}

        ${context.href && !context.disabled
          ? html`
              <a
                class=${nameClasses}
                href=${context.href}
                target=${context.target || nothing}
                rel=${context.rel || nothing}
                tabindex="-1"
                @click=${context.onItemClick}
              >
                ${renderLabel(context)}
              </a>
            `
          : html`
              <span class=${nameClasses} @click=${context.onItemClick}>
                ${renderLabel(context)}
              </span>
            `}
      </div>

      ${context.open && canToggle
        ? html`
            <div class="sf-tree-group flex flex-col" role="group">
              ${(context.children || []).map((item) =>
                renderTreeItemData(item),
              )}
            </div>
          `
        : nothing}
    </div>
  `;
}
