import {html, nothing} from "lit";
import "./default.css";
import {renderConfirmFooter} from "../../../helpers/confirm-surface.js";

// The question, then the status line and the two answers (the confirm
// surface's footer, shared with sf-confirm-change).
//
// The surface is a group named by the question's paragraph: an in-place
// question sits in a row of a list or a panel, where a heading would break the
// page's outline. The question is text, never markup; the description slot
// says more when the question alone does not (what stays, what goes).
//
// The answers call the actions confirm and cancel, which a page reaches as
// data-sf-action="<id>.confirm" and "<id>.cancel" (§8, §19.4). A destructive
// acceptance wears the error status; both stay outlined and of one weight.
export function renderConfirmTemplate(context) {
    return html`
        <section
                class="sf-confirm sf-confirm--${context.appearance} sf-confirm--${context.state}"
                role="group"
                aria-labelledby=${context.question ? context.headingId : nothing}
                aria-label=${context.question ? nothing : context.questionLabel}
                data-state=${context.state}
        >
            ${context.question
                ? html`<p class="sf-confirm__question" id=${context.headingId}>${context.question}</p>`
                : nothing}
            ${context.hasDescription
                ? html`<div class="sf-confirm__description">${context.descriptionContent}</div>`
                : nothing}
            ${renderConfirmFooter(context, "sf-confirm", {acceptStatus: context.destructive ? "error" : ""})}
        </section>
    `;
}
