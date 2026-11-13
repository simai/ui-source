import { html, nothing } from 'lit';
import { createFieldContract } from '../../../../component/field-contract';

// A flag of the list is the browser's own lazy image: the address is written
// with the row, and the browser fetches it when the row comes near the view (a
// closed list fetches nothing). The class script used to set the address only
// when a press opened the list, so a list drawn open (open) kept empty images
// (docs pre-check 2026-11-10 CC-02). eager-flags asks for every flag at once.
// A file that does not come draws the country's emoji in its place, as the
// field's own flag does.
function flagFallback(event) {
  const img = event.currentTarget;
  const holder = img?.parentElement;
  if (holder && img.dataset.flagFallback) holder.textContent = img.dataset.flagFallback;
}

function flagTemplate(country, flagBase = '', lazy = true) {
  const iso2 = String(country?.iso2 || '').trim().toLowerCase();
  const fallback = country?.flagEmoji || '';
  const src = iso2 && flagBase ? `${flagBase}/${iso2}.svg` : '';

  if (!src) {
    return html`${fallback}`;
  }

  return html`
    <img
      alt=${country?.iso2 ? `${country.iso2} flag` : 'flag'}
      decoding="async"
      loading=${lazy ? 'lazy' : 'eager'}
      src=${src}
      data-flag-src=${src}
      data-loaded="1"
      data-flag-fallback=${fallback}
      @error=${flagFallback}
    />
  `;
}

export function renderCountryCodeTemplate(context) {
  const {
    size,
    label,
    required,
    hint,
    value,
    placeholder,
    disabled,
    open,
    countries,
    locale,
    multiCountry,
    showCode,
    maskStyle,
    useMask,
    useCountryMasks,
    iso2,
    dialCode,
    maskPattern,
    flagBase,
    lazyFlags,
    showMaskPlaceholder,
    maskPlaceholderChar,
    maxItems,
    ariaLabel,
  } = context;

  // The line under the field is sf-input's (fields ladder, 2026-11-14): the
  // help, or the error in its place while the field is invalid and says why.
  const field = createFieldContract(context.component, {
    prefix: 'sf-input-country',
    invalid: context.invalid,
    hint,
    errorMessage: context.errorMessage,
  });
  const messageIsError = Boolean(field.invalid && context.errorMessage);

  const rootClasses = ['sf-country-code', `sf-country-code--size-${size}`, 'flex', 'flex-col'];
  if (context.rootClass) rootClasses.push(context.rootClass);
  if (field.invalid) rootClasses.push('error');
  if (disabled) rootClasses.push('disabled');
  if (open) rootClasses.push('open');

  return html`
    <label
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-locale=${locale}
      data-use-mask=${String(useMask)}
      data-use-country-masks=${String(useCountryMasks)}
      data-show-code=${String(showCode)}
      data-mask-style=${maskStyle}
      data-multi-country=${String(multiCountry)}
      data-lazy-flags=${String(lazyFlags)}
      data-show-mask-placeholder=${String(showMaskPlaceholder)}
      data-mask-placeholder-char=${maskPlaceholderChar}
      data-iso2=${iso2 || ''}
      data-dial-code=${dialCode || ''}
      data-mask-pattern=${maskPattern || ''}
      data-flag-base=${flagBase || ''}
      data-max-items=${String(maxItems || 0)}
      data-preferred=${context.preferred === undefined ? nothing : context.preferred}
    >
      ${label
        // No label, no label row: a lone star over a control names nothing, and
        // the row left an empty line above every phone field in a panel that
        // draws the labels itself.
        ? html`
          <span class="sf-country-code-label flex">
            <span class="sf-country-code-text">${label}</span>
            ${required ? html`<span class="sf-country-code-required">*</span>` : ''}
          </span>`
        : ''}

      <span class="sf-country-code-field transition flex items-center">
        <span class="sf-country-code-left flex items-center">
          <div class="sf-country-code-flag-icon" aria-hidden="true"></div>
          ${multiCountry
            // The small caret after the flag says the flag opens the list
            // (owner C87, variant V4 with the caret).
            ? html`<i class="sf-icon sf-country-code-caret" aria-hidden="true">arrow_drop_down</i>`
            : ''}
        </span>
        <input
          type="tel"
          name=${context.controlName || nothing}
          form=${context.controlForm || nothing}
          ?required=${required}
          .defaultValue=${value}
          .value=${value}
          placeholder=${placeholder}
          ?disabled=${disabled}
          aria-label=${!label && ariaLabel ? ariaLabel : nothing}
          aria-invalid=${field.invalid ? 'true' : nothing}
          aria-errormessage=${messageIsError ? field.messageId : nothing}
        />
      </span>

      ${multiCountry
        ? html`
            <span class="sf-country-code-list">
              <span class="sf-country-code-items flex flex-col">
                ${countries.map(
                  (country) => html`
                    <span
                      class="sf-country-code-item flex items-center transition"
                      data-iso2=${country.iso2 || ''}
                      data-code=${country.dialCode || country.code || ''}
                      data-mask-pattern=${country.maskPattern || ''}
                    >
                      <div class="sf-country-code-flag" aria-hidden="true">
                        ${flagTemplate(country, flagBase, lazyFlags !== false)}
                      </div>
                      <span>
                        ${country.label ||
                        `${locale === 'en'
                          ? country.nameEn
                          : country.nameRu || country.nameEn} (${country.dialCode || country.code || ''})`}
                      </span>
                    </span>
                  `,
                )}
              </span>
            </span>
          `
        : ''}

      ${field.message
        ? html`<span class="sf-country-code-hint" id=${field.messageId}
                     data-field-message=${messageIsError ? 'error' : 'hint'}>${field.message}</span>`
        : ''}
    </label>
  `;
}
