import {html, nothing} from 'lit';
import {unsafeStatic, html as staticHtml} from 'lit/static-html.js';

// The featured icon, title role and button a step up from the component's
// size: a state in a panel (1/2) is a size-1 icon, a page (2) a size-3 one.
const ICON_SIZE = {'1/2': '1', 1: '2', 2: '3'};
const BUTTON_SIZE = {'1/2': '1/2', 1: '1', 2: '1'};

export function renderEmptyStateTemplate(context) {
  const tag = unsafeStatic(`h${context.headingLevel}`);
  const size = String(context.size).replace('/', '-');
  const actions = context.resolvedActions ?? [];
  const slotted = context.component?.hasSlotContent?.('actions') ? context.component.getSlotContent('actions') : nothing;
  return html`
    <div class=${['sf-empty-state', `sf-empty-state--size-${size}`, `sf-empty-state--${context.kind}`, context.rootClass].filter(Boolean).join(' ')}
         role=${context.announces ? 'status' : nothing}>
      <span class=${`sf-featured-icon sf-featured-icon--size-${ICON_SIZE[context.size] ?? '2'} sf-featured-icon--${context.tone} sf-featured-icon--soft sf-empty-state-icon`}
            aria-hidden="true"><i class="sf-icon">${context.shownIcon}</i></span>
      ${staticHtml`<${tag} class="sf-empty-state-title">${context.shownTitle}</${tag}>`}
      ${context.shownText ? html`<p class="sf-empty-state-text">${context.shownText}</p>` : nothing}
      ${actions.length || slotted !== nothing
        ? html`<div class="sf-empty-state-actions">
            ${slotted}
            ${actions.map((action) => html`<sf-button size=${BUTTON_SIZE[context.size] ?? '1'} appearance=${action.appearance ?? 'default'}
                scheme=${action.scheme ?? (action.appearance === 'outline' ? 'on-surface' : 'primary')}
                text=${action.text ?? ''} data-action=${String(action.id)}
                @click=${() => context.component.act(action.id)}></sf-button>`)}
          </div>`
        : nothing}
    </div>
  `;
}
