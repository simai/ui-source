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

// A crumb is a link when it has an address, a button when the page handles it
// (a value, as a folder picker's crumbs that drive its window, or «…»), and
// text otherwise (R177 BC-05): a crumb without either was a focusable button
// that did nothing.
function crumbTag(item) {
  if (item.current || item.disabled) return 'div';
  if (item.href) return 'a';
  if (item.ellipsis || item.value) return 'button';
  return 'div';
}

function renderItem(item, context) {
  const tag = crumbTag(item);
  const itemClasses = joinClasses(
    'sf-breadcrumbs-item',
    item.current || (tag === 'div' && !item.disabled) ? '' : 'sf-breadcrumbs-item--link',
    tag === 'div' || item.ellipsis ? 'sf-breadcrumbs-item--default' : '',
    item.active ? 'active' : '',
    item.disabled ? 'disabled' : '',
    context.itemClass,
    item.current ? context.currentClass : context.linkClass,
    item.itemClass,
  );
  const containerClasses = joinClasses(
    'sf-breadcrumbs-item-container',
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
        aria-haspopup=${item.ellipsis ? 'menu' : nothing}
        aria-expanded=${item.ellipsis ? 'false' : nothing}
        data-sf-breadcrumb-index=${common.dataIndex}
        @click=${(event) => context.component?.handleItemClick?.(event, item)}
      >
        ${content}
      </button>
    `;
  }

  // A disabled item is plain text that says so (docs precheck BC-01): it was
  // a div without aria-disabled, drawn in the link colour.
  return html`
    <div
      class=${common.className}
      aria-current=${common.ariaCurrent}
      aria-disabled=${item.disabled ? 'true' : nothing}
      aria-label=${common.ariaLabel}
      data-sf-breadcrumb-index=${common.dataIndex}
      @click=${(event) => context.component?.handleItemClick?.(event, item)}
    >
      ${content}
    </div>
  `;
}

// The siblings of a crumb (owner decision C93 item 3, off unless the host
// says siblings): a button after the crumb opens them as a menu.
function renderSiblings(item, context) {
  if (!context.siblings || item.ellipsis || !item.siblings?.length) return nothing;

  return html`
    <button
      type="button"
      class="sf-breadcrumbs-item sf-breadcrumbs-item--link sf-breadcrumbs-item--default"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-label=${`${context.siblingsLabel}: ${item.label}`}
      data-sf-breadcrumb-siblings=${String(item.index)}
      @click=${(event) => context.component?.handleSiblingsClick?.(event, item)}
    >
      <span class="sf-breadcrumbs-item-container">${renderIcon('expand_more')}</span>
    </button>
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
      <span class="sf-breadcrumbs-item-container">
        ${slotContent !== nothing ? slotContent : renderIcon(context.separatorIcon)}
      </span>
    </div>
  `;
}

// The trail is a list (R177 BC-09): a reader says «list, N items» as it does
// for Fluent, USWDS, GOV.UK and Carbon. One entry per crumb, its separator
// before it. The sheet draws the row itself, with no utility class (BC-07).
// The name is the host's aria-label or the language file's word (BC-10: no
// English literal of its own).
export function renderBreadcrumbsTemplate(context) {
  const rootClasses = joinClasses('sf-breadcrumbs', context.rootClass);

  return html`
    <nav class=${rootClasses} style=${context.rootStyle || nothing} aria-label=${context.ariaLabel || nothing}>
      <ol>
        ${context.items.map((item, index) => html`
          <li>
            ${index > 0 ? renderSeparator(context, index - 1) : nothing}
            ${renderItem(item, context)}
            ${renderSiblings(item, context)}
          </li>
        `)}
      </ol>
    </nav>
    ${context.items.some((item) => item.ellipsis) ||
    (context.siblings && context.items.some((item) => item.siblings?.length))
      ? html`<sf-menu-context
          class="sf-breadcrumbs-menu"
          popup
          @sf-menu-context-select=${(event) => context.component?.handleMenuSelect?.(event)}
        ></sf-menu-context>`
      : nothing}
  `;
}
