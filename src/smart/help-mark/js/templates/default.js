import {html, nothing} from 'lit';

export function renderHelpMarkTemplate(context) {
  const panelId = `${context.id}-panel`;
  return html`
    <span class=${['sf-help-mark', context.rootClass].filter(Boolean).join(' ')}>
      <sf-icon-button class="sf-help-mark-button" size=${context.size} appearance="link" scheme="on-surface"
                      icon="help" aria-label=${context.name}
                      aria-expanded=${String(Boolean(context.open))} aria-controls=${panelId}
                      @click=${() => context.component.toggle()}></sf-icon-button>
      <div class="sf-help-mark-panel" id=${panelId} ?hidden=${!context.open}>
        ${context.heading ? html`<div class="sf-help-mark-title">${context.heading}</div>` : nothing}
        <div class="sf-help-mark-body">${context.body ?? context.text}</div>
      </div>
      <span class="sf-help-mark-live" role="status" aria-live="polite" aria-atomic="true">${context.announcement}</span>
    </span>
  `;
}
