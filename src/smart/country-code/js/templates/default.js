import { html, nothing } from 'lit';

function flagTemplate(country, flagBase = '') {
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
      loading="lazy"
      data-flag-src=${src}
      data-flag-fallback=${fallback}
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
  } = context;

  const rootClasses = ['sf-country-code', `sf-country-code--size-${size}`, 'flex', 'flex-col'];
  if (context.rootClass) rootClasses.push(context.rootClass);
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
    >
      <span class="sf-country-code-label flex">
        <span class="sf-country-code-text">${label}</span>
        ${required ? html`<span class="sf-country-code-required">*</span>` : ''}
      </span>

      <span class="sf-country-code-field transition flex items-center">
        <span class="sf-country-code-left flex items-center">
          <div class="sf-country-code-flag-icon" aria-hidden="true"></div>
          ${multiCountry
            ? html`<i class="sf-icon">${open ? 'expand_less' : 'expand_more'}</i>`
            : ''}
        </span>
        <input
          type="tel"
          name=${context.name || nothing}
          form=${context.form || nothing}
          ?required=${required}
          .defaultValue=${value}
          .value=${value}
          placeholder=${placeholder}
          ?disabled=${disabled}
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
                        ${flagTemplate(country, flagBase)}
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

      ${hint ? html`<span class="sf-country-code-hint">${hint}</span>` : ''}
    </label>
  `;
}
