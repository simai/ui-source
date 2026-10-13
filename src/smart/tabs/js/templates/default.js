import { html, nothing } from 'lit';
import './default.css';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function renderComponent(component, owner) {
  if (!component?.type) {
    return nothing;
  }

  return owner.renderSmartElement(component.type, component.props || {});
}

function renderPanel(item, context) {
  const panelContent = context.component?.hasSlotContent?.(item.slotName)
    ? context.component.getSlotContent(item.slotName)
    : nothing;
  const dataContent = item.panel?.component
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
      id=${`${context.tabsId}-panel-${item.index}`}
      aria-labelledby=${`${context.tabsId}-tab-${item.index}`}
      tabindex="0"
      data-sf-tab-panel=${String(item.index)}
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
              ${tabContent === nothing ? nothing : html`<span slot="text">${tabContent}</span>`}
          </sf-button>
      `;
  } else {
      return html`
          <sf-icon-button
                  appearance="primary"
                  size=${context.size}
                  scheme=${context.scheme}
                  icon=${item.icon || nothing}
                  data-tab-label=${item.label}
                  root-class=${joinClasses(item.selected ? 'selected' : '')}
                  data-sf-tab-index=${String(item.index)}
                  data-tab=${String(item.index)}
                  ?disabled=${item.disabled}
          >
          </sf-icon-button>
      `;
  }
}

export function renderTabsTemplate(context) {
  const vertical = context.type === 'vertical';
  const rootClasses = joinClasses(
    'sf-tabs',
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
      <div class="sf-tabs-top-container">
        <div
          class=${joinClasses(`sf-tabs-top flex content-main-${context.topPosition}`,  context.type === 'vertical' ? 'flex-col' : '', context.topClass)}
          role="tablist"
          aria-label=${context.component?.getAttribute('aria-label') || nothing}
          aria-labelledby=${context.component?.getAttribute('aria-labelledby') || nothing}
          aria-orientation=${vertical ? 'vertical' : 'horizontal'}
        >
          ${context.items.map((item) => renderTab(item, context))}
        </div>
      </div>

      <div class="sf-tabs-main-container">
        ${context.items.map((item) => renderPanel(item, context))}
      </div>
    </div>
  `;
}
