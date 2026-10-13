import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function renderIcon(name) {
  if (!name) return nothing;

  return html`
    <sf-icon icon="${name}" aria-hidden="true"></sf-icon>
  `;
}

function renderItemContent(item, context) {
  const slotName = `item-${item.index}`;
  const slotContent = context.component?.hasSlotContent?.(slotName)
    ? context.component.getSlotContent(slotName)
    : nothing;

  if (slotContent !== nothing) {
    return slotContent;
  }

  return html`
    ${renderIcon(item.icon)}
    ${item.label ? html`<span>${item.label}</span>` : nothing}
  `;
}

function renderItem(item, context) {
  const isInteractive = !item.current && !item.disabled;
  const tag = item.href && !item.disabled && !item.current ? 'a' : isInteractive ? 'button' : 'div';
  const itemClasses = joinClasses(
    'sf-breadcrumbs-item',
    item.current ? '' : 'sf-breadcrumbs-item--link',
    item.current || item.ellipsis ? 'sf-breadcrumbs-item--default' : '',
    item.active ? 'active' : '',
    item.disabled ? 'disabled' : '',
    context.itemClass,
    item.current ? context.currentClass : context.linkClass,
    item.itemClass,
  );
  const containerClasses = joinClasses(
    'sf-breadcrumbs-item-container flex items-cross-center',
    context.containerClass,
    item.containerClass,
  );
  const content = html`
    <span class=${containerClasses}>
      ${renderItemContent(item, context)}
    </span>
  `;
  const common = {
    className: itemClasses,
    ariaCurrent: item.current ? 'page' : nothing,
    ariaLabel: item.ariaLabel || nothing,
    dataIndex: String(item.index),
  };

  if (tag === 'a') {
    return html`
      <a
        href=${item.href}
        class=${common.className}
        target=${item.target || nothing}
        rel=${item.rel || nothing}
        aria-current=${common.ariaCurrent}
        aria-label=${common.ariaLabel}
        data-sf-breadcrumb-index=${common.dataIndex}
        @click=${(event) => context.component?.handleItemClick?.(event, item)}
      >
        ${content}
      </a>
    `;
  }

  if (tag === 'button') {
    return html`
      <button
        type="button"
        class=${common.className}
        ?disabled=${item.disabled}
        aria-current=${common.ariaCurrent}
        aria-label=${common.ariaLabel}
        data-sf-breadcrumb-index=${common.dataIndex}
        @click=${(event) => context.component?.handleItemClick?.(event, item)}
      >
        ${content}
      </button>
    `;
  }

  return html`
    <div
      class=${common.className}
      aria-current=${common.ariaCurrent}
      aria-label=${common.ariaLabel}
      data-sf-breadcrumb-index=${common.dataIndex}
      @click=${(event) => context.component?.handleItemClick?.(event, item)}
    >
      ${content}
    </div>
  `;
}

function renderSeparator(context, index) {
  const slotName = `separator-${index}`;
  const slotContent = context.component?.hasSlotContent?.(slotName)
    ? context.component.getSlotContent(slotName)
    : nothing;

  return html`
    <div
      class=${joinClasses(
        'sf-breadcrumbs-item sf-breadcrumbs-item--default',
        'sf-breadcrumbs-item--separator',
        context.separatorClass,
      )}
      aria-hidden="true"
      data-sf-breadcrumb-separator=${String(index)}
    >
      <span class="sf-breadcrumbs-item-container flex items-cross-center">
        ${slotContent !== nothing ? slotContent : renderIcon(context.separatorIcon)}
      </span>
    </div>
  `;
}

export function renderBreadcrumbsTemplate(context) {
  const rootClasses = joinClasses(
    'sf-breadcrumbs flex items-cross-center',
    context.rootClass,
  );

  return html`
    <nav class=${rootClasses} style=${context.rootStyle || nothing} aria-label=${context.ariaLabel || 'Breadcrumb'}>
      ${context.items.map((item, index) => html`
        ${index > 0 ? renderSeparator(context, index - 1) : nothing}
        ${renderItem(item, context)}
      `)}
    </nav>
  `;
}
