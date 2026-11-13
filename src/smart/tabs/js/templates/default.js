import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function renderComponent(component, owner) {
  if (!component?.type) {
    return nothing;
  }

  return owner.renderSmartElement(component.type, component.props || {});
}

// The page's own panel of an entry (§7.2.1, §7.2.3): the same live node, its
// ids and `hidden` written on it, never copied or wrapped.
function placePagePanel(panel, item, context) {
  panel.id ||= `${context.tabsId}--panel-${item.index}`;
  panel.setAttribute('aria-labelledby', `${context.tabsId}--tab-${item.index}`);
  // Its tabindex is the tabs' to decide after the drawing (syncPanelFocus):
  // 0 only when nothing in it takes the focus.
  panel.setAttribute('data-sf-tab-panel', String(item.index));
  panel.classList.add('sf-tabs-main-tab');
  panel.classList.toggle('selected', Boolean(item.selected));
  panel.hidden = !item.selected;
  return panel;
}

function renderPanel(item, context) {
  const pagePanel = context.pagePanel?.(item, item.index);
  if (pagePanel) return placePagePanel(pagePanel, item, context);
  // lazy: a panel never opened is drawn empty (its id stays, for the tab's
  // aria-controls) and filled when its tab is first opened.
  const drawn = context.panelDrawn ? context.panelDrawn(item) : true;
  const panelContent = drawn && context.component?.hasSlotContent?.(item.slotName)
    ? context.component.getSlotContent(item.slotName)
    : nothing;
  const dataContent = !drawn ? nothing : item.panel?.component
    ? renderComponent(item.panel.component, context.component)
    : typeof item.panel?.text !== 'undefined'
        ? item.panel.text
        : nothing;

  // Beside a strip of links a panel is the current page's content, not a
  // tabpanel: no tab names it.
  return html`
    <div
      class=${joinClasses(
        'sf-tabs-main-tab',
        item.selected ? 'selected' : '',
        context.panelClass,
      )}
      role=${context.links ? nothing : 'tabpanel'}
      id=${`${context.tabsId}--panel-${item.index}`}
      aria-labelledby=${context.links ? nothing : `${context.tabsId}--tab-${item.index}`}
      data-sf-tab-panel=${String(item.index)}
      data-entry=${item.key}
      slot=${context.panelSlot?.(item) || nothing}
      ?hidden=${!item.selected}
    >
      ${panelContent === nothing ? dataContent : panelContent}
    </div>
  `;
}

// A disabled tab stays focusable and says aria-disabled (R184 T9: a native
// disabled button could not be reached, so nobody learnt why it was off). It
// is not the native disabled: the tabs' sheet gives the class the disabled
// look, and a press on it selects nothing. A disabled link of a strip of
// links is sf-button's disabled link: no href, aria-disabled.
function tabClasses(item) {
  return joinClasses(item.selected ? 'selected' : '', item.disabled ? 'disabled' : '');
}

// The tooltip of a tab with a hint -- for a disabled tab, why it is off: the
// Framework's plain tooltip (component.tooltip), named by the tab's
// data-tooltip, which the tooltip makes the tab's description.
function hintId(item, context) {
  return `${context.tabsId}--hint-${item.index}`;
}

function renderHint(item, context) {
  return html`<span id=${hintId(item, context)} class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-tabs-hint"
      hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${item.hint}</span></span></span>`;
}

// The errors of a tab's panel, or of the tabs «Ещё» holds (owner decision C96
// item 6): a badge on the line of the label (rule C95 point 6), sf-badge
// line="text" in its class form (component.badges): drawn with the tab, so the
// row measures its width at once, and no element to wait for. Tonal: the
// error container, as the count stood before.
export function errorBadgeClasses(errors) {
  return joinClasses(
    'sf-badge sf-badge--tonal sf-badge--error sf-badge--size-1/3 sf-badge--line-text',
    [...String(errors)].length === 1 ? 'sf-badge--figure' : '',
    'inline-flex flex-row flex-nowrap justify-center items-center',
  );
}

function renderErrorBadge(errors, className) {
  return html`<span class=${`${errorBadgeClasses(errors)} ${className}`} aria-hidden="true"><span
      class="sf-badge-text-container flex items-center"><span class="sf-badge-text">${String(errors)}</span></span></span>`;
}

