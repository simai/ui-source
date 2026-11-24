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
// acceptance (status="danger") is a filled danger answer (decision C25), a
// plain one the filled primary main answer (C183, C176; sf-confirm 1.3.6);
// «Отмена» beside it is always quiet (ghost, C116).
export function renderConfirmTemplate(context) {
    if (context.appearance === "window") return renderConfirmWindow(context);
    return html`
        <section
                class="sf-confirm sf-confirm--${context.appearance} sf-confirm--${context.state}"
                role="group"
                aria-labelledby=${context.question ? context.headingId : nothing}
                aria-label=${context.question ? nothing : context.questionLabel}
                data-state=${context.state}
                ?hidden=${context.collapsed}
        >
            ${context.question
                ? html`<p class="sf-confirm__question" id=${context.headingId}>${context.question}</p>`
                : nothing}
            ${context.hasDescription
                ? html`<div class="sf-confirm__description">${context.descriptionContent}</div>`
                : nothing}
            ${renderConfirmFooter(context, "sf-confirm", {acceptStatus: context.danger ? "danger" : "", acceptAppearance: "default"})}
        </section>
    `;
}

// The window form (appearance="window", decision C39): in a window the
// question is the window's title (sf-modal size="question"); the question's
// own line is drawn too and the window's header hides it (default.css), so
// the same form standing on a page of its own -- the host's address for the
// action, no window around it -- still says what it asks (sf-confirm 1.5.7,
// Larena audit 2026-11-24: on such a page the question was nowhere and the
// decisive sentence read as the question). The line names the group. Under
// it the consequences on a quiet plate -- the description, then the
// decisive sentence (consequence) on its own line in medium weight; the
// page's options (a checkbox); the name to type (require) with its label
// «Чтобы подтвердить, введите <code>name</code>» and a field; then the two
// answers, the filled danger answer first, at the start. The steps grow
// towards the answers (default.css). Declined here, it folds away as the
// inline and card forms do (C35); its window closes on the decline anyway.
function renderConfirmWindow(context) {
    const plate = context.hasDescription || context.consequence;
    return html`
        <section
                class="sf-confirm sf-confirm--window sf-confirm--${context.state}"
                role="group"
                aria-labelledby=${context.question ? context.headingId : nothing}
                aria-label=${context.question ? nothing : context.questionLabel}
                data-state=${context.state}
                ?hidden=${context.collapsed}
        >
            ${context.question
                ? html`<p class="sf-confirm__question" id=${context.headingId}>${context.question}</p>`
                : nothing}
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
                    <p class="sf-confirm__require-label" aria-hidden="true">${context.requireParts.before}<code class="sf-confirm__name">${context.require}</code>${context.requireParts.after}</p>
                    <sf-input
                            class="sf-confirm__field"
                            autocomplete="off"
                            aria-label=${context.requireText}
                            ?invalid=${context.requireInvalid}
                            error-message=${context.requireInvalid ? context.requireError : nothing}
                            ?disabled=${context.answersLocked}
                    ></sf-input>
                </div>`
                : nothing}
            ${renderConfirmFooter(context, "sf-confirm", {acceptStatus: context.danger ? "danger" : "", acceptAppearance: "default", window: true})}
        </section>
    `;
}
