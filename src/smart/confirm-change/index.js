// A change somebody prepared and nobody has applied yet, put to a person to
// confirm or decline: what each value was, what it will be, two answers of equal
// weight and, when the offer runs out, until when.
//
// It began in simai/ui-chat as the assistant's «proposal» card -- a function,
// renderProposal, and a set of .sf-chat-proposal rules -- and was promoted here
// as an element (owner, 2026-10-25), because the same question is asked outside
// an assistant: a colleague proposing an edit in a people's chat (simai.chat), a
// moderation queue, an import that wants a yes before it writes. What was
// assistant-only in it is gone: it knows no command text, no code format and no
// server. A press is reported as an event and the host decides what it means.
//
// The element never applies anything. A press moves it to `pending`, which
// takes both answers away so that nothing is pressed twice, and says what is
// happening; the host then sets the outcome -- `accepted`, `declined`, or back
// to `open` when the answer could not be delivered. Once settled, the card keeps
// only its outcome: no buttons that can no longer mean anything. That behaviour
// is the confirm surface it shares with the plain sf-confirm
// (../helpers/confirm-surface.js); this element adds the values.
//
// In SIMAI Framework since 1.4.0 (owner decision 2026-11-03, component sets,
// point 13; duplication audit A-5): the question is general, so the chat, view
// and admin sets compose it instead of one set owning it. Same tag, same
// public API; the Pro package no longer carries it.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8,
// §11, §19.4): the settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json, the actions
// answer outcomes, and the person's answer is the vocabulary's `answer {id,
// accepted}`; the old names sf-change-confirm-accept, -decline and -expire
// follow until 2026-12-01 (aliases.json). Since 1.8.0 its classes carry its
// own name, .sf-confirm-change__*, and its public variables
// --sf-confirm-change-*; the former .sf-change-confirm* classes are written
// beside them and the former variables read under them until 2027-01-01. It is a confirm surface in the §19.4
// sense: an assembly's `ask` opens it and waits for the answer.
//
// It renders into its own light DOM, like every Smart component: a document
// stylesheet does not cross a shadow boundary.
import SfBaseElement from "../../core/js/smart-base";
import {elementFromManifest} from "../../core/js/element-manifest";
import {noteDeprecated} from "../../core/js/deprecations";
import {confirmSurface} from "../helpers/confirm-surface.js";
import {renderChangeConfirmTemplate} from "./js/templates/default.js";
import {calendarDayOffset} from "../../core/js/format-date.js";
import {html} from "lit";
import manifest from "./component.json";
import aliases from "./aliases.json";
import enFile from "./lang/en.json";
import ruFile from "./lang/ru.json";
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};

const ChangeConfirmElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: "ru",
    aliases,
});

const ConfirmSurface = confirmSurface(ChangeConfirmElement, {
    kind: "sf-confirm-change",
    block: "sf-confirm-change",
    answerId: "changeId",
});

class SfChangeConfirm extends ConfirmSurface {
    static get props() {
        return {
            ...super.props,
            templateName: {attribute: "template", default: "default"},
            // The list is a property (the usual case: a host has objects) or
            // the `changes` attribute in JSON (markup, the Studio).
            changes: {attribute: "changes", type: Array, default: []},
        };
    }

    constructor() {
        super();
        this._changes = null;
        // A value set as a property before the element was defined is an own
        // property that would hide the accessor; it is taken through it.
        if (Object.prototype.hasOwnProperty.call(this, "changes")) {
            const early = this.changes;
            delete this.changes;
            this.changes = early;
        }
    }

    // A property wins over the attribute, which is read through the base's
    // declared prop.
    get changes() {
        const value = this._changes ?? this.getProp("changes");
        return Array.isArray(value) ? value : [];
    }

    set changes(value) {
        this._changes = Array.isArray(value) ? value.map((change) => ({...change})) : null;
        this.requestComponentUpdate("changes");
    }

    templateContext() {
        return {
            ...this.confirmContext(),
            changes: this.changes,
            changesLabel: this.sfWord("changes-label"),
            beforeText: this.sfWord("before-text"),
            afterText: this.sfWord("after-text"),
            emptyValueText: this.sfWord("empty-value-text"),
            // What the acceptance does (decision C25, DEV change-time study
            // CT-4): status="danger" for a delete or anything that cannot be
            // undone, as sf-confirm's setting.
            danger: this.getAttribute("status") === "danger",
        };
    }

    template() {
        return renderChangeConfirmTemplate(this.templateContext());
    }

    // The deadline is an sf-time (DEV change-time study CT-12; owner decision
    // C183 (4)): «Подтвердить можно до 23:30» today, «… до завтра, 10:00»,
    // «… до 17 ноября, 10:00» later, with the exact moment and its zone in
    // the tooltip. The words around the time are the language file's
    // until-text; the time stands where its {time} is.
    statusText(shown) {
        const until = this.getAttribute("expires-at");
        if (shown !== "open" || !until || !Number.isFinite(Date.parse(until))) return super.statusText(shown);
        const [before, after = ""] = this.sfWord("until-text", {vars: {time: "\u0000"}}).split("\u0000");
        const today = calendarDayOffset(until) === 0;
        return html`${before}<sf-time class="sf-confirm-change__until" datetime=${until}
            format=${today ? "time" : "auto"} threshold="PT0S"></sf-time>${after}`;
    }

    // answer("accept") and answer("decline") were the 1.0 form; read until the
    // aliases' day and noted, so a host sees what it still leans on.
    readAnswer(params) {
        const read = super.readAnswer(params);
        if (read !== null) return read;
        const kind = typeof params === "string" ? params : params?.accepted;
        if (kind === "accept" || kind === "decline") {
            noteDeprecated({
                component: "sf-confirm-change", tag: "sf-confirm-change", kind: "action",
                from: `answer("${kind}")`, to: `answer({accepted: ${kind === "accept"}})`,
                since: aliases.since, remove_after: aliases.remove_after,
            });
            return kind === "accept";
        }
        return null;
    }
}

SfChangeConfirm.define("sf-confirm-change");
