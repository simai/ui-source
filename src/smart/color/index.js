import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {InheritedValueField} from '../helpers/inherited-value';
import {FormField} from '../helpers/form-field';
import {renderColorTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

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
//
// Built from its component.json (standard simai.smart-component 1.3.8 §3, §4,
// §11, §16.20, §17.1): the settings are attributes and properties made by
// core/js/element-manifest.js, the words are lang/<locale>.json (the trait's
// words with them), and the host is the form control through ElementInternals.
const ColorElement = elementFromManifest(manifest, {
    base: InheritedValueField(SfBaseElement),
    lang: {en, ru},
    source: "ru",
    aliases,
    actions: {
        // §4.4: an outcome. Nothing to clear is refused, not an error.
        clear() {
            return this.setValue("") ? "applied" : "unchanged";
        },
    },
});

// #abc, #aabbcc and #aabbccdd, which is what a person pastes and what a store
// keeps. Anything else is not a colour this control will claim to hold.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

const normalise = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const hash = text.startsWith("#") ? text : `#${text}`;
    return HEX.test(hash) ? hash.toLowerCase() : "";
};

class SfColor extends FormField(ColorElement) {
    static get props() {
        return {
            ...super.props,
            templateName: {attribute: "template", default: "default"},
            // The trait field-inherit@1 (§20.2): its settings until the build
            // merges a trait's interface.
            inheritedValue: {attribute: "inherited-value", default: ""},
            inheritedText: {attribute: "inherited-text", default: ""},
            resetLabel: {attribute: "reset-label", default: ""},
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

    // Written from code, the value is not a change: no event, as for a native
    // field (§8).
    set value(next) {
        const value = normalise(next);
        if (value) this.setAttribute("value", value);
        else this.removeAttribute("value");
        this._committed = value;
        this.requestComponentUpdate("value");
        this.sfSyncFormState();
    }

    // What the colour falls back to while nothing is chosen. Shown rather than
    // guessed: a control that drew the inherited colour as if it were the value
    // would make «not set» and «set to the same colour» look identical, and only
    // one of them follows the theme when the theme changes.
    get inheritedValue() {
        return normalise(this.getAttribute("inherited-value"));
    }

    get inheritedText() {
        return this.getAttribute("inherited-text") || this.sfWord("inherited");
    }

    // The reset back to the inherited colour is the shared one (simai/ui-source#28):
    // `reset-label` names it, and `clear-label`, its first name, still does.
    get resetLabel() {
        return this.getAttribute("reset-label") || this.getAttribute("clear-label")
            || this.sfWord("reset");
    }

    // What a screen reader hears beside the name while the value is inherited,
    // in the element's language (§11.1).
    inheritedDescription() {
        return this.sfWord("described", {vars: {value: this.inheritedDisplayValue()}});
    }

    // The inherited-value seam: the colour is the value, the platform picker's
    // input takes focus and carries the description.
    inheritedOwnValue() {
        return this.value;
    }

    inheritedFocusTarget() {
        return this.querySelector(".sf-color-input");
    }

    // clear() says it as input and change, the way a swatch does.
    clearOwnValue() {
        this.clear();
    }

    afterRender() {
        this.syncInheritedState();
        this.sfSyncFormState();
    }

    get customText() {
        return this.sfWord("custom");
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
    // there is not (§4.3). It was `shown`, which is the base value of every
    // element now (§4.1): whether it has a box in an opened container.
    get effectiveValue() {
        return this.value || this.inheritedValue || "";
    }

    // What the form gets (§17.1): the hex, empty while the inherited colour
    // applies (§20.2), nothing while disabled.
    sfFormValue() {
        if (this.disabled) return null;
        return this.value;
    }

    // form.reset(): back to the colour the element was written with, without
    // events (§17.1 item 4).
    fieldReset() {
        const initial = normalise(this._initialValue);
        if (initial) this.setAttribute("value", initial);
        else this.removeAttribute("value");
        this._committed = initial;
        this.requestComponentUpdate("value");
        this.syncInheritedState();
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
        this.sfSyncFormState();
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
        this.sfEmit(type, {value: this.value, name: this.name});
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

    templateContext() {
        return this.createTemplateContext({
            ...this.getPropsContext(),
            component: this,
            value: this.value,
            painted: this.effectiveValue,
            isSet: this.isSet,
            inheritedValue: this.inheritedValue,
            inheritedText: this.inheritedText,
            hasInheritedValue: this.hasInheritedValue,
            chooseLabel: this.chooseLabel,
            clearLabel: this.clearLabel,
            customText: this.customText,
            swatchList: this.swatchList,
            clearable: this.clearable,
            disabled: this.disabled,
            size: this.size,
            appearance: this.appearance,
            name: this.name,
            // The host is the form control where the browser has
            // ElementInternals; the hidden input is drawn only without them.
            hiddenName: this.sfInternals ? "" : this.name,
            label: this.label,
        });
    }

    template() {
        return renderColorTemplate(this.templateContext());
    }
}

SfColor.define("sf-color");

export {SfColor};
