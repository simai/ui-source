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

  return html`
    <div
      class=${joinClasses(
        'sf-tabs-main-tab',
        item.selected ? 'selected' : '',
        context.panelClass,
      )}
      role="tabpanel"
      id=${`${context.tabsId}--panel-${item.index}`}
      aria-labelledby=${`${context.tabsId}--tab-${item.index}`}
      data-sf-tab-panel=${String(item.index)}
      data-entry=${item.key}
      slot=${context.panelSlot?.(item) || nothing}
      ?hidden=${!item.selected}
    >
      ${panelContent === nothing ? dataContent : panelContent}
    </div>
  `;
}

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

  // A count after the label, when the item has one; the tab's own slot wins.
  const counted = tabContent === nothing && item.count !== null && item.count !== undefined && item.count !== ''
    ? html`<span slot="text" class="sf-tabs-label">${item.label}<span class="sf-tabs-count">${String(item.count)}</span></span>`
    : nothing;

  if(context.variant !== 'icons') {
      return html`
          <sf-button
                  appearance="primary"
                  size=${context.size}
                  scheme=${context.scheme}
                  text=${item.label}
                  icon=${item.icon || nothing}
                  icon-start=${item.iconLeft || nothing}
                  icon-end=${item.iconRight || nothing}
                  root-class=${joinClasses(item.selected ? 'selected' : '')}
                  data-sf-tab-index=${String(item.index)}
                  data-tab=${String(item.index)}
                  ?disabled=${item.disabled}
          >
              ${tabContent === nothing ? counted : html`<span slot="text">${tabContent}</span>`}
          </sf-button>
      `;
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
                  root-class=${joinClasses(item.selected ? 'selected' : '')}
                  data-sf-tab-index=${String(item.index)}
                  data-tab=${String(item.index)}
                  ?disabled=${item.disabled}
          >
          </sf-button-icon>
      `;
  }
}

export function renderTabsTemplate(context) {
  const vertical = context.type === 'vertical';
  const sizeClass = `sf-tabs--size-${String(context.size || '1').replace('/', '-')}`;
  const rootClasses = joinClasses(
    'sf-tabs',
    sizeClass,
    context.overflow && context.overflow !== 'scroll' ? `sf-tabs--overflow-${context.overflow}` : '',
    context.type ? `sf-tabs--${context.type}` : '',
    vertical ? 'sf-tabs--vertical flex' : 'flex flex-col',
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
        <div
          class=${joinClasses(`sf-tabs-top flex content-main-${context.topPosition}`,  context.type === 'vertical' ? 'flex-col' : '', context.topClass)}
          role="tablist"
          aria-label=${context.component?.getAttribute('aria-label') || nothing}
          aria-labelledby=${context.component?.getAttribute('aria-labelledby') || nothing}
          aria-orientation=${vertical ? 'vertical' : 'horizontal'}
        >
          ${repeat(context.displayItems ?? context.items,
            // Keyed by the tab, so a reordered tab keeps its own button: by
            // position, the buttons kept their old labels and counts while the
            // hosts' text was already the new one (docs trial 4).
            (item) => item.key ?? item.index,
            (item) => renderTab(item, context))}
        </div>
        ${context.overflow === 'more' && !vertical
          ? html`<sf-button class="sf-tabs-more" appearance="ghost" scheme="on-surface" size=${context.size}
                            icon-end="expand_more" text=${context.moreText} aria-haspopup="menu"></sf-button>`
          : nothing}
        ${context.configurable
          ? html`<sf-button-icon class="sf-tabs-settings" appearance="ghost" scheme="on-surface" size=${context.size}
                                 icon="tune" aria-label=${context.customizeText} title=${context.customizeText}
                                 aria-haspopup="dialog"></sf-button-icon>`
          : nothing}
      </div>

      <div class="sf-tabs-main-container">
        ${context.items.map((item) => renderPanel(item, context))}
      </div>
    </div>
  `;
}
