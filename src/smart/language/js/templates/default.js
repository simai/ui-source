import {html, nothing} from 'lit';

// sf-language's markup: one of three looks, all of them parts the Framework
// already has, so the element has no sheet of its own.
//
// - none (one language or none): nothing at all.
// - inline (two or three): sf-button-group appearance="segmented", a radio
//   group named by label, one segment per language labelled with its own
//   name (compact: its code, the name kept as the segment's accessible
//   name), each segment in its own language (lang).
// - menu and search (four and more): sf-button-icon with the «translate»
//   glyph, named «Язык: Русский», and sf-menu-context, a popup menu of radio
//   rows, each in its own language; search adds the menu's own search field.
//
// The parts' events stay inside the element (stopPropagation): the page hears
// sf-language's change, never a segment's or a menu row's.

const stop = (event) => event.stopPropagation();

function renderInline(context) {
  const items = context.list.map((language) => ({
    value: language.code,
    label: context.compact ? language.short : language.label,
    ariaLabel: context.compact ? language.label : '',
    lang: language.code,
  }));
  return html`<sf-button-group
      class=${['sf-language', context.rootClass].filter(Boolean).join(' ')}
      appearance="segmented"
      size=${context.size}
      .items=${items}
      value=${context.value}
      aria-label=${context.label}
      ?disabled=${context.disabled}
      @change=${(event) => context.component.onGroupChange(event)}
      @sf-button-group-change=${stop}
    ></sf-button-group>`;
}

function renderMenu(context) {
  return html`<sf-button-icon
      class=${['sf-language', context.rootClass].filter(Boolean).join(' ')}
      icon="translate"
      appearance="link"
      scheme="on-surface"
      size=${context.size}
      aria-label=${context.triggerLabel}
      title=${context.triggerLabel}
      aria-haspopup="menu"
      ?disabled=${context.disabled}
      @click=${() => context.component.toggleMenu()}
    ></sf-button-icon>
    <sf-menu-context
      popup
      size=${context.menuSize}
      aria-label=${context.label}
      .entries=${context.entries}
      @sf-menu-context-select=${(event) => context.component.onMenuSelect(event)}
      @sf-context-menu-select=${stop}
    ></sf-menu-context>`;
}

// The parts stand in a frame without a box of its own (display: contents), so
// they lay out in the host's place. The frame is what the first paint prints
// as static markup: the switch and the trigger inside it wait for this
// element and take their printed picture from it, rather than drawing alone
// before it (the switch without its languages, the trigger without its glyph).
const frame = (parts) => html`<div class="sf-language-parts" style="display: contents">${parts}</div>`;

export function renderLanguageTemplate(context) {
  if (context.look === 'inline') return frame(renderInline(context));
  if (context.look === 'menu' || context.look === 'search') return frame(renderMenu(context));
  return nothing;
}
