// A question put to a person in place, before something happens: a delete
// asked in its row, a member removed from a conversation, a view reset to the
// host's. What will happen, two answers, a pending state while the answer is
// applied, the outcome, and an optional time the question runs out.
//
// The block confirm of SIMAI Framework (owner decision 2026-11-03, component
// sets, point 13; duplication audit 2026-11-03 A-5): the chat and view
// components asked this five times by hand, each with its own buttons, busy
// state and focus. sf-confirm is the block's main member; sf-confirm-change is
// the same surface over values as they were and as they will be. Both take
// their behaviour from ../helpers/confirm-surface.js: the element never
// applies anything, a press moves it to pending and reports the answer, the
// host sets the outcome. An assembly's `ask` opens it and waits (§19.4).
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8,
// §11): the settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, the actions
// answer outcomes, and the answer is the vocabulary's `answer {id, accepted}`.
// It renders into its own light DOM, like every Smart component.
import SfBaseElement from "../../core/js/smart-base";
import {elementFromManifest, refused} from "../../core/js/element-manifest";
import {confirmSurface} from "../helpers/confirm-surface.js";
import {noteDeprecated} from "../../core/js/deprecations";
import {matchesBreakpoint} from "../../core/js/breakpoints.js";
import {renderConfirmTemplate} from "./js/templates/default.js";
import manifest from "./component.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

const ConfirmElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: "ru",
});

const APPEARANCES = ["inline", "card", "window"];
// Below sm the two answers share the row in halves (default.css); a label
// that does not fit its half stacks them. The step is core/js/breakpoints.js.

const ConfirmSurface = confirmSurface(ConfirmElement, {
    kind: "sf-confirm",
    block: "sf-confirm",
    answerId: "confirmId",
});

class SfConfirm extends ConfirmSurface {
    static get props() {
        return {
            ...super.props,
            templateName: {attribute: "template", default: "default"},
        };
    }

    constructor() {
        super();
        this._onKeydown = (event) => this.onKeydown(event);
        this._onInput = (event) => this.onInput(event);
        this._requireShown = false;
    }

    get appearance() {
        const value = this.getProp("appearance");
        return APPEARANCES.includes(value) ? value : "inline";
    }

    // The name the person types before the acceptance works (window form,
    // decision C39, R069): empty is none.
    get requiredName() {
        return this.appearance === "window" ? String(this.getProp("require") || "").trim() : "";
    }

    get requireField() {
        return this.querySelector(".sf-confirm__field");
    }

    get requireMet() {
        const name = this.requiredName;
        if (!name) return true;
        const input = this.requireField?.querySelector("input");
        return (input?.value ?? "").trim() === name;
    }

    // What the acceptance does (decision C13): status="danger" for a delete or
    // anything that cannot be undone. destructive is its former name: read as
    // danger and noted once, until 2027-01-01 (change journal
    // setting-confirm-destructive-to-status-danger).
    get danger() {
        if (this.getAttribute("status") === "danger") return true;
        if (!this.getProp("destructive")) return false;
        if (!this._destructiveNoted) {
            this._destructiveNoted = true;
            noteDeprecated({component: "sf-confirm", tag: "sf-confirm", kind: "setting", attribute: "destructive",
                from: "destructive", to: "status=\"danger\"", since: "2026-11-09", remove_after: "2027-01-01"});
        }
        return true;
    }

    templateContext() {
        const question = this.getProp("question") || "";
        return {
            ...this.confirmContext(),
            question,
            questionLabel: this.sfWord("question-label"),
            appearance: this.appearance,
            danger: this.danger,
            consequence: this.appearance === "window" ? this.getProp("consequence") || "" : "",
            hasOptions: this.appearance === "window" && this.hasSlotContent("options"),
            optionsContent: this.appearance === "window" && this.hasSlotContent("options") ? this.getSlotContent("options") : null,
            require: this.requiredName,
            requireText: this.sfWord("require-text"),
            requireError: this.sfWord("require-error", {vars: {name: this.requiredName}}),
            requireInvalid: this._requireShown,
        };
    }

    template() {
        return renderConfirmTemplate(this.templateContext());
    }

    // The acceptance waits for the name (R064): an early press -- the button,
    // Enter in the field, or the action called -- puts the focus in the field
    // and says under it what to type; the button stays filled and pressable.
    answer(params = {}) {
        if (params?.accepted === true && this.shownState === "open" && !this.getProp("disabled") && !this.requireMet) {
            this.explainRequire();
            return refused("required");
        }
        return super.answer(params);
    }

    explainRequire() {
        this._requireShown = true;
        this.requestComponentUpdate("require");
        this.whenRendered(() => this.requireField?.querySelector("input")?.focus({preventScroll: true}), {next: true});
    }

