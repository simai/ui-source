import {html, nothing} from 'lit';

// sf-display-settings' markup (scss/ draws it; prototype
// accessibility-panel-study, panel B).
//
// - disclosure: an outline sf-button (the eye glyph and the label) with
//   aria-expanded and aria-controls, and the panel under it, hidden while
//   closed; the button folds to its glyph when its words do not fit;
// - panel: the panel alone.
// The panel is a group named by the label; each setting a group named by its
// word, its choices outline sf-buttons with aria-pressed (C12 pressed look on
// the chosen one). The text steps are «А−» and «А+», named in words, the size
// in a polite live region. A group the device decides (forced-colors) is
// disabled and says so.

const BUTTON = {size: '1/2', appearance: 'outline', scheme: 'on-surface'};

// The trigger's glyph (DSA-3): the eye a reader looks for beside «Версия для
// слабовидящих», and what the trigger folds to when its words do not fit
// (sf-button shrink="icon", C370; index.js fitTrigger).
const TRIGGER_ICON = 'visibility';

function choice(context, group, option) {
  return html`<sf-button class="sf-display-settings__choice" size=${BUTTON.size} appearance=${BUTTON.appearance}
    scheme=${BUTTON.scheme} text=${option.text} pressed=${option.pressed ? 'true' : 'false'}
    ?disabled=${group.disabled} data-setting=${group.id} data-value=${option.value}
    @click=${() => context.component.choose(group.id, option.value)}></sf-button>`;
}

function textGroup(context, group) {
  return html`<div class="sf-display-settings__group" role="group" aria-labelledby=${group.labelId}>
    <span class="sf-display-settings__label" id=${group.labelId}>${group.label}</span>
    <sf-button class="sf-display-settings__step" size=${BUTTON.size} appearance=${BUTTON.appearance} scheme=${BUTTON.scheme}
      text=${group.smaller.mark} aria-label=${group.smaller.text} data-setting="textScale" data-value="-1"
      @click=${() => context.component.stepText(-1)}></sf-button>
    <span class="sf-display-settings__value" aria-live="polite">${group.value}</span>
    <sf-button class="sf-display-settings__step" size=${BUTTON.size} appearance=${BUTTON.appearance} scheme=${BUTTON.scheme}
      text=${group.larger.mark} aria-label=${group.larger.text} data-setting="textScale" data-value="1"
      @click=${() => context.component.stepText(1)}></sf-button>
  </div>`;
}

function choiceGroup(context, group) {
  return html`<div class="sf-display-settings__group" role="group" aria-labelledby=${group.labelId}
    aria-describedby=${group.note ? group.noteId : nothing} data-group=${group.id}>
    <span class="sf-display-settings__label" id=${group.labelId}>${group.label}</span>
    ${group.options.map((option) => choice(context, group, option))}
    ${group.note ? html`<span class="sf-display-settings__note" id=${group.noteId}>${group.note}</span>` : nothing}
  </div>`;
}

function panel(context) {
  const {words, component} = context;
  return html`<div class="sf-display-settings__panel" id=${context.panelId} role="group" aria-label=${context.label}
    ?hidden=${!context.shown}>
    ${context.groups.map((group) => (group.id === 'textScale' ? textGroup(context, group) : choiceGroup(context, group)))}
    <div class="sf-display-settings__group sf-display-settings__group--reset">
      <sf-button class="sf-display-settings__reset" size=${BUTTON.size} appearance="ghost" scheme=${BUTTON.scheme}
        text=${words.reset} @click=${() => component.reset()}></sf-button>
    </div>
  </div>`;
}

export function renderDisplaySettingsTemplate(context) {
  const classes = ['sf-display-settings', `sf-display-settings--${context.layout}`, context.rootClass].filter(Boolean).join(' ');
  if (context.layout === 'panel') return html`<div class=${classes}>${panel(context)}</div>`;
  return html`<div class=${classes}>
    <sf-button class="sf-display-settings__trigger" size=${BUTTON.size} appearance=${BUTTON.appearance} scheme=${BUTTON.scheme}
      icon-start=${TRIGGER_ICON} shrink="icon"
      text=${context.label} expanded=${context.shown ? 'true' : 'false'} aria-controls=${context.panelId}
      @click=${() => context.component.toggle()}></sf-button>
    ${panel(context)}
  </div>`;
}
