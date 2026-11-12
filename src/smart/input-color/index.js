import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark';
import BundledPosition from '../../core/js/position.js';
import {InheritedValueField} from '../helpers/inherited-value';
import {FormField} from '../helpers/form-field';
import {renderColorTemplate} from './js/templates/default';
import {
    PALETTE, FORMATS, clamp, darkInk, formatColour, hsvToRgb, isPaletteName, normaliseHex, parseColour,
    parseHex, rgbToHsv, statesAlpha, toHex,
} from './js/color-math.js';
import {RECENT_SHOW, onRecentChange, recentColours, rememberColour} from './js/recent.js';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// A colour, for anywhere a colour is set: a theme, a site's own look, a label, a
// chart series. It was built because the property set had no colour at all while a
// running Larena site declares fourteen of them, but nothing here is about a
// property view -- it is a control like a switch or a date.
//
// Since 1.7.0 (owner decision C83, 2026-11-12) it is a field of the control
// ladder -- a swatch, the value and a chevron -- that opens the Framework's own
// compact window, never the browser's colour dialog, which looked different in
// every browser (R130). The window shows the static palette first («Палитра»)
// and, unless `custom` is off, «Своё»: a shade area, an eyedropper where the
// browser has one, the hue and alpha strips and one row «format | code | %».
// On a phone it is a sheet at the bottom of the screen.
//
// The value is a palette name (`blue`: one word in every language, painted in
// the tone the theme picks) or the code of an own colour (`#rrggbb`, or
// `#rrggbbaa` with `alpha`). It can be **unset**, which is the state a site
// actually uses: a colour inherited from the theme until somebody chooses one.
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

// Core publishes the helper; a bundle loaded without core.js positions with
// its own copy.
const position = () => globalThis.SF?.Position || BundledPosition;

// On a phone -- below the md breakpoint, where core declares
// --sf-breakpoint-md -- the window is a sheet at the bottom of the screen, as
// a form of sf-menu-context and the link editor of sf-input-rich are (C32).
const onPhone = (doc) => !doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--sf-breakpoint-md').trim();

// How long a moving colour rests before the page theme follows it.
const THEME_DEBOUNCE = 120;
// How long a key held on a strip or in a number field rests before it commits.
const KEY_COMMIT = 400;

