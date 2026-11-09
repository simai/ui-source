// The behaviour of a question put to a person in place: two answers, a
// pending state while the answer is applied, the outcome, and an optional time
// the offer runs out. sf-confirm (the plain question) and
// sf-confirm-change (the same question over values as they were and as they
// will be) are this one surface (duplication audit 2026-11-03, A-5): it was
// written once in sf-confirm-change and five more times by hand in the chat
// and view components (a delete asked in its row, a member removed, a view
// reset).
//
// The element never applies anything. A press moves it to `pending`, which
// takes both answers away so that nothing is pressed twice, and says what is
// happening; the host then sets the outcome -- `accepted`, `declined`, or back
// to `open` when the answer could not be delivered. It is a confirm surface in
// the §19.4 sense: an assembly's `ask` opens it and waits for the answer.
//
// confirmSurface(Base, {kind, block, answerId}) gives a class built from a
// manifest with the settings state, expires-at and disabled, the events
// answer and expired, and the actions open, answer, confirm and cancel:
//   kind      the element's tag, for the heading's instance path (§7.1.1);
//   block     the class of the drawn surface (its __status and __actions);
//   answerId  the setting the host names the question with (carried back).
import {html, nothing} from "lit";
import {applied, refused} from "../../core/js/element-manifest";
import {instancePath, partId} from "../../core/js/instance-path";
import {calendarDayOffset, formatDate} from "../../core/js/format-date.js";

export const CONFIRM_STATES = Object.freeze(["open", "pending", "accepted", "declined", "expired"]);

// A timer longer than this is not a timer setTimeout keeps: past 2^31-1 ms it
// fires at once. An offer valid for longer than 24 days is checked again daily.
const LONGEST_WAIT = 24 * 60 * 60 * 1000;

// The steps of the control ladder the answers stand on (C22): the element's
// size, else 1, the size of a field and a button beside it. Compactness is
// the region's density (data-sf-density), never a smaller size by hand.
export const CONFIRM_SIZES = Object.freeze(["1/3", "1/2", "1", "2", "3"]);

// The glyph the status line shows beside its words, per state.
export const CONFIRM_ICON = Object.freeze({
    open: "schedule", pending: "schedule", accepted: "check_circle", declined: "cancel", expired: "timer_off",
});