// An icon tab of a strip of links (R184 T4, C96 item 8): sf-button-icon has no
// address, so the link is drawn in the icon button's class form, an <a> with
// the same classes, size and line; named by the item's label, the current one
// aria-current="page". A disabled link has no href and says aria-disabled.
function renderIconLink(item, context) {
  const size = context.size || '1';
  return html`<a
      class=${joinClasses(
        'sf-icon-button', `sf-icon-button--size-${size}`, 'sf-icon-button--icon', 'sf-icon-button--default',
        `sf-icon-button--${context.scheme || 'primary'}`, 'flex', 'items-cross-center', tabClasses(item))}
      href=${item.disabled ? nothing : item.href}
      aria-label=${item.label}
      aria-current=${item.selected ? 'page' : nothing}
      aria-disabled=${item.disabled ? 'true' : nothing}
      data-sf-tab-index=${String(item.index)}
      data-tab=${String(item.index)}
      data-tab-label=${item.label}
      data-tooltip=${item.hint ? hintId(item, context) : nothing}
    ><sf-icon root-class="pointer-event-none" icon=${item.iconStart || item.icon || item.iconEnd || nothing}
      weight="400" aria-hidden="true"></sf-icon></a>`;
}

// data-tab (R193 DP-11) is a former name of data-sf-tab-index: written for
// one minor (1.2.x) so a page that read it keeps working, dropped in 1.3.0.
// Unprefixed, a page selector [data-tab] caught these buttons. Nothing in
// the component reads it.
function renderTab(item, context) {
  const tabContent = context.component?.hasSlotContent?.(item.tabSlotName)
    ? context.component.getSlotContent(item.tabSlotName)
    : nothing;
  if (item.component) {
    return html`
      <span
        data-sf-tab-index=${String(item.index)}
        data-tab=${String(item.index)}
        role="tab"
        aria-label=${item.label}
        aria-selected=${item.selected ? 'true' : 'false'}
        tabindex=${item.selected ? '0' : '-1'}
      >
        <span aria-hidden="true" inert>
          ${renderComponent({
            ...item.component,
            props: {
              ...(item.component.props || {}),
              rootClass: joinClasses(
                item.component.props?.rootClass || '',
                item.selected ? 'selected' : '',
              ),
              disabled: item.disabled || item.component.props?.disabled || false,
            },
          }, context.component)}
        </span>
      </span>
    `;
  }

  // The label, a count after it when the item has one, and the errors of its
  // panel (C96 item 6: the count on the error colours, said with the name --
  // «Доступ, 2 ошибки»); the tab's own slot wins. The name keeps the width
  // of its medium face, so selecting a tab, whose label alone is medium
  // (C96 item 3), moves nothing (sf-tabs-name, data-text).
  const hasCount = item.count !== null && item.count !== undefined && item.count !== '';
  const counted = tabContent === nothing
    ? html`<span slot="text" class="sf-tabs-label"><span class="sf-tabs-name" data-text=${item.label}>${item.label}</span>${hasCount
      ? html`<span class="sf-tabs-count">${String(item.count)}</span>` : nothing}${item.errors
      ? html`${renderErrorBadge(item.errors, 'sf-tabs-errors')}<span class="sf-tabs-said">, ${context.errorWords?.(item.errors) ?? item.errors}</span>`
      : nothing}</span>`
    : nothing;

  // A vertical tab's label starts at the start (owner decisions C96 item 5,
  // C99): sf-button centres its label unless told otherwise (text-center).
  const vertical = (context.look ?? context.type) === 'vertical';
  if(context.variant !== 'icons') {
      return html`
          <sf-button
                  appearance="primary"
                  size=${context.size}
                  scheme=${context.scheme}
                  text-position=${vertical ? 'start' : nothing}
                  href=${context.links ? item.href : nothing}
                  ?disabled=${Boolean(context.links && item.disabled)}
                  text=${item.label}
                  icon=${item.icon || nothing}
                  icon-start=${item.iconLeft || nothing}
                  icon-end=${item.iconRight || nothing}
                  root-class=${tabClasses(item)}
                  data-sf-tab-index=${String(item.index)}
                  data-tab=${String(item.index)}
                  data-tooltip=${item.hint ? hintId(item, context) : nothing}
          >
              ${tabContent === nothing ? counted : html`<span slot="text">${tabContent}</span>`}
          </sf-button>
      `;
  } else if (context.links) {
      return renderIconLink(item, context);
  } else {
      // An icon tab draws the item's icon however it was given: icon, or the
      // icon-start / icon-end of the "label::icon-start=home" form, which the
      // parser keeps as iconStart (R184 T3: the docs example drew the
      // button-icon default `add` on every tab).
      return html`
          <sf-button-icon
                  appearance="primary"
                  size=${context.size}
                  scheme=${context.scheme}
                  icon=${item.iconStart || item.icon || item.iconEnd || nothing}
                  data-tab-label=${item.label}
                  root-class=${tabClasses(item)}
                  data-sf-tab-index=${String(item.index)}
                  data-tab=${String(item.index)}
                  data-tooltip=${item.hint ? hintId(item, context) : nothing}
          >
          </sf-button-icon>
      `;
  }
}