// The value: a palette name, or a hex (#rgb and #rgba are read and stored long,
// lowercase; an opaque #rrggbbff is #rrggbb). Anything else is not a colour
// this control will claim to hold.
const normalise = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    if (isPaletteName(lower)) return lower;
    return normaliseHex(text.startsWith("#") ? text : `#${text}`);
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
        return [...(super.observedAttributes ?? []), "value", "inherited-value", "swatches", "disabled", "aria-label",
            "palette", "custom", "alpha"];
    }

    attributeChangedCallback(name, previous, next) {
        super.attributeChangedCallback?.(name, previous, next);
        if (previous !== next && this.isConnected) this.requestComponentUpdate("attribute");
    }

    get value() {
        return this._accept(normalise(this.getAttribute("value")));
    }

    // Written from code, the value is not a change: no event, as for a native
    // field (§8).
    set value(next) {
        const value = this._accept(normalise(next));
        if (value) this.setAttribute("value", value);
        else this.removeAttribute("value");
        this._committed = value;
        this.requestComponentUpdate("value");
        this.sfSyncFormState();
    }

    // A value the field cannot hold is not its value: without `alpha` a
    // translucent code keeps its colour and drops the alpha, as the window
    // would have drawn it.
    _accept(value) {
        if (!value || isPaletteName(value)) return value;
        return this.alpha && !this.isTheme ? value : value.slice(0, 7);
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

    // A palette colour reads as its word, an own colour as its code.
    inheritedDisplayValue() {
        return this.colourName(this.inheritedValue);
    }

    /** What a value reads as: the palette colour's word in the element's language, or the code. */
    colourName(value) {
        if (!value) return "";
        return isPaletteName(value) ? this.sfWord(`hue-${value}`) : value;
    }

    // The inherited-value seam: the colour is the value, the field's trigger
    // takes focus and carries the description.
    inheritedOwnValue() {
        return this.value;
    }

    inheritedFocusTarget() {
        return this.querySelector(".sf-color-trigger");
    }

    // clear() says it as input and change, the way a swatch does.
    clearOwnValue() {
        this.clear();
    }

    afterRender() {
        this.syncInheritedState();
        this.sfSyncFormState();
        // A value written from code (a page restoring the colour it kept) takes
        // the theme silently; a drag waits for its debounce.
        if (this.isTheme && this._themeTimer == null) this._applyTheme();
        if (this._open) this._placeWindow();
    }

    // ---------------------------------------------------------- variant theme
    //
    // The page theme from the colour (owner decision by delegation, 2026-10-28:
    // a variant of sf-input-color, not a separate component; C84, 2026-11-12:
    // the brand colour is this mode of the field). Its trigger is only a circle
    // of the current colour, as a site header holds it, and it opens the same
    // window as the field at its normal size. The value is a code: the theme is
    // computed from it. The theme is SF.ThemePalette, fetched through the
    // Loader the first time a theme control draws: it is larger than this
    // control and a field-variant colour has no use for it.

    get isTheme() {
        return this.variant === "theme";
    }

    get themeLabel() {
        return this.label || this.getAttribute("aria-label") || this.sfWord("theme");
    }

    get themeResetLabel() {
        return this.getAttribute("clear-label") || this.sfWord("theme-reset");
    }

    _palette() {
        const palette = globalThis.SF?.ThemePalette;
        if (palette?.applyTheme) return palette;
        if (!this._paletteAsked) {
            this._paletteAsked = true;
            const ready = () => {
                this._applyTheme();
                this.requestComponentUpdate("palette");
            };
            globalThis.addEventListener?.("theme-palette:ready", ready, {once: true});
            globalThis.SF?.Loader?.ensurePlugin?.("theme-palette");
        }
        return null;
    }

    // The colour on <html>: the previous application is taken off first, so the
    // restore that is kept always returns the page to what it had before this
    // control touched it. An empty value is that restore.
    _applyTheme() {
        const palette = this._palette();
        if (!palette) return;
        const color = this.value;
        if (color === this._appliedColor) return;
        this._restoreTheme?.();
        this._restoreTheme = null;
        // A palette name written from code is its tone's code.
        const seed = isPaletteName(color) ? this._paletteHex(color, {seed: true}) : color;
        if (seed && palette.isThemeColor(seed)) {
            this._restoreTheme = palette.applyTheme(palette.themeFromColor(seed));
        }
        this._appliedColor = color;
    }

    _scheduleTheme(delay) {
        if (!this.isTheme) return;
        clearTimeout(this._themeTimer);
        this._themeTimer = null;
        if (!delay) {
            this._applyTheme();
            return;
        }
        this._themeTimer = setTimeout(() => {
            this._themeTimer = null;
            this._applyTheme();
        }, delay);
    }

    get themeColor() {
        return this.value || this.inheritedValue
            || globalThis.SF?.ThemePalette?.DEFAULT_THEME_COLOR || "";
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        // The theme stays: the page chose it. Only the pending work goes.
        clearTimeout(this._themeTimer);
        this._themeTimer = null;
        this._closeQuietly();
        this._recentOff?.();
        this._recentOff = null;
    }

    // The colours a product already has. A comma separated list, each one a hex,
    // optionally `#hex|Name` so a swatch can say what it is. A name may hold
    // spaces («#1f6feb|Brand blue»): splitting on spaces too cut it into a swatch
    // named «Brand» and a word that is not a colour. A piece without a name may
    // still list several colours by spaces, as the first lists did. A palette
    // name is a swatch of its own too (`blue|Фирменный`).
    get swatchList() {
        return String(this.getAttribute("swatches") || "")
            .split(",")
            .flatMap((piece) => (piece.includes("|") ? [piece.trim()] : piece.trim().split(/\s+/u)))
            .filter(Boolean)
            .map((entry) => {
                const [color, ...rest] = entry.split("|");
                const value = this._accept(normalise(color));
                const name = rest.join("|").trim();
                return value ? {value, name: name || this.colourName(value)} : null;
            })
            .filter(Boolean);
    }

    // What is painted now: the value when there is one, the inherited colour when
    // there is not (§4.3). It was `shown`, which is the base value of every
    // element now (§4.1): whether it has a box in an opened container.
    get effectiveValue() {
        return this.value || this.inheritedValue || "";
    }

    // What the form gets (§17.1): the name or the code, empty while the
    // inherited colour applies (§20.2), nothing while disabled.
    sfFormValue() {
        if (this.disabled) return null;
        return this.value;
    }

    // form.reset(): back to the colour the element was written with, without
    // events (§17.1 item 4).
    fieldReset() {
        const initial = this._accept(normalise(this._initialValue));
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

    // `input` while the value moves (a drag across the shade area), `change`
    // once when it is committed: a change per input was a change per pixel.
    _write(next) {
        const value = this._accept(normalise(next));
        if (value === this.value) return false;
        if (value) this.setAttribute("value", value);
        else this.removeAttribute("value");
        this.requestComponentUpdate("value");
        this.sfSyncFormState();
        this._emit("input");
        this._scheduleTheme(THEME_DEBOUNCE);
        return true;
    }

    _commit() {
        const value = this.value;
        this._scheduleTheme(0);
        if (value === (this._committed ?? this._accept(normalise(this._initialValue)))) return;
        this._committed = value;
        this._emit("change");
    }

    _emit(type) {
        this.sfEmit(type, {value: this.value, name: this.name});
    }

    connectedCallback() {
        if (this._initialValue === undefined) this._initialValue = this.getAttribute("value") ?? "";
        super.connectedCallback?.();
        this._recentOff ??= onRecentChange(() => {
            if (this._open) this.requestComponentUpdate("recent");
        });
    }

    // ---------------------------------------------------------------- the window

    // The sixteen hues, unless `palette="false"`.
    get showsHues() {
        return this.palette !== false;
    }

    // «Палитра» is there while it has something to choose from: the hues or
    // the product's own colours.
    get offersPalette() {
        return this.showsHues || this.swatchList.length > 0;
    }

    // «Своё» is there unless the product turned it off -- and always when there
    // is no palette to choose from.
    get offersCustom() {
        return this.custom !== false || !this.offersPalette;
    }

    // A palette colour's code, read from the page's own token (the tone the
    // theme paints it in), for «Своё» to start from and for the theme variant,
    // whose value is a code.
    _resolveColour(css) {
        const doc = this.ownerDocument;
        const probe = doc.createElement("span");
        probe.style.cssText = "display:none";
        probe.style.color = css;
        this.append(probe);
        const read = doc.defaultView?.getComputedStyle(probe).color || "";
        probe.remove();
        return cssRgb(read);
    }

    // The tone the field paints (50 light, 70 dark), or with `seed` tone 50 in
    // either theme: the seed of a page theme must not depend on the theme the
    // page happens to show.
    _paletteHex(name, {seed = false} = {}) {
        const rgb = (!seed && this._resolveColour(`light-dark(var(--sf-${name}-50), var(--sf-${name}-70))`))
            || this._resolveColour(`var(--sf-${name}-50)`);
        return rgb ? toHex(rgb.rgb) : "";
    }

    // Any CSS colour a developer pastes (oklch(), a name), asked of the page.
    _cssColour(text) {
        if (!globalThis.CSS?.supports?.("color", text)) return null;
        return this._resolveColour(text);
    }

    // The own colour the window edits: hue, saturation, brightness and alpha.
    _seed(value) {
        let parsed = parseHex(value);
        if (!parsed && isPaletteName(value)) parsed = parseHex(this._paletteHex(value));
        if (!parsed) parsed = parseHex(this._paletteHex("blue")) || {rgb: [0, 91, 190], a: 1};
        const [h, s, v] = rgbToHsv(parsed.rgb);
        // A grey has no hue of its own: the strip keeps the hue it had.
        this._hsv = [s > 0 ? h : (this._hsv?.[0] ?? h), s, v];
        this._alphaValue = this.alpha ? parsed.a : 1;
    }

    get ownColour() {
        const [h, s, v] = this._hsv || [0, 0, 0];
        return toHex(hsvToRgb(h, s, v), this.alpha ? this._alphaValue ?? 1 : 1);
    }

    get isOpen() {
        return Boolean(this._open);
    }

    /** Opens the window, on the view the value comes from. Returns whether it is open. */
    openPicker() {
        if (this.disabled || this._open) return Boolean(this._open);
        const value = this.value || this.inheritedValue;
        this._seed(value);
        this._format ??= "hex";
        this._codeError = "";
        this._view = this.offersCustom && (!this.offersPalette || (value && !isPaletteName(value)
            && !this.swatchList.some((swatch) => swatch.value === value)))
            ? "own" : "palette";
        this._open = true;
        holdOpenSurfaceMark(this, true, {
            root: () => this.querySelector(".sf-color-window"),
            onOutsidePress: () => this.closePicker({reason: "outside", restoreFocus: false}),
            onEscape: () => {
                if (!isTopOpenSurface(this)) return false;
                if (this._formatOpen) {
                    this._closeFormatMenu(true);
                    return true;
                }
                this.closePicker({reason: "escape", restoreFocus: true});
                return true;
            },
        });
        this._onViewport ??= () => {
            if (this._open && this._sheetMode !== onPhone(this.ownerDocument)) this._placeWindow(true);
        };
        globalThis.addEventListener("resize", this._onViewport);
        this.requestComponentUpdate("open");
        this.whenRendered?.(() => this._focusWindow(), {next: true});
        return true;
    }

    /** Closes the window. Returns whether it is closed. */
    closePicker({reason = "api", restoreFocus = true} = {}) {
        if (!this._open) return true;
        this._closeQuietly();
        this.requestComponentUpdate("open");
        if (restoreFocus) this.querySelector(".sf-color-trigger")?.focus({preventScroll: true});
        this._lastClose = {reason, at: Date.now()};
        return true;
    }

    togglePicker() {
        return this._open ? !this.closePicker({reason: "close"}) : this.openPicker();
    }

    _closeQuietly() {
        if (!this._open) return;
        this._open = false;
        this._formatOpen = false;
        clearTimeout(this._keyTimer);
        if (this._pendingCommit) this._commitOwn();
        holdOpenSurfaceMark(this, false);
        globalThis.removeEventListener("resize", this._onViewport);
        this._stopPlacing();
    }

    // Anchored under the field on a desktop (core's one positioning contract:
    // flip, shift, never taller than the room it has), lifted into the top
    // layer so no box of the page clips it; on a phone a sheet at the bottom.
    _placeWindow(force = false) {
        const panel = this.querySelector(".sf-color-window");
        const anchor = this.querySelector(".sf-color-frame, .sf-color-dot");
        if (!panel || !anchor) return;
        const sheet = onPhone(this.ownerDocument);
        if (!force && this._placed?.panel === panel && this._sheetMode === sheet) {
            this._placed.update?.();
            return;
        }
        this._stopPlacing();
        this._sheetMode = sheet;
        if (sheet) {
            panel.setAttribute("data-sf-sheet", "");
            const lower = position().liftToTopLayer?.(panel) ?? null;
            this._placed = {panel, stop: () => lower?.()};
            return;
        }
        panel.removeAttribute("data-sf-sheet");
        const placed = position().anchor(anchor, panel, {side: "block-end", align: "start", fitHeight: true, autoUpdate: true});
        this._placed = {panel, stop: () => placed.stop(), update: () => placed.update()};
    }

    _stopPlacing() {
        const placed = this._placed;
        this._placed = null;
        placed?.stop?.();
        placed?.panel?.removeAttribute("data-sf-sheet");
        this._sheetMode = undefined;
    }

    _focusWindow() {
        if (!this._open) return;
        const panel = this.querySelector(".sf-color-window");
        const target = this._view === "own"
            ? panel?.querySelector(".sf-color-area")
            : panel?.querySelector('.sf-color-option[aria-checked="true"]')
                || panel?.querySelector('.sf-color-option[tabindex="0"]');
        (target || panel)?.focus?.({preventScroll: true});
    }

    showView(view) {
        if (!this._open || view === this._view || (view === "own" && !this.offersCustom)
            || (view === "palette" && !this.offersPalette)) return;
        this._view = view;
        if (view === "own") this._seed(this.value || this.inheritedValue);
        this.requestComponentUpdate("view");
        this.whenRendered?.(() => {
            if (view === "own") this.querySelector(".sf-color-area")?.focus({preventScroll: true});
        }, {next: true});
    }

    // A palette colour, a product colour or a recent one: chosen and committed
    // at once. A press closes the window; an arrow key moves the choice and
    // keeps it open, as a radio group does.
    pick(value, {close = true, own = false} = {}) {
        let next = normalise(value);
        if (this.isTheme && isPaletteName(next)) next = this._paletteHex(next, {seed: true});
        if (own) rememberColour(next);
        this.setValue(next);
        if (close) this.closePicker({reason: "select"});
    }

    // ------------------------------------------------------------ «Своё»

    _moved() {
        this._codeError = "";
        if (this.ownerDocument.activeElement?.classList?.contains("sf-color-code") !== true) this._typing = false;
        this._write(this.ownColour);
        this._pendingCommit = true;
    }

    _commitOwn() {
        this._pendingCommit = false;
        rememberColour(this.value);
        this._commit();
    }

    // The shade area and the strips follow the pointer from the press to the
    // release; the release commits.
    dragOn(event, kind) {
        if (this.disabled || event.button > 0) return;
        const target = event.currentTarget;
        event.preventDefault();
        target.setPointerCapture?.(event.pointerId);
        target.focus?.({preventScroll: true});
        const move = (moved) => {
            const box = target.getBoundingClientRect();
            const x = clamp((moved.clientX - box.left) / (box.width || 1), 0, 1);
            const y = clamp((moved.clientY - box.top) / (box.height || 1), 0, 1);
            const [h, s, v] = this._hsv;
            if (kind === "area") this._hsv = [h, x, 1 - y];
            else if (kind === "hue") this._hsv = [x * 360, s, v];
            else this._alphaValue = Math.round(x * 100) / 100;
            this._moved();
        };
        const up = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
            this._commitOwn();
        };
        move(event);
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", up);
        target.addEventListener("pointercancel", up);
    }

    // Arrows move by one, Shift by ten; the colour commits once the key rests.
    keyOn(event, kind) {
        const step = event.shiftKey ? 10 : 1;
        const delta = {
            ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
            PageUp: [0, 10], PageDown: [0, -10],
        }[event.key];
        if (!delta) return;
        event.preventDefault();
        const [dx, dy] = delta;
        const [h, s, v] = this._hsv;
        if (kind === "area") this._hsv = [h, clamp(s + dx / 100, 0, 1), clamp(v + dy / 100, 0, 1)];
        else if (kind === "hue") this._hsv = [clamp(h + dx + dy, 0, 360), s, v];
        else this._alphaValue = clamp(Math.round(((this._alphaValue ?? 1) + (dx + dy) / 100) * 100) / 100, 0, 1);
        this._moved();
        clearTimeout(this._keyTimer);
        this._keyTimer = setTimeout(() => this._commitOwn(), KEY_COMMIT);
    }

    // The code field: read in the chosen format while typed, committed on
    // Enter or when the field is left. A colour the field cannot read says so
    // under the row and changes nothing.
    codeOn(event, commit) {
        const text = event.currentTarget.value;
        const parsed = parseColour(text, this._format, (css) => this._cssColour(css));
        this._codeDraft = text;
        this._typing = !commit || !parsed;
        if (!parsed) {
            this._codeError = text.trim() ? this.sfWord("not-a-colour", {vars: {format: FORMAT_WORD[this._format]}}) : "";
            this.requestComponentUpdate("code");
            return;
        }
        const [h, s, v] = rgbToHsv(parsed.rgb);
        this._hsv = [s > 0 ? h : this._hsv[0], s, v];
        if (this.alpha && statesAlpha(text)) this._alphaValue = parsed.a;
        this._moved();
        if (commit) this._commitOwn();
    }

    alphaOn(event, commit) {
        const field = event.currentTarget;
        const number = parseInt(field.value, 10);
        if (!Number.isFinite(number)) {
            if (commit) field.value = String(Math.round((this._alphaValue ?? 1) * 100));
            return;
        }
        this._alphaValue = clamp(number, 0, 100) / 100;
        this._moved();
        if (commit) {
            field.value = String(Math.round(this._alphaValue * 100));
            this._commitOwn();
        }
    }

    alphaKeyOn(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.alphaOn(event, true);
            return;
        }
        const direction = {ArrowUp: 1, ArrowDown: -1}[event.key];
        if (!direction) return;
        event.preventDefault();
        const next = clamp(Math.round((this._alphaValue ?? 1) * 100) + direction * (event.shiftKey ? 10 : 1), 0, 100);
        this._alphaValue = next / 100;
        event.currentTarget.value = String(next);
        this._moved();
        clearTimeout(this._keyTimer);
        this._keyTimer = setTimeout(() => this._commitOwn(), KEY_COMMIT);
    }

    // While a person types, the field keeps what they typed: redrawn from the
    // colour on every key, «#1f» became «#1F0000» under the caret.
    get codeText() {
        if (this._typing) return this._codeDraft ?? "";
        return formatColour(this._hsv || [0, 0, 0], this._format || "hex");
    }

    // The format menu under «Hex ▾»: a small nested list on the one dropdown
    // standard -- the chosen row highlighted, menuitemradio and aria-checked.
    toggleFormatMenu() {
        if (this._formatOpen) {
            this._closeFormatMenu(true);
            return;
        }
        this._formatOpen = true;
        this.requestComponentUpdate("format");
        this.whenRendered?.(() => {
            const menu = this.querySelector(".sf-color-format-menu");
            const button = this.querySelector(".sf-color-format");
            if (!menu || !button) return;
            this._formatPlaced = position().anchor(button, menu, {side: "block-end", align: "start", fitHeight: true, autoUpdate: true});
            menu.querySelector('[aria-checked="true"]')?.focus({preventScroll: true});
        }, {next: true});
    }

    _closeFormatMenu(restoreFocus) {
        this._formatOpen = false;
        this._formatPlaced?.stop();
        this._formatPlaced = null;
        this.requestComponentUpdate("format");
        if (restoreFocus) this.querySelector(".sf-color-format")?.focus({preventScroll: true});
    }

    setFormat(format) {
        if (FORMATS.includes(format)) this._format = format;
        this._codeError = "";
        this._typing = false;
        this._closeFormatMenu(true);
    }

    formatMenuKey(event) {
        const items = [...event.currentTarget.querySelectorAll("[data-format]")];
        const at = items.indexOf(this.ownerDocument.activeElement);
        const step = {ArrowDown: 1, ArrowUp: -1}[event.key];
        if (event.key === "Tab") {
            this._closeFormatMenu(false);
            return;
        }
        if (step === undefined || at < 0) return;
        event.preventDefault();
        items[(at + step + items.length) % items.length].focus();
    }

    get hasEyeDropper() {
        return typeof globalThis.EyeDropper === "function";
    }

    async eyedrop() {
        if (!this.hasEyeDropper) return;
        try {
            const result = await new globalThis.EyeDropper().open();
            const parsed = parseHex(result.sRGBHex) || this._cssColour(result.sRGBHex);
            if (!parsed) return;
            const [h, s, v] = rgbToHsv(parsed.rgb);
            this._hsv = [s > 0 ? h : this._hsv[0], s, v];
            this._moved();
            this._commitOwn();
        } catch {
            // The person cancelled the eyedropper.
        }
    }

    // ------------------------------------------------------------ palette keys

    // A radio group with one tab stop: arrows move and choose, Home and End go
    // to the ends, the grid's columns are its rows' length.
    optionKey(event) {
        const group = event.currentTarget;
        const items = [...group.querySelectorAll(".sf-color-option")];
        const at = items.indexOf(this.ownerDocument.activeElement);
        if (at < 0) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            items[at].click();
            return;
        }
        const columns = getComputedStyle(group).gridTemplateColumns.split(" ").filter(Boolean).length || items.length;
        const step = {
            ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns, Home: -at, End: items.length - 1 - at,
        }[event.key];
        if (step === undefined) return;
        event.preventDefault();
        const next = items[clamp(at + step, 0, items.length - 1)];
        next.focus();
        if (next.dataset.value) this.pick(next.dataset.value, {close: false, own: next.dataset.own === "true"});
    }

    // The check inside a chosen swatch: black or white, whichever reads.
    inkFor(value) {
        const parsed = parseHex(value) || (isPaletteName(value) ? parseHex(this._paletteHex(value)) : null);
        if (!parsed) return "";
        return darkInk(parsed.rgb) ? "var(--sf-black)" : "var(--sf-white)";
    }

    // The recent own colours of the window's palette view: the current own
    // colour first and chosen, then the rest, one row of the grid (R153, R168).
    get recentRow() {
        if (!this.offersCustom) return [];
        const own = this.value && !isPaletteName(this.value)
            && !this.swatchList.some((swatch) => swatch.value === this.value) ? [this.value] : [];
        const list = recentColours({alpha: this.alpha}).filter((hex) => hex !== this.value);
        return [...own, ...list].slice(0, RECENT_SHOW);
    }

    templateContext() {
        const open = Boolean(this._open);
        return this.createTemplateContext({
            ...this.getPropsContext(),
            component: this,
            value: this.value,
            painted: this.effectiveValue,
            paintedName: this.colourName(this.effectiveValue),
            isSet: this.isSet,
            inheritedValue: this.inheritedValue,
            inheritedText: this.inheritedText,
            hasInheritedValue: this.hasInheritedValue,
            chooseLabel: this.chooseLabel,
            clearLabel: this.clearLabel,
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
            // aria-label stays a host attribute read here, never a setting (§3.1).
            ariaLabel: this.getAttribute("aria-label") || "",
            variant: this.variant,
            themeLabel: this.themeLabel,
            themeResetLabel: this.themeResetLabel,
            themeColor: this.themeColor,
            open,
            view: this._view || "palette",
            offersPalette: this.offersPalette,
            offersCustom: this.offersCustom,
            palette: PALETTE,
            alpha: Boolean(this.alpha),
            recentRow: open ? this.recentRow : [],
            hsv: this._hsv || [0, 0, 0],
            alphaValue: this._alphaValue ?? 1,
            ownColour: open ? this.ownColour : "",
            codeText: open ? this.codeText : "",
            typing: Boolean(this._typing),
            format: this._format || "hex",
            formatOpen: Boolean(this._formatOpen),
            formats: FORMATS,
            formatWords: FORMAT_WORD,
            codeError: this._codeError || "",
            hasEyeDropper: this.hasEyeDropper,
            word: (key, vars) => this.sfWord(key, vars ? {vars} : undefined),
        });
    }

    template() {
        return renderColorTemplate(this.templateContext());
    }
}

const FORMAT_WORD = Object.freeze({hex: "Hex", rgb: "RGB", hsl: "HSL", hsb: "HSB"});

// rgb(r g b / a) or rgba(r, g, b, a), as a computed style gives it.
function cssRgb(text) {
    const match = /rgba?\(([^)]+)\)/u.exec(String(text));
    if (!match) return null;
    const parts = match[1].split(/[\s,/]+/u).filter(Boolean).map((part) => parseFloat(part));
    if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
    return {rgb: parts.slice(0, 3), a: Number.isFinite(parts[3]) ? parts[3] : 1};
}

SfColor.define("sf-input-color");

export {SfColor};
