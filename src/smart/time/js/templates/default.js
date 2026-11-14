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
// - The time element is a Tab stop only with a tooltip and outside a link
//   or a button (index.js focusable).

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
      id=${context.tipId} hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${said.full}</span></span></span></span>`;
}