function topClasses(context) {
  return joinClasses(`sf-tabs-top flex content-main-${context.topPosition}`, (context.look ?? context.type) === 'vertical' ? 'flex-col' : '', context.topClass);
}

function renderTabs(context) {
  return repeat(context.displayItems ?? context.items,
    // Keyed by the tab, so a reordered tab keeps its own button: by
    // position, the buttons kept their old labels and counts while the
    // hosts' text was already the new one (docs trial 4).
    (item) => item.key ?? item.index,
    (item) => renderTab(item, context));
}

// Every item an address (sf-tabs 1.3.0, owner decision C96 item 8): a <nav>
// of links with the same look, the current one aria-current="page"; no
// tablist, no arrows, no panels named by tabs.
function renderLinkRow(context) {
  return html`<nav
          class=${topClasses(context)}
          aria-label=${context.component?.getAttribute('aria-label') || nothing}
          aria-labelledby=${context.component?.getAttribute('aria-labelledby') || nothing}
        >
          ${renderTabs(context)}
        </nav>`;
}

// A strip of links draws its panel row only when a panel has content.
function hasPanelContent(context) {
  return context.items.some((item) => context.pagePanel?.(item, item.index)
    || context.component?.hasSlotContent?.(item.slotName)
    || item.panel?.component || typeof item.panel?.text !== 'undefined');
}

export function renderTabsTemplate(context) {
  // The look drawn (C96 item 1): line, plate (pills) or the menu column
  // (vertical); a custom template still reads context.type.
  const look = context.look ?? context.type;
  const vertical = look === 'vertical';
  const sizeClass = `sf-tabs--size-${String(context.size || '1').replace('/', '-')}`;
  const rootClasses = joinClasses(
    'sf-tabs',
    sizeClass,
    context.overflow && context.overflow !== 'scroll' ? `sf-tabs--overflow-${context.overflow}` : '',
    look ? `sf-tabs--${look}` : '',
    vertical ? 'sf-tabs--vertical flex' : 'flex flex-col',
    context.links ? 'sf-tabs--links' : '',
    context.sticky ? 'sf-tabs--sticky' : '',
    context.rootClass,
  );


  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      data-active-index=${String(context.activeIndex)}
      role="group"
    >
      <div class=${joinClasses('sf-tabs-top-container', context.overflow === 'more' || context.configurable ? 'sf-tabs-top-container--tools' : '')}>
        ${context.links ? renderLinkRow(context) : html`<div
          class=${topClasses(context)}
          role="tablist"
          aria-label=${context.component?.getAttribute('aria-label') || nothing}
          aria-labelledby=${context.component?.getAttribute('aria-labelledby') || nothing}
          aria-orientation=${vertical ? 'vertical' : 'horizontal'}
        >
          ${renderTabs(context)}
        </div>`}
        ${context.overflow === 'more' && !vertical
          ? html`<sf-button class="sf-tabs-more" appearance="ghost" scheme="on-surface" size=${context.size}
                            icon-end="expand_more" text=${context.moreText} aria-haspopup="menu"></sf-button>`
          : nothing}
        ${(context.displayItems ?? context.items).filter((item) => item.hint).map((item) => renderHint(item, context))}
        ${context.configurable
          ? html`<sf-button-icon class="sf-tabs-settings" appearance="ghost" scheme="on-surface" size=${context.size}
                                 icon="tune" aria-label=${context.customizeText} title=${context.customizeText}
                                 aria-haspopup="dialog"></sf-button-icon>`
          : nothing}
      </div>

      ${context.links && !hasPanelContent(context) ? nothing : html`<div class="sf-tabs-main-container">
        ${context.items.map((item) => renderPanel(item, context))}
      </div>`}
    </div>
  `;
}
