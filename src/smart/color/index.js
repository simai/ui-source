import SfBaseElement from '../../core/js/smart-base';
import {pageText} from '../../core/js/page-language';
import {renderColorTemplate} from './js/templates/default';

// A colour, for anywhere a colour is set: a theme, a site's own look, a label, a
// chart series. It was built because the property set had no colour at all while a
// running Larena site declares fourteen of them, but nothing here is about a
// property view -- it is a control like a switch or a date.
//
// Two things it does that a bare `<input type="color">` does not. It can be
// **unset**, which is the state the site actually uses: a colour inherited from the
// theme until somebody chooses one, and returnable to that. And it offers the
// colours a product already has, as swatches, so a person picks «the brand colour»
// rather than matching a hex by eye.
const COLOR_TEXT = {
    en: {choose: "Choose a colour", clear: "Use the inherited colour", inherited: "inherited", custom: "Custom"},
    ru: {choose: "Выбрать цвет", clear: "Вернуть унаследованный", inherited: "наследуется", custom: "Свой"},
};

// #abc, #aabbcc and #aabbccdd, which is what a person pastes and what a store
// keeps. Anything else is not a colour this control will claim to hold.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

const normalise = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const hash = text.startsWith("#") ? text : `#${text}`;
    return HEX.test(hash) ? hash.toLowerCase() : "";
};

class SfColor extends SfBaseElement {
    static get props() {
        return {
            templateName: {attribute: "template", default: "default"},
            value: {default: ""},
            size: {default: "1", values: ["1/2", "1", "2"]},
            appearance: {default: "bordered", values: ["bordered", "outlined", "plain"]},
            swatches: {default: ""},
            inheritedValue: {attribute: "inherited-value", default: ""},
            clearable: {type: Boolean, default: false},
            disabled: {type: Boolean, default: false},
            name: {default: ""},
            label: {default: ""},
            chooseLabel: {attribute: "choose-label", default: ""},
            clearLabel: {attribute: "clear-label", default: ""},
            inheritedText: {attribute: "inherited-text", default: ""},
        };
    }

    static get observedAttributes() {
        return [...(super.observedAttributes ?? []), "value", "inherited-value", "swatches", "disabled"];
    }

    attributeChangedCallback(name, previous, next) {
        super.attributeChangedCallback?.(name, previous, next);
        if (previous !== next && this.isConnected) this.requestComponentUpdate("attribute");
    }

    get value() {
        return normalise(this.getAttribute("value"));
    }

    get size() {
        return this.getAttribute("size") || "1";
    }

    get appearance() {
        return this.getAttribute("appearance") || "bordered";
    }

    get disabled() {
        return this.hasAttribute("disabled");
    }

    get clearable() {
        return this.hasAttribute("clearable");
    }

    get name() {
        return this.getAttribute("name") || "";
    }

    get label() {
        return this.getAttribute("label") || "";
    }

    // What the colour falls back to while nothing is chosen. Shown rather than
    // guessed: a control that drew the inherited colour as if it were the value
    // would make «not set» and «set to the same colour» look identical, and only
    // one of them follows the theme when the theme changes.
    get inheritedValue() {
        return normalise(this.getAttribute("inherited-value"));
    }

    get inheritedText() {
        return this.getAttribute("inherited-text") || pageText(COLOR_TEXT, "inherited", this);
    }

    get chooseLabel() {
        return this.getAttribute("choose-label") || pageText(COLOR_TEXT, "choose", this);
    }

    get clearLabel() {
        return this.getAttribute("clear-label") || pageText(COLOR_TEXT, "clear", this);
    }

    get customText() {
        return pageText(COLOR_TEXT, "custom", this);
    }

    // The colours a product already has. A comma separated list, each one a hex,
    // optionally `#hex|Name` so a swatch can say what it is. A name may hold
    // spaces («#1f6feb|Brand blue»): splitting on spaces too cut it into a swatch
    // named «Brand» and a word that is not a colour. A piece without a name may
    // still list several colours by spaces, as the first lists did.
    get swatchList() {
        return String(this.getAttribute("swatches") || "")
            .split(",")
            .flatMap((piece) => (piece.includes("|") ? [piece.trim()] : piece.trim().split(/\s+/u)))
            .filter(Boolean)
            .map((entry) => {
                const [color, ...rest] = entry.split("|");
                const hex = normalise(color);
                const name = rest.join("|").trim();
                return hex ? {value: hex, name: name || hex} : null;
            })
            .filter(Boolean);
    }

    // What is painted now: the value when there is one, the inherited colour when
    // there is not.
    get shown() {
        return this.value || this.inheritedValue || "";
    }

    get isSet() {
        return Boolean(this.value);
    }

    setValue(next) {
        const changed = this._write(next);
        this._commit();
        return changed;
    }

    // `input` while the value moves (a drag across the platform picker), `change`
    // once when it is committed. The picker fires its own input on every step of a
    // drag, so a change per input was a change per pixel.
    _write(next) {
        const value = normalise(next);
        if (value === this.value) return false;
        if (value) this.setAttribute("value", value);
        else this.removeAttribute("value");
        this.requestComponentUpdate("value");
        this._emit("input");
        return true;
    }

    _commit() {
        const value = this.value;
        if (value === (this._committed ?? normalise(this._initialValue))) return;
        this._committed = value;
        this._emit("change");
    }

    _emit(type) {
        this.dispatchEvent(new CustomEvent(type, {
            bubbles: true,
            composed: true,
            detail: {value: this.value, name: this.name},
        }));
    }

    connectedCallback() {
        if (this._initialValue === undefined) this._initialValue = this.getAttribute("value") ?? "";
        super.connectedCallback?.();
    }

    // The platform picker's own events. Its input moves the value; its change
    // commits it. Its change also bubbles out of the host as a plain Event with no
    // detail, a second change for every one this dispatches, so it stops here.
    _pickerInput(event) {
        event.stopPropagation();
        this._write(event.target.value);
    }

    _pickerChange(event) {
        event.stopPropagation();
        this._write(event.target.value);
        this._commit();
    }

    clear() {
        return this.setValue("");
    }

    templateContext() {
        return this.createTemplateContext({
            ...this.getPropsContext(),
            component: this,
            value: this.value,
            shown: this.shown,
            isSet: this.isSet,
            inheritedValue: this.inheritedValue,
            inheritedText: this.inheritedText,
            chooseLabel: this.chooseLabel,
            clearLabel: this.clearLabel,
            customText: this.customText,
            swatchList: this.swatchList,
            clearable: this.clearable,
            disabled: this.disabled,
            size: this.size,
            appearance: this.appearance,
            name: this.name,
            label: this.label,
        });
    }

    template() {
        return renderColorTemplate(this.templateContext());
    }
}

SfColor.define("sf-color");

export {SfColor};
