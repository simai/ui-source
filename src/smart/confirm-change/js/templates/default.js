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
// declineAppearance). A dangerous change (status="danger": a delete, or
// anything that cannot be undone) is the question of decision C25: the
// accepting answer filled danger, the declining one quiet (DEV change-time
// study CT-4). The answers stand at the start, the accepting one first, 8
// apart (4 in a compact region), the status line after them -- one rule for
// every question (C166, C157 (3), C159 (4); CT-3).
//
// The classes carry the element's name, .sf-confirm-change__* (1.8.0); the
// former .sf-change-confirm* are written beside them until 2027-01-01
// (journal class-confirm-change-block-names).
//
// The status line is a polite live region and also the place focus goes when
// the button that had it disappears (index.js, answer()).
//
// The answers call the actions confirm and cancel, which a page reaches as
// data-sf-action="<id>.confirm" and "<id>.cancel" (§8, §19.4).
export function renderChangeConfirmTemplate(context) {
    return html`
        <section
                class="sf-confirm-change sf-confirm-change--${context.state} sf-change-confirm sf-change-confirm--${context.state}"
                aria-labelledby=${context.heading ? context.headingId : nothing}
                aria-label=${context.heading ? nothing : context.changesLabel}
                data-state=${context.state}
                ?hidden=${context.collapsed}
        >
            ${context.heading
                ? html`<div class="sf-confirm-change__heading sf-change-confirm__heading" id=${context.headingId} role="heading"
                            aria-level=${context.headingLevel}>${context.heading}</div>`
                : nothing}
            ${context.hasDescription
                ? html`<div class="sf-confirm-change__description sf-change-confirm__description">${context.descriptionContent}</div>`
                : nothing}
            <div class="sf-confirm-change__changes sf-change-confirm__changes" role="group" aria-label=${context.changesLabel}>
                <sf-change class="sf-confirm-change__list sf-change-confirm__list" layout="list" .changes=${context.changes}></sf-change>
            </div>
            ${renderConfirmFooter(context, "sf-confirm-change", {
                acceptStatus: context.danger ? "danger" : "",
                declineAppearance: context.danger ? "ghost" : "outline",
                formerBlock: "sf-change-confirm",
            })}
        </section>
    `;
}
