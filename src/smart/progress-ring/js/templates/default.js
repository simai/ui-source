import { html, nothing } from 'lit';
import { percentText } from '../../../../core/js/format-number.js';

// The avatar's ladder (owner decision C131 (5)).
const SIZES = ['1/4', '1/3', '1/2', '1', '2', '3'];
// No status (empty) is the theme's primary and carries no class; neutral is
// grey (C131 (1)).
const STATUSES = ['neutral', 'info', 'success', 'warning', 'error'];
// Up to size 1 the middle holds no percentage (DEV look answer 2026-11-20,
// msg-1c3a4f0b: below 1 the letters fall off the text ladder; at 1 «100%» ran
// 1-3 px past the 32 px middle and a smaller step would fall off it too). The
// value stays in the ring's name and in its tooltip; text from size 2 up.
const TEXTLESS = new Set(['1/4', '1/3', '1/2', '1']);

// A number from 0 to 100; anything else reads 0.
export function normalizeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

const on = (value) => value === true || value === '' || value === 'true';

// The percentage as the middle draws it: no space of any kind between the
// number and the sign, on either side (a language that writes the sign first,
// «%72», keeps its order); the direction marks of a right-to-left language stay.
export function ringPercent(text) {
  return String(text).replace(/[\s\u00a0\u202f]+(?=[\u200e\u200f\u061c]*[%\u066a])|(?<=[%\u066a][\u200e\u200f\u061c]*)[\s\u00a0\u202f]+/gu, '');
}

// The class markup of the ring (src/component/progress-ring): the root holds
// the value as --sf-progress-ring--value, the ring (.sf-progress-ring-indicator)
// carries the role and the value, and the middle holds the slot content or the
// percentage, which is aria-hidden: the ring says the value once.
export function renderProgressRingTemplate(context) {
  const size = SIZES.includes(String(context.size)) ? String(context.size) : '1';
  const given = String(context.drawnStatus ?? context.status ?? '');
  const status = STATUSES.includes(given) ? given : '';
  const indeterminate = on(context.indeterminate);
  const meter = on(context.meter);
  const value = normalizeValue(context.value);
  const role = meter ? 'meter' : 'progressbar';
  // A meter always has a value; only a progressbar can be indeterminate.
  const unknown = indeterminate && !meter;
  // Below size 1 no percentage is shown (PG-10, C131 (5)): the box leaves
  // 8 px letters, below the text ladder. The value stays the ring's
  // (aria-valuenow), so a screen reader still says it; the eye reads the arc.
  // Inside the ring the sign stands against the number, «100%» (DEV look
  // answer 2026-11-20, (c)): the middle holds four characters at most, and the
  // no-break space the progress family writes elsewhere («100 %», C203 (3))
  // ran «100 %» past the middle of size 3. The ring's spoken value keeps it
  // (aria-valuetext below), as every other place does.
  const text = on(context.showText) && !unknown && !TEXTLESS.has(size) ? ringPercent(percentText(value, context.component ?? null)) : '';
  // At sizes 2 and 3 a value of four characters («100%») takes the next
  // smaller text step (1.7.1, DEV GB15-2): at size 2 it ran 41 px in the 40 px
  // middle, at size 3 of a compact region 41 in 40. Counted without the
  // direction marks of a right-to-left language.
  const long = (size === '2' || size === '3') && [...text.replace(/[\u200e\u200f\u061c]/gu, '')].length >= 4;
  const content = context.content && context.content !== nothing ? context.content : null;
  // Where the percentage asked for has no room (show-text up to size 1), it is
  // the ring's tooltip: the Framework's tooltip composition (component.tooltip),
  // the root its trigger (the ring line takes no pointer), a dark tooltip of
  // size 1/3 the controller shows on hover and hides on Escape and a press; the
  // text is the spoken one, «100 %». A ring with content or an unknown value
  // has none.
  // A value that fits no text step (the sheet hides it, 1.7.1) takes the same
  // tooltip (1.7.2, DEV look answer msg-8e6b1330); the host says when.
  const hiddenText = Boolean(context.textHidden) && Boolean(text);
  const tip = on(context.showText) && !unknown && !content && (TEXTLESS.has(size) || hiddenText) && context.tipId
    ? percentText(value, context.component ?? null) : '';
  // A ring around a picture is about something of the person's own -- a
  // profile filled in, a photo being sent (owner decision C191 (4)). At 100 %
  // nothing is left to do, so the ring goes away (C191 (7) #q-ar-done): no
  // line and no value to say, the picture alone, in the same box so nothing
  // around it moves. A meter (an amount used) and an unknown value keep the
  // ring: a quota at 100 % is the news, not the end of it.
  const done = Boolean(content) && !meter && !unknown && value >= 100;

  const rootClasses = [
    'sf-progress-ring',
    `sf-progress-ring--size-${size}`,
    status ? `sf-progress-ring--${status}` : '',
    unknown ? 'sf-progress-ring--indeterminate' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const style = [`--sf-progress-ring--value: ${unknown ? 0 : value}`, context.rootStyle].filter(Boolean).join('; ');

  return html`
    <div class=${rootClasses} style=${style} data-value=${String(value)} data-status=${status}
      data-tooltip=${tip ? context.tipId : nothing}>
      ${done ? nothing : html`<span
        class="sf-progress-ring-indicator"
        role=${role}
        aria-label=${context.label || nothing}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${unknown ? nothing : String(value)}
        aria-valuetext=${unknown ? nothing : (context.valueText || percentText(value, context.component ?? null))}
      ></span>`}
      ${content
        ? html`<span class="sf-progress-ring-content">${content}</span>`
        : text
          ? long
            ? html`<span class="sf-progress-ring-content sf-progress-ring-content--long" aria-hidden="true">${text}</span>`
            : html`<span class="sf-progress-ring-content" aria-hidden="true">${text}</span>`
          : nothing}
      ${tip ? html`<span class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-progress-ring-tooltip" id=${context.tipId}
        hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${tip}</span></span></span>` : nothing}
    </div>
  `;
}
