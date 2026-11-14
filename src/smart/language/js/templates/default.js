import {html, nothing} from 'lit';

// sf-language's markup: one of three looks, all of them parts the Framework
// already has, so the element has no sheet of its own.
//
// - none (one language or none): nothing at all.
// - menu and search (two and more in auto, owner decision C142): sf-button
//   with the «translate» glyph, the current language's code and the
//   expand_more glyph («RU ▾»), named «Язык: Русский», and sf-menu-context,
//   a popup menu of radio rows, each in its own language; search adds the
//   menu's own search field (remote: the element narrows the rows by word
//   starts) and the panel's constant width of decision C32 (width="panel":
//   20rem, 18rem compact). The code keeps one width whatever language is
//   chosen: every code of the list stands in the same grid cell, the others
//   hidden, so the label is as wide as the widest of them.
// - inline (mode="inline" only, for a settings page): sf-segmented on its
//   track, a radio group named by label, one segment per language labelled
//   with its own name (labels="code": its code, the name kept as the
//   segment's accessible name), each segment in its own language (lang).
//   The arrows move the focus, Enter or Space chooses (C142 (4), the
//   element's keydown).
// - field (mode="field", C142 (8)): sf-dropdown as a form field, its label
//   above it, its rows the languages' names, its search from searchFrom.
//
// Every menu is decision C32's panel width (width="panel": 20rem, 18rem
// compact; C142 (3)): a row holds the name and, beside it, the name in the
// page's language, longer in Russian («французский»). From searchFrom
// languages on a phone it opens as sf-menu-context's sheet (C142 (5)).
//
// The parts' events stay inside the element (stopPropagation): the page hears
// sf-language's change, never a segment's or a menu row's.

const stop = (event) => event.stopPropagation();

function renderInline(context) {
  const items = context.list.map((language) => ({
    value: language.code,
    label: context.codes ? language.short : language.label,
    ariaLabel: context.codes ? language.label : '',
    lang: language.code,
  }));
  return html`<sf-segmented
      class=${['sf-language', context.rootClass].filter(Boolean).join(' ')}
      appearance="track"
      size=${context.size}
      .items=${items}
      value=${context.value}
      aria-label=${context.label}
      ?disabled=${context.disabled}
      @change=${(event) => context.component.onGroupChange(event)}
      @sf-button-group-change=${stop}
    ></sf-segmented>`;
}

// The trigger's label: the current code, with every other code of the list
// in the same grid cell and hidden, so the button keeps the width of the
// widest code whatever is chosen (C142: the width does not change with the
// language). The hidden codes are out of the accessibility tree; the
// button's name is its aria-label.
function renderCode(context) {
  const shown = context.current?.short ?? '';
  return html`<span slot="text" class="sf-language-code" style="display: inline-grid">${context.list.map((language) => {
    const own = language.short === shown;
    return html`<span
        style=${own ? 'grid-area: 1 / 1' : 'grid-area: 1 / 1; visibility: hidden'}
        aria-hidden=${own ? nothing : 'true'}
      >${language.short}</span>`;
  })}</span>`;
}

function renderMenu(context) {
  return html`<sf-button
      class=${['sf-language', context.rootClass].filter(Boolean).join(' ')}
      icon-start="translate"
      icon-end="expand_more"
      appearance="ghost"
      scheme="on-surface"
      size=${context.size}
      aria-label=${context.triggerLabel}
      title=${context.triggerLabel}
      aria-haspopup="menu"
      ?disabled=${context.disabled}
      @click=${() => context.component.toggleMenu()}
    >${renderCode(context)}</sf-button>
    <sf-menu-context
      popup
      size=${context.menuSize}
      width="panel"
      aria-label=${context.label}
      .entries=${context.entries}
      @sf-menu-context-select=${(event) => context.component.onMenuSelect(event)}
      @sf-context-menu-select=${stop}
      @sf-menu-context-search=${(event) => context.component.onMenuSearch(event)}
      @sf-context-menu-search=${stop}
      @sf-menu-context-closed=${(event) => context.component.onMenuClosed(event)}
      @sf-context-menu-closed=${stop}
    ></sf-menu-context>`;
}

// The parts stand in a frame without a box of its own (display: contents), so
// they lay out in the host's place. The frame is what the first paint prints
// as static markup: the switch and the trigger inside it wait for this
// element and take their printed picture from it, rather than drawing alone
// before it (the switch without its languages, the trigger without its glyph).
const frame = (parts) => html`<div class="sf-language-parts" style="display: contents">${parts}</div>`;

function renderField(context) {
  return html`<sf-dropdown
      class=${['sf-language', context.rootClass].filter(Boolean).join(' ')}
      mode="select"
      appearance="outlined"
      size=${context.fieldSize}
      label=${context.label}
      .options=${context.fieldOptions}
      value=${context.value}
      .search=${context.fieldSearch}
      search-placeholder=${context.fieldSearch ? context.component.sfWord('search') : nothing}
      ?disabled=${context.disabled}
      @change=${(event) => context.component.onFieldChange(event)}
      @sf-dropdown-change=${stop}
      @input=${stop}
    ></sf-dropdown>`;
}

export function renderLanguageTemplate(context) {
  if (context.look === 'inline') return frame(renderInline(context));
  if (context.look === 'field') return frame(renderField(context));
  if (context.look === 'menu' || context.look === 'search') return frame(renderMenu(context));
  return nothing;
}
