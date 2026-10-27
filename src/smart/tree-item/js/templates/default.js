import { html, nothing } from 'lit';
import { renderTreeRow } from './row.js';

export { renderIcon } from './row.js';

// A standalone sf-tree-item: its own row (the row sf-tree draws every entry
// with), then, open, its children as sf-tree-item elements in a group. Inside
// an sf-tree the item is only read: the tree draws the rows itself.
function renderTreeItemData(item = {}) {
  return html`
    <sf-tree-item
      label=${item.label || nothing}
      href=${item.href || nothing}
      target=${item.target || nothing}
      rel=${item.rel || nothing}
      kind=${item.type || item.kind || nothing}
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
  const canToggle = !context.isFile && context.hasChildren;
  const group = context.open && canToggle
    ? html`<div class="sf-tree-group flex flex-col" role="group">${(context.children || []).map((item) => renderTreeItemData(item))}</div>`
    : nothing;
  return renderTreeRow({
    value: context.value,
    label: context.label,
    content: context.content,
    href: context.href,
    target: context.target,
    rel: context.rel,
    kind: context.kind,
    open: context.open,
    selected: context.selected,
    active: context.active,
    disabled: context.disabled,
    icon: context.icon,
    openIcon: context.openIcon,
    closedIcon: context.closedIcon,
    chevronOpenIcon: context.chevronOpenIcon,
    chevronClosedIcon: context.chevronClosedIcon,
    openLabel: context.openLabel,
    closeLabel: context.closeLabel,
    hasChildren: context.hasChildren,
    rootClass: context.rootClass,
    rootStyle: context.rootStyle,
    itemClass: context.itemClass,
    containerClass: context.containerClass,
    nameClass: context.nameClass,
    onToggle: context.onToggle,
    onName: context.onItemClick,
  }, group);
}
