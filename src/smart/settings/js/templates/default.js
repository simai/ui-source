import {html, nothing} from 'lit';

// sf-settings' markup: sf-menu-context with the items as its entries, and,
// in a popup, the page's trigger beside it. The element draws nothing of its
// own, so it has no sheet.
//
// - inline (no trigger): the menu stands open in the page's flow;
// - popup (a trigger in the trigger slot, or one named by for): the trigger as
//   the page wrote it, and the menu hidden until the trigger opens it.
//
// The panel's width is fixed for every look (280 px, the drilling menu's own
// width, --sf-context-menu-inline-size): it is given to the menu as its
// lower and upper bound, so a long name wraps and a value ends in an ellipsis
// rather than the panel growing.
//
// The menu's value events stay inside (stopPropagation): the page hears
// sf-settings-change, -changed and -reset, never the menu's.

const stop = (event) => event.stopPropagation();

const WIDTH = 'var(--sf-context-menu-inline-size, calc(var(--sf-f7) + var(--sf-a8)))';
const PANEL = `--sf-context-menu--min-inline-size: ${WIDTH}; --sf-context-menu--max-inline-size: ${WIDTH}`;

function renderMenu(context) {
  const {component} = context;
  return html`<sf-menu-context
      class=${['sf-settings', context.rootClass].filter(Boolean).join(' ')}
      ?popup=${context.popup}
      submenu=${context.look === 'drill' ? 'drill' : 'flyout'}
      size=${context.size}
      aria-label=${context.label}
      style=${PANEL}
      .entries=${context.entries}
      @sf-menu-context-change=${(event) => component.onMenuChange(event)}
      @sf-menu-context-changed=${(event) => component.onMenuChanged(event)}
      @sf-menu-context-select=${stop}
      @sf-menu-context-reset=${stop}
      @sf-context-menu-change=${stop}
      @sf-context-menu-changed=${stop}
      @sf-context-menu-select=${stop}
      @sf-context-menu-reset=${stop}
    ></sf-menu-context>`;
}

// The parts stand in a frame without a box of its own (display: contents), so
// they lay out in the host's place. The frame is what the first paint prints
// as static markup: the menu inside it waits for this element and takes its
// printed picture from it, rather than drawing alone, empty, before it.
const frame = (parts) => html`<div class="sf-settings-parts" style="display: contents">${parts}</div>`;

export function renderSettingsTemplate(context) {
  const trigger = context.popup && context.hasSlot('trigger') ? context.slot('trigger') : nothing;
  return frame(html`${trigger}${renderMenu(context)}`);
}
