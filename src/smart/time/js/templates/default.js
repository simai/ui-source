import {html, nothing} from 'lit';

// sf-time's markup (scss/ draws it).
//
// - A time element: datetime the exact moment (ISO), its text the words the
//   format gives. Nothing for a value that is no date.
// - With a tooltip: the Framework's tooltip composition -- an anchor holding
//   the time element (the trigger, data-tooltip naming the surface) and the
//   surface, the dark tooltip without a tail: it opens below the time and
//   flips above at the window's bottom edge, one size whatever the density
//   (owner decision C160 (3), (4); C59: no arrow by default). The tooltip
//   controller (component.tooltip) links them: hover and
//   keyboard focus show it, Escape and a press hide it, aria-describedby
//   names it. The surface is hidden in the markup and only the controller
//   shows it, so a redraw never fights it.
// - The time element is a Tab stop only with a tooltip, outside a link or a
//   button and outside a list or a feed (index.js focusable; owner decision
//   C183 (2)). Where it is no stop, the full moment with its zone is a
//   visually hidden line after it (spoken), so the row's text carries it.
// - The tooltip names the zone: «13 ноября 2026 г. в 19:40, Москва (UTC+3)»
//   (said.tip, C183 (3)).

export function renderTimeTemplate(context) {
  const {said} = context;
  if (!said) return nothing;
  const classes = ['sf-time', said.relative ? 'sf-time--relative' : '', context.rootClass].filter(Boolean).join(' ');
  if (!context.hasTip) {
    return html`<time class=${classes} datetime=${said.iso}>${said.shown}</time>`;
  }
  return html`<span class="sf-time-anchor sf-tooltip-anchor"><time class=${classes} datetime=${said.iso}
      tabindex=${context.focusable ? '0' : nothing} data-tooltip=${context.tipId}>${said.shown}</time><span
      class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-time-tooltip"
      id=${context.tipId} hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${said.tip}</span></span></span>${context.spoken
      ? html`<span class="sr-only">, ${said.tip}</span>` : nothing}</span>`;
}