    // Typing the name takes the explanation away.
    onInput(event) {
        if (!this._requireShown || !this.requireField?.contains(event.target)) return;
        if (!this.requireMet) return;
        this._requireShown = false;
        this.requestComponentUpdate("require");
    }

    // Put again, the question starts afresh: no name typed, nothing said.
    open(...args) {
        if (this.requiredName) {
            this._requireShown = false;
            const field = this.requireField;
            if (field && "value" in field) field.value = "";
            const input = field?.querySelector("input");
            if (input) input.value = "";
        }
        return super.open(...args);
    }

    afterRender(changed) {
        super.afterRender?.(changed);
        this.watchAnswers();
    }

    // The window form's answers on a phone: two equal halves while each label
    // fits its half, one under the other when one does not.
    watchAnswers() {
        const actions = this.appearance === "window" ? this.querySelector(".sf-confirm__actions") : null;
        if (actions === this._watchedActions) return;
        this._answersObserver?.disconnect();
        this._watchedActions = actions;
        if (!actions || typeof ResizeObserver !== "function") return;
        this._answersObserver = new ResizeObserver(() => this.fitAnswers());
        this._answersObserver.observe(actions);
    }

    fitAnswers() {
        const actions = this._watchedActions;
        if (!actions) return;
        const phone = matchesBreakpoint("sm", {below: true, view: this.ownerDocument.defaultView});
        if (!phone) {
            actions.removeAttribute("data-stacked");
            return;
        }
        if (actions.hasAttribute("data-stacked")) return;
        // A label that does not fit its half either overflows or breaks onto
        // a second line: either stands the answers one under the other.
        const over = [...actions.querySelectorAll("button")].some((button) => {
            const text = button.querySelector(".sf-button-text-container") || button;
            if (text.scrollWidth > text.clientWidth + 1) return true;
            const range = this.ownerDocument.createRange();
            range.selectNodeContents(text);
            const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)));
            return lines.size > 1;
        });
        if (over) actions.setAttribute("data-stacked", "");
    }

    onConnected() {
        super.onConnected?.();
        this.addEventListener("keydown", this._onKeydown);
        this.addEventListener("input", this._onInput);
        // The question put in place of what was pressed (a row's delete): the
        // pressed control is gone, so the focus fell to the page. It goes to
        // the safe answer once the answers are drawn (decision C25). A
        // question printed with the page, before the person did anything,
        // takes nothing.
        if (this.shownState === "open" && focusWasLost(this.ownerDocument)) {
            this.whenRendered(() => {
                if (focusWasLost(this.ownerDocument)) this.focusSafeAnswer();
            });
        }
    }

    onDisconnected() {
        this.removeEventListener("keydown", this._onKeydown);
        this.removeEventListener("input", this._onInput);
        this._answersObserver?.disconnect();
        this._answersObserver = null;
        this._watchedActions = null;
        super.onDisconnected?.();
    }

    // Escape takes the question back, as the declining answer does. In a page
    // the key goes no further, so a drawer around the row stays open. In a
    // window (sf-modal) the question is the window's: the decline is reported
    // and the key goes on to the window, which closes -- a host that never sets
    // an outcome no longer leaves the window standing with its answers greyed
    // (recipes gaps acceptance D4, 2026-11-10). A host that refuses the answer
    // (cancels the answer event) keeps both: the question stands.
    onKeydown(event) {
        // Enter in the name's field accepts once the name is typed, and
        // explains when it is not.
        if (event.key === "Enter" && !event.defaultPrevented && this.requireField?.contains(event.target)) {
            event.preventDefault();
            this.confirm();
            return;
        }
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (this.shownState !== "open" || this.getProp("disabled")) return;
        const result = this.cancel();
        if (result?.outcome === "applied" && inWindow(this)) return;
        event.preventDefault();
        event.stopPropagation();
    }
}

// The nearest surface around the question is a window's panel (sf-modal draws
// it in a portal at the end of the body; the Modal class in place), not a
// drawer, a popover or a list inside the window, whose Escape is their own,
// and not an inline window, which takes no Escape.
const SURFACES = "[data-sf-modal-panel], .sf-drawer-panel, sf-drawer, sf-popover, sf-dropdown";
function inWindow(node) {
    const surface = node.parentElement?.closest(SURFACES);
    return Boolean(surface?.matches("[data-sf-modal-panel]") && !surface.closest('[data-sf-modal-display="inline"]'));
}

// The focus is nowhere -- on the page itself -- after the person has acted on
// it: the control they pressed left the page.
function focusWasLost(document) {
    const active = document?.activeElement;
    const nowhere = !active || active === document.body || active === document.documentElement;
    return nowhere && globalThis.navigator?.userActivation?.hasBeenActive === true;
}

SfConfirm.define("sf-confirm");
