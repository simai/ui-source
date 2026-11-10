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
// data-sf-action="<id>.confirm" and "<id>.cancel" (§8, §19.4). A dangerous
// acceptance (status="danger") is a filled danger answer beside a quiet
// declining one (decision C25); a plain question has two outlined answers.
export function renderConfirmTemplate(context) {
    if (context.appearance === "window") return renderConfirmWindow(context);
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
            ${renderConfirmFooter(context, "sf-confirm", {acceptStatus: context.danger ? "danger" : ""})}
        </section>
    `;
}

// The window form (appearance="window", decision C39): the question is the
// window's title (sf-modal size="question"), so here it only names the group.
// Under it the consequences on a quiet plate -- the description, then the
// decisive sentence (consequence) on its own line in medium weight; the
// page's options (a checkbox); the name to type (require) with its label
// «Чтобы подтвердить, введите <code>name</code>» and a field; then the two
// answers, the filled danger answer first, at the start. The steps grow
// towards the answers (default.css).
function renderConfirmWindow(context) {
    const plate = context.hasDescription || context.consequence;
    return html`
        <section
                class="sf-confirm sf-confirm--window sf-confirm--${context.state}"
                role="group"
                aria-label=${context.question || context.questionLabel}
                data-state=${context.state}
        >
            ${plate
                ? html`<div class="sf-confirm__consequences">
                    ${context.hasDescription
                        ? html`<div class="sf-confirm__description">${context.descriptionContent}</div>`
                        : nothing}
                    ${context.consequence
                        ? html`<p class="sf-confirm__consequence">${context.consequence}</p>`
                        : nothing}
                </div>`
                : nothing}
            ${context.hasOptions
                ? html`<div class="sf-confirm__options">${context.optionsContent}</div>`
                : nothing}
            ${context.require
                ? html`<div class="sf-confirm__require">
                    <p class="sf-confirm__require-label" aria-hidden="true">${context.requireText} <code class="sf-confirm__name">${context.require}</code></p>
                    <sf-input
                            class="sf-confirm__field"
                            autocomplete="off"
                            aria-label=${`${context.requireText} ${context.require}`}
                            ?invalid=${context.requireInvalid}
                            error-message=${context.requireInvalid ? context.requireError : nothing}
                            ?disabled=${context.answersLocked}
                    ></sf-input>
                </div>`
                : nothing}
            ${renderConfirmFooter(context, "sf-confirm", {acceptStatus: context.danger ? "danger" : "", window: true})}
        </section>
    `;
}
