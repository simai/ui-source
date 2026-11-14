import {html, nothing} from "lit";
import "./default.css";
import {renderConfirmFooter} from "../../../helpers/confirm-surface.js";

// One change put to a person: a heading, the values as they were and as they
// will be, then the answers or the outcome.
//
// The heading is a role="heading" with a level the host chooses, not a fixed
// <h2>: the card is placed inside a message, a panel or a page, and the level
// that is right in one is a skipped level in another.
//
// The values are sf-change's list (1.7.0, owner decision C40): a description
// list, the field the term and «before → after» its description, the old value
// quiet and the new one in medium weight, so a screen reader reads «Название:
// Черновик на Итоги» rather than a grid of loose words. A value is text, never
// markup; an empty one reads «пусто». The group around it names the changes.
//
// Both answers are outlined and weigh the same: a change is decided, not
// nudged, and a filled «Confirm» beside a quiet «Decline» is a nudge.
// «Отклонить» is that decision, not a cancel, so it stays outlined when every
// «Отмена» is quiet (decision C116 #q-cancel; the shared footer's
// declineAppearance).
//
// The status line is a polite live region and also the place focus goes when
// the button that had it disappears (index.js, answer()).
//
// The answers call the actions confirm and cancel, which a page reaches as
// data-sf-action="<id>.confirm" and "<id>.cancel" (§8, §19.4).
export function renderChangeConfirmTemplate(context) {
    return html`
        <section
                class="sf-change-confirm sf-change-confirm--${context.state}"
                aria-labelledby=${context.heading ? context.headingId : nothing}
                aria-label=${context.heading ? nothing : context.changesLabel}
                data-state=${context.state}
                ?hidden=${context.collapsed}
        >
            ${context.heading
                ? html`<div class="sf-change-confirm__heading" id=${context.headingId} role="heading"
                            aria-level=${context.headingLevel}>${context.heading}</div>`
                : nothing}
            ${context.hasDescription
                ? html`<div class="sf-change-confirm__description">${context.descriptionContent}</div>`
                : nothing}
            <div class="sf-change-confirm__changes" role="group" aria-label=${context.changesLabel}>
                <sf-change class="sf-change-confirm__list" layout="list" .changes=${context.changes}></sf-change>
            </div>
            ${renderConfirmFooter(context, "sf-change-confirm", {declineAppearance: "outline"})}
        </section>
    `;
}
