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
import {elementFromManifest} from "../../core/js/element-manifest";
import {confirmSurface} from "../helpers/confirm-surface.js";
import {noteDeprecated} from "../../core/js/deprecations";
import {renderConfirmTemplate} from "./js/templates/default.js";
import manifest from "./component.json";
import en from "./lang/en.json";
import ru from "./lang/ru.json";

const ConfirmElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: "ru",
});

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

    // A declined question says nothing (owner decision C35, remark R067):
    // «Отмена» changed nothing, so there is nothing to report -- no
    // «Отменено» under the row, in a window or anywhere. The host puts the
    // row back and the focus on what was pressed.
    statusText(shown) {
        return shown === "declined" ? "" : super.statusText(shown);
    }

    templateContext() {
        const question = this.getProp("question") || "";
        return {
            ...this.confirmContext(),
            question,
            questionLabel: this.sfWord("question-label"),
            appearance: this.getProp("appearance") === "card" ? "card" : "inline",
            danger: this.danger,
        };
    }

    template() {
        return renderConfirmTemplate(this.templateContext());
    }

    onConnected() {
        super.onConnected?.();
        this.addEventListener("keydown", this._onKeydown);
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
        super.onDisconnected?.();
    }

    // Escape takes the question back, as the declining answer does; the key
    // goes no further, so a drawer or a window around the row stays open.
    onKeydown(event) {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (this.shownState !== "open" || this.getProp("disabled")) return;
        event.preventDefault();
        event.stopPropagation();
        this.cancel();
    }
}

// The focus is nowhere -- on the page itself -- after the person has acted on
// it: the control they pressed left the page.
function focusWasLost(document) {
    const active = document?.activeElement;
    const nowhere = !active || active === document.body || active === document.documentElement;
    return nowhere && globalThis.navigator?.userActivation?.hasBeenActive === true;
}

SfConfirm.define("sf-confirm");