export function confirmSurface(Base, {kind, block, answerId = "answerId"} = {}) {
    return class ConfirmSurface extends Base {
        constructor() {
            super();
            this._pressed = null;
            this._timer = null;
            this._expiredSaid = false;
            this._asks = [];
        }

        get state() {
            const value = this.getAttribute("state");
            return CONFIRM_STATES.includes(value) ? value : "open";
        }

        set state(value) {
            this.setAttribute("state", CONFIRM_STATES.includes(value) ? value : "open");
        }

        // An open offer past its time is expired whatever the attribute says:
        // the host may not have heard yet, and a button that can no longer work
        // must not be pressable in the meantime.
        get expired() {
            if (this.state === "expired") return true;
            if (this.state !== "open") return false;
            const until = Date.parse(this.getAttribute("expires-at") || "");
            return Number.isFinite(until) && Date.now() >= until;
        }

        get shownState() {
            return this.expired ? "expired" : this.state;
        }

        // The heading's id is the surface's path (§7.1.1), never a counter.
        get headingId() {
            return partId(instancePath(this, {kind}), "heading");
        }

        // The host's name for the question, carried back in every event. Not
        // named after any setting: sf-confirm's own setting is confirmId.
        get questionKey() {
            return this[answerId] ?? "";
        }

        formatTime(value) {
            const sameDay = calendarDayOffset(value) === 0;
            return formatDate(value, {node: this, intl: sameDay
                ? {hour: "2-digit", minute: "2-digit"}
                : {day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"}});
        }

        statusText(shown) {
            if (shown === "pending") return this.sfWord(this._pressed === false ? "declining-text" : "accepting-text");
            if (shown === "accepted") return this.sfWord("accepted-text");
            if (shown === "declined") return this.sfWord("declined-text");
            if (shown === "expired") return this.sfWord("expired-text");
            const until = this.getAttribute("expires-at");
            const time = until ? this.formatTime(until) : "";
            return time ? this.sfWord("until-text", {vars: {time}}) : "";
        }

        // What every template of the surface reads: the state shown, the
        // heading, the status line and the two answers.
        confirmContext() {
            const shown = this.shownState;
            return {
                component: this,
                state: shown,
                headingId: this.headingId,
                heading: this.getProp("heading"),
                headingLevel: this.getProp("headingLevel"),
                hasDescription: this.hasSlotContent("description"),
                descriptionContent: this.hasSlotContent("description") ? this.getSlotContent("description") : null,
                acceptText: this.getProp("acceptText") || this.sfWord("accept-text"),
                declineText: this.getProp("declineText") || this.sfWord("decline-text"),
                statusText: this.statusText(shown),
                statusIcon: CONFIRM_ICON[shown] ?? "schedule",
                open: shown === "open",
                pending: shown === "pending",
                // Which answer is on its way: true, false, or null when the
                // host set pending itself.
                pressed: shown === "pending" ? this._pressed : null,
                // Not named `disabled`: that is the setting, and this is more --
                // the setting, or any state but open.
                answersLocked: this.getProp("disabled") || shown !== "open",
                // The step the answers stand on: a page's size, else 1 (C22).
                size: CONFIRM_SIZES.includes(this.getAttribute("size")) ? this.getAttribute("size") : "1",
            };
        }

        onConnected() {
            super.onConnected?.();
            this.schedule();
        }

        onDisconnected() {
            clearTimeout(this._timer);
            this._timer = null;
            super.onDisconnected?.();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            super.attributeChangedCallback?.(name, oldValue, newValue);
            if (name === "state" && newValue !== "pending") this._pressed = null;
            if (name === "state" || name === "expires-at") {
                // A new time, or the host reopening the offer, is a new chance
                // to run out; the last expiry was about the last time.
                if (name === "expires-at" || newValue === "open") this._expiredSaid = false;
                this.schedule();
            }
        }

        // One timer, for the moment the offer runs out; nothing polls. When it
        // fires the surface redraws as expired and the host hears it once.
        schedule() {
            clearTimeout(this._timer);
            this._timer = null;
            if (!this.isConnected || this.state !== "open") return;
            const until = Date.parse(this.getAttribute("expires-at") || "");
            if (!Number.isFinite(until)) return;
            const wait = until - Date.now();
            if (wait <= 0) {
                this.expire();
                return;
            }
            this._timer = setTimeout(() => {
                this._timer = null;
                if (Date.now() >= until) this.expire();
                else this.schedule();
            }, Math.min(wait + 50, LONGEST_WAIT));
        }

        expire() {
            this.requestComponentUpdate("expired");
            this.settleAsks({accepted: false, reason: "expired"});
            if (this._expiredSaid) return;
            this._expiredSaid = true;
            this.sfEmit("expired", {id: this.questionKey});
        }

        // ── actions (§4.4) ──────────────────────────────────────────────────

        /**
         * Puts the question again. Asked by an assembly -- a call that hands a
         * signal -- it answers when the person answers or the time runs out,
         * with {accepted, reason, value} (§19.4).
         */
        open(...args) {
            // (params, {signal}): the parameters are none; the second is the ask's.
            const {signal} = args[1] ?? {};
            const reopened = this.state !== "open";
            if (reopened) this.state = "open";
            // The question is put to the person now: focus waits on the safe
            // answer (decision C25), so a stray Enter or Space only takes the
            // question back.
            this.whenRendered(() => this.focusSafeAnswer(), {next: reopened});
            return signal ? this.waitForAnswer(signal) : applied();
        }

        /** The person's answer as a call: {accepted: true} confirms, false declines. */
        answer(params = {}) {
            const accepted = this.readAnswer(params);
            if (accepted === null) return refused("unknown");
            if (this.shownState !== "open") return refused("closed");
            if (this.getProp("disabled")) return refused("disabled");
            const focusWasInside = this.contains(this.ownerDocument.activeElement);
            this._pressed = accepted;
            this.setAttribute("state", "pending");
            const delivered = this.sfEmit("answer", {id: this.questionKey, accepted});
            // A cancelled event is a host that did not take the answer: the
            // question stands, and the person may answer again.
            if (!delivered) {
                this._pressed = null;
                this.setAttribute("state", "open");
            } else {
                this.settleAsks({accepted, reason: accepted ? "close" : "cancelled"});
            }
            // The pressed button is gone with the answers; focus moves to the
            // sentence that says what happened rather than falling to the page.
            if (focusWasInside) this.whenRendered(() => this.focusStatus(), {next: true});
            return delivered ? applied() : refused("prevented");
        }

        /** The acceptance (§19.4): data-sf-action="<id>.confirm". */
        confirm() {
            return this.answer({accepted: true});
        }

        /** The declining answer (vocabulary §5 cancel): data-sf-action="<id>.cancel". */
        cancel() {
            return this.answer({accepted: false});
        }

        readAnswer(params) {
            if (params && typeof params === "object" && typeof params.accepted === "boolean") return params.accepted;
            return null;
        }

        waitForAnswer(signal) {
            return new Promise((resolve) => {
                const ask = {resolve};
                this._asks.push(ask);
                signal?.addEventListener?.("abort", () => {
                    this._asks = this._asks.filter((one) => one !== ask);
                    resolve({outcome: "cancelled"});
                }, {once: true});
            });
        }

        settleAsks({accepted, reason}) {
            const asks = this._asks;
            this._asks = [];
            for (const ask of asks) ask.resolve({outcome: "applied", value: {accepted, reason, value: null}});
        }

        focusStatus() {
            const target = this.querySelector(`.${block}__status`);
            if (!target) return;
            if (this.state === "open" && this.focusSafeAnswer()) return;
            target.focus({preventScroll: true});
        }

        // The answer that changes nothing -- the declining one -- takes the
        // focus whenever the question is put (decision C25, as Primer's
        // ConfirmationDialog does for a dangerous one): Enter or Space pressed
        // by habit closes the question, and the accepting answer needs a
        // pointer or Tab. Answers false when there is no answer to focus.
        // The surface's after-render can come before the answer can take the
        // focus (its sf-button is drawn, or its region shown, a frame later):
        // the focus then tries again for a few frames, unless the person has
        // moved it meanwhile.
        focusSafeAnswer(frames = 10) {
            if (this.shownState !== "open" || this.getProp("disabled")) return false;
            const host = this.querySelector(`.${block}__actions:not([hidden]) [data-action="decline"]`);
            const button = host?.matches("button") ? host : host?.querySelector("button");
            button?.focus({preventScroll: true});
            const doc = this.ownerDocument;
            if (button && doc.activeElement === button) return true;
            const view = doc.defaultView;
            if (host && frames > 0 && view?.requestAnimationFrame) {
                view.requestAnimationFrame(() => {
                    const active = doc.activeElement;
                    if (!active || active === doc.body || this.contains(active)) this.focusSafeAnswer(frames - 1);
                });
            }
            return false;
        }
    };
}

// The surface's footer, the same in every template: the status line, then the
// two answers. `block` is the drawn surface's class; `acceptStatus` "danger"
// marks a destructive acceptance (a delete, decision C13).
//
// The answers (decision C25): a plain question offers two outlined answers of
// one weight. A dangerous one fills the accepting answer with the danger
// colour and leaves the declining one quiet (ghost, no frame), so the two are
// told apart by more than the red of a word. Both stand on the element's size
// (context.size, 1 unless the page gives one); a size a template gives is
// relative, so a compact region (data-sf-density, C22) moves them down a step.
export function renderConfirmFooter(context, block, {acceptStatus = ""} = {}) {
    const {component} = context;
    const danger = acceptStatus === "danger" || acceptStatus === "error";
    const size = context.size || "1";
    return html`
            <footer class="${block}__footer">
                <!-- Always in the page, empty while there is nothing to say: a live
                     region that appears together with its words is not heard. -->
                <p class="${block}__status" role="status" tabindex="-1">
                    ${context.statusText
                        ? html`<sf-icon icon=${context.statusIcon} size="1" aria-hidden="true"></sf-icon>
                            <span>${context.statusText}</span>`
                        : nothing}
                </p>
                <!-- While the answer is applied (pending) the answers stay where they
                     were: the pressed one busy, with the button's own spinner and
                     aria-busy, the other disabled, so the card does not jump and
                     the person sees which answer is on its way. -->
                <div class="${block}__actions" ?hidden=${!context.open && !context.pending}>
                    <sf-button
                            appearance=${danger ? "default" : "outline"}
                            scheme="primary"
                            status=${danger ? "danger" : nothing}
                            size=${size}
                            text=${context.acceptText}
                            data-action="accept"
                            ?loading=${context.pressed === true}
                            ?disabled=${context.answersLocked && context.pressed !== true}
                            @click=${() => component.confirm()}
                    ></sf-button>
                    <sf-button
                            appearance=${danger ? "ghost" : "outline"}
                            scheme="on-surface"
                            size=${size}
                            text=${context.declineText}
                            data-action="decline"
                            ?loading=${context.pressed === false}
                            ?disabled=${context.answersLocked && context.pressed !== false}
                            @click=${() => component.cancel()}
                    ></sf-button>
                </div>
            </footer>`;
}
