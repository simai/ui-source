import { html, nothing } from 'lit';
import './default.css';
function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

export function renderTreeItemData(item = {}) {
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

export function renderTreeTemplate(context) {
  const rootClasses = joinClasses('sf-tree flex flex-col', context.rootClass);

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role=${context.role || 'tree'}
      data-sf-tree-flat=${context.hasBranches ? nothing : 'true'}
      aria-label=${context.ariaLabel || nothing}
      aria-multiselectable=${context.selection === 'multiple'
        ? 'true'
        : nothing}
    >
      ${(context.items || []).map((item) => renderTreeItemData(item))}
    </div>
  `;
}
