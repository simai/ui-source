import {html, nothing} from 'lit';

// The plain tooltip of the Framework (component.tooltip, class markup): the
// inverse surface at the small text step. Two of them stand beside the
// control, inside one .sf-tooltip-anchor:
// - the name, on an icon-only button: the tooltip controller shows it on hover
//   and on keyboard focus, and hides it on a press and on Escape (it was the
//   browser's title: hover only, late, the browser's look);
// - the result, while a copy has failed: the words the status says ("Выделено
//   -- нажмите Ctrl+C") shown above the control for the result's duration, so a
//   sighted person reads them too. The status still says them; the surface is
//   aria-hidden so they are not heard twice. The component places it
//   (SF.Position) and shows it; no controller owns it.
function surface(className, text, {id, hidden, ariaHidden} = {}) {
  return html`<span id=${id || nothing} class=${`sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 ${className}`}
      aria-hidden=${ariaHidden ? 'true' : nothing} ?hidden=${hidden}><span class="sf-tooltip-content"><span class="sf-tooltip-text">${text}</span></span></span>`;
}

export function renderCopyButtonTemplate(context) {
  const icon = {success: context.successIcon, error: 'error'}[context.phase] ?? context.icon;
  // The glyph is the quiet neutral (decision C15): on-surface-variant, which
  // darkens under the pointer. ghost is the look without a fill; link, its
  // former name, reaches here as ghost (the alias shim rewrites it).
  const common = {
    size: context.size,
    appearance: context.appearance === 'link' ? 'ghost' : context.appearance,
    scheme: 'on-surface-variant',
  };
  const showResult = context.phase === 'error' && Boolean(context.message);
  // The root style is the control's: the wrapper only frames the control and
  // its status, so a host styling the button reaches it.
  return html`
    <span class=${['sf-copy-button', 'sf-tooltip-anchor', `sf-copy-button--${context.phase}`, context.rootClass].filter(Boolean).join(' ')}>
      ${context.text
        ? html`<sf-button size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon-start=${icon} text=${context.text} aria-label=${context.name}
                 root-style=${context.rootStyle || nothing}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-button>`
        : html`<sf-button-icon size=${common.size} appearance=${common.appearance} scheme=${common.scheme}
                 icon=${icon} aria-label=${context.name} data-tooltip=${context.nameTooltipId}
                 root-style=${context.rootStyle || nothing}
                 aria-disabled=${context.phase === 'pending' ? 'true' : nothing}
                 @click=${() => context.component.copy()}></sf-button-icon>`}
      ${context.text ? nothing : surface('sf-copy-button-name', context.name, {id: context.nameTooltipId, hidden: true})}
      ${surface('sf-copy-button-result', showResult ? context.message : '', {hidden: !showResult, ariaHidden: true})}
      <span class="sf-copy-button-status" role="status" aria-live="polite" aria-atomic="true">${context.message}</span>
    </span>
  `;
}
