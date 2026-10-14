import {html, nothing} from 'lit';

const ICONS = {success: 'check', error: 'error'};

export function renderCopyButtonTemplate(context) {
  const icon = ICONS[context.phase] ?? 'content_copy';
  const common = {
    size: context.size, appearance: context.appearance,
    scheme: context.phase === 'error' ? 'on-surface' : 'on-surface',
  };
  return html`
    <span class=${['sf-copy-button', `sf-copy-button--${context.phase}`, context.rootClass].filter(Boolean).join(' ')}>
      ${context.text
        ? html`<sf-button size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon-start=${icon} text=${context.text} aria-label=${context.name}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-button>`
        : html`<sf-icon-button size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon=${icon} aria-label=${context.name} title=${context.name}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-icon-button>`}
      <span class="sf-copy-button-status" role="status" aria-live="polite" aria-atomic="true">${context.message}</span>
    </span>
  `;
}
