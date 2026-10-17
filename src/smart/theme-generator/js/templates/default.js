import {html, nothing} from 'lit';

// The choice above, the palettes below. The colour is sf-color: the
// platform's picker and the product's own swatches, unset while the
// Framework's colour applies. Hue and chroma, the generator's own inputs, are
// folded away: most people choose a colour and are done. The <details> is not
// bound to anything, so a redraw never folds it while somebody is typing.
export function renderThemeGeneratorTemplate(context) {
  const {component, size, text} = context;
  const field = (name, value, hint) => html`
    <sf-input class="sf-theme-generator-field" data-field=${name} size=${size}
              label=${text[name]} hint=${hint} value=${String(value)}
              inputmode="numeric" maxlength="3"
              @input=${(event) => component._fieldInput(name, event)}
              @change=${(event) => component._fieldChange(name, event)}
              @keydown=${(event) => component._fieldKey(name, event)}></sf-input>`;

  return html`
    <div class=${['sf-theme-generator', `sf-theme-generator--size-${size}`, context.rootClass].filter(Boolean).join(' ')}
         style=${context.rootStyle || nothing}>
      <div class="sf-theme-generator-choice">
        <div class="sf-theme-generator-color">
          <span class="sf-theme-generator-label" aria-hidden="true">${text.color}</span>
          <sf-color size=${size} label=${text.color}
                    value=${context.value || nothing}
                    inherited-value=${context.inheritedValue}
                    inherited-text=${text.inherited}
                    swatches=${context.swatches || nothing}
                    @input=${(event) => component._colorInput(event)}
                    @change=${(event) => component._colorChange(event)}></sf-color>
        </div>
        <sf-button class="sf-theme-generator-reset" size=${size} appearance="outline" scheme="on-surface"
                   icon-start="restart_alt" text=${text.reset}
                   @click=${() => component.reset()}></sf-button>
      </div>
      <details class="sf-theme-generator-advanced">
        <summary class="sf-theme-generator-summary">${text.advanced}</summary>
        <div class="sf-theme-generator-fields">
          ${field('hue', context.hue, text.hueHint)}
          ${field('chroma', context.chroma, text.chromaHint)}
        </div>
      </details>
      <section class="sf-theme-generator-preview" aria-label=${text.preview}>
        ${context.palettes.map((palette) => html`
          <div class="sf-theme-generator-row" data-palette=${palette.name}>
            <span class="sf-theme-generator-name">${palette.label}</span>
            <span class="sf-theme-generator-swatches">
              ${palette.swatches.map((swatch) => html`
                <span class="sf-theme-generator-swatch" role="img"
                      data-tone=${swatch.tone} data-hex=${swatch.hex}
                      title=${`${swatch.tone} · ${swatch.hex}`}
                      aria-label=${`${palette.label} ${swatch.tone}: ${swatch.hex}`}
                      style=${`--sf-theme-generator--swatch: ${swatch.hex}`}></span>`)}
            </span>
          </div>`)}
      </section>
    </div>
  `;
}
