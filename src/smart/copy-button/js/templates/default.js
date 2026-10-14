import {html, nothing} from 'lit';

export function renderCopyButtonTemplate(context) {
  const icon = {success: context.successIcon, error: 'error'}[context.phase] ?? context.icon;
  const common = {
    size: context.size, appearance: context.appearance,
    scheme: context.phase === 'error' ? 'on-surface' : 'on-surface',
  };
  // The root style is the control's: the wrapper only frames the control and
  // its status, so a host styling the button reaches it.
  return html`
    <span class=${['sf-copy-button', `sf-copy-button--${context.phase}`, context.rootClass].filter(Boolean).join(' ')}>
      ${context.text
        ? html`<sf-button size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon-start=${icon} text=${context.text} aria-label=${context.name}
                 root-style=${context.rootStyle || nothing}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-button>`
        : html`<sf-icon-button size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon=${icon} aria-label=${context.name} title=${context.name}
                 root-style=${context.rootStyle || nothing}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-icon-button>`}
      <span class="sf-copy-button-status" role="status" aria-live="polite" aria-atomic="true">${context.message}</span>
    </span>
  `;
}
