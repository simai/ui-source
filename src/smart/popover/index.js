import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {noteDeprecated} from '../../core/js/deprecations';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark';
import {hasLayerAbove} from '../../core/js/layer-stack';
import BundledPosition from '../../core/js/position.js';
import {renderPopoverTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-popover from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8, §19): placement, label, width, dismissible, surface-role and the
// value open are attributes and properties made by core/js/element-manifest.js;
// the old host attribute role is a dated alias of surface-role.
// The one anchored-positioning contract of the Framework's floating surfaces
// (core/js/position.js): the page's published copy when there is one.
const positioning = () => globalThis.SF?.Position || BundledPosition;

// Where the surface hangs from, as the shared helper's side and alignment.
const ANCHOR_PLACEMENTS = {
    'bottom-start': {side: 'block-end', align: 'start'},
    'bottom-end': {side: 'block-end', align: 'end'},
    'top-start': {side: 'block-start', align: 'start'},
    'top-end': {side: 'block-start', align: 'end'},
    'inline-end': {side: 'inline-end', align: 'start'},
    'inline-start': {side: 'inline-start', align: 'start'},
};

const PopoverElement = elementFromManifest(manifest, {
    base: SfBaseElement,
    lang: {en, ru},
    source: 'ru',
    aliases,
});


// A surface anchored to a control the consumer supplies: a field's settings, a
// list of things to add, a filter, a colour picker's own panel. It exists
// because the Framework had the surface and not the behaviour -- sf-context-menu
// is positioned and takes any content and any role, but it has no open state, no
// trigger, no dismissal and no focus to return. Two composites built that by
// hand within a week of each other, the second copying the first, which is the
// moment a part belongs here instead.
//
// It claims nothing about the shape of the content: a menu of commands, a list
// of ticks, a form. The role it is given reaches the surface, and the arrow keys
// and roving focus of a menu stay where they already are -- in sf-context-menu,
// which this draws into.
// While any popover is open the root says so, and a component whose own Escape
// closes something -- a drawer, a modal, a panel -- stands back. The mark is a
// protocol shared with every other surface that owns Escape, so it is held
// through core (`core/js/open-surface-mark`) rather than written here.

class SfPopover extends PopoverElement {
    // Its DOM updates are all it draws: the first one counts as its render
    // (Smart base, simai/ui-source#70).
    static rendersNoTemplate = true;

    // The manifest's settings and value, and the base's template name.
    static get props() {
        return {
            ...super.props,
            templateName: {attribute: 'template', default: 'default'},
        };
    }

    constructor() {
        super();
        this._onDocumentPointerDown = null;
        this._onDocumentKeyDown = null;
        this._closeReason = 'api';
    }

    static get observedAttributes() {
        return [...new Set([...(super.observedAttributes ?? []), 'open'])];
    }

    // A role written on the host is the surface's: it is taken once into
    // surface-role and off the host, so the host is not a second menu or dialog
    // around the real one (a dated alias, aliases.json).
    _adoptLegacyRole() {
        if (!this.hasAttribute('role')) return;
        const role = String(this.getAttribute('role') || '').trim().toLowerCase();
        if (!this.hasAttribute('surface-role') && ['dialog', 'menu', 'listbox', 'group'].includes(role)) this.setAttribute('surface-role', role);
        this.removeAttribute('role');
        noteDeprecated({component: 'sf-popover', tag: 'sf-popover', kind: 'attribute', attribute: 'role', from: 'role', to: 'surface-role',
            since: aliases.since, remove_after: aliases.remove_after});
    }

    // The host is a box rather than a passthrough: the surface is positioned
    // against it and the trigger sits inside it. The base makes every Smart
    // element `display: contents`, which has no box to position against -- and
    // the alternative, moving the children into one this component renders, is
    // undone by the next render of whatever template engine put them there.
    // Nothing is moved: the children stay exactly where the consumer wrote them
    // and this says where they are.
    // What the page set inline that a child inherits -- custom properties,
    // colour, font -- stays on the host before its box, as on every Smart host.
    applyHostDisplayStyle() {
        const next = [this.hostInheritedStyle(), 'display: inline-flex; align-items: center; position: relative;']
            .filter(Boolean).join(' ');
        return this.writeHostStyle(next);
    }

    // The base lifts every `[slot]` child out of the document at connect, for a
    // template to place back where it decides. This component decides nothing
    // about where they go: the trigger and the surface stay exactly where the
    // consumer wrote them, and `slot` here names which of the two a node is.
    captureSlotTemplates() {
        this._slotTemplatesCaptured = true;
    }

    onConnected() {
        this._adoptLegacyRole();
        super.onConnected?.();
        this._bindDismissal();
        this.addEventListener('click', this._onTriggerClick);
    }

    // A press anywhere in the trigger opens it, or closes it with reason
    // close; a press in the content is the content's own.
    _onTriggerClick = (event) => {
        const path = event.composedPath?.() ?? [];
        const inTrigger = path.some((node) => node?.getAttribute?.('slot') === 'trigger');
        if (!inTrigger) return;
        event.preventDefault();
        if (this.open) this.close({reason: 'close'});
        else this.show();
    };

    onDisconnected() {
        this._releaseAnchor();
        this.removeEventListener('click', this._onTriggerClick);
        this._releaseDismissal();
        super.onDisconnected?.();
    }

    attributeChangedCallback(name, previous, next) {
        super.attributeChangedCallback?.(name, previous, next);
        if (previous === next || name !== 'open') return;
        this._bindDismissal();
        // The fact, after the state changed (vocabulary §4); a setting written
        // from outside is reported the same way, as the surface's own state.
        if (this.open) this.sfEmit('opened', {});
        else this.sfEmit('closed', {reason: this._closeReason || 'api'});
        this._closeReason = 'api';
        if (!this.open) this.returnFocus();
    }

    // Opens or closes the surface. Answers an outcome (§4.4): refused when a
    // listener prevents the request (sf-popover-open, sf-popover-close).
    toggle(force) {
        const given = force && typeof force === 'object' ? force.force : force;
        const next = typeof given === 'boolean' ? given : !this.open;
        if (next === this.open) return applied();
        return next ? this.show() : this.close();
    }

    show() {
        if (this.open) return applied();
        if (!this.sfEmit('open', {}, {cancelable: true})) return refused('prevented');
        this._opener = this.querySelector('[slot="trigger"]') ?? null;
        this.toggleAttribute('open', true);
        this.requestComponentUpdate('open');
        return applied();
    }

    // options.reason says why (standard 1.3.8 §19.3): escape, outside, close
    // (the trigger pressed again) or api, the default.
    close(options = {}) {
        if (!this.open) return refused('closed');
        const reason = typeof options?.reason === 'string' ? options.reason : 'api';
        if (!this.sfEmit('close', {reason, unsaved: Boolean(this.unsaved)}, {cancelable: true})) return refused('prevented');
        this._closeReason = reason;
        this.toggleAttribute('open', false);
        this.requestComponentUpdate('open');
        return applied();
    }

    // The control that opened it gets the focus back, because a surface that
    // closes leaving the focus on the document start makes a keyboard lose its
    // place entirely.
    returnFocus() {
        const trigger = this._opener?.isConnected
            ? this._opener
            : this.querySelector('[slot="trigger"]');
        const focusable = trigger?.matches?.('button, a[href], [tabindex]')
            ? trigger
            : trigger?.querySelector?.('button, a[href], [tabindex]');
        focusable?.focus?.();
        return applied();
    }

    _bindDismissal() {
        if (!this.open || !this.dismissible) {
            this._releaseDismissal();
            return;
        }
        if (this._onDocumentPointerDown) return;
        holdOpenSurfaceMark(this, true);
        this._onDocumentPointerDown = (event) => {
            const path = event.composedPath?.() ?? [];
            if (path.includes(this)) return;
            // An outside press is the top layer's (standard 1.3.8 §19.3): a
            // press inside a drawer or a window opened from this popover is
            // theirs, and the popover under them stays. A list opened from it
            // closes with it, as before.
            if (hasLayerAbove(this)) return;
            this.close({reason: 'outside'});
        };
        // Capture, and the press is stopped going further: a surface closing
        // under the pointer must not also activate what the pointer landed on.
        // Only as the innermost open layer: a calendar or a list opened inside
        // it takes the press first, and the popover the next one.
        this._onDocumentKeyDown = (event) => {
            if (event.key !== 'Escape' || event.defaultPrevented || !isTopOpenSurface(this)) return;
            event.preventDefault();
            event.stopPropagation();
            this.close({reason: 'escape'});
        };
        document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
        document.addEventListener('keydown', this._onDocumentKeyDown, true);
    }

    _releaseDismissal() {
        holdOpenSurfaceMark(this, false);
        if (this._onDocumentPointerDown) {
            document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
        }
        if (this._onDocumentKeyDown) {
            document.removeEventListener('keydown', this._onDocumentKeyDown, true);
        }
        this._onDocumentPointerDown = null;
        this._onDocumentKeyDown = null;
    }

    // It draws no markup of its own, so it takes the base's own patch path and
    // never renders: lit owns the children of whatever it renders into, and this
    // element renders into itself. A template returning nothing would therefore
    // delete the trigger and the surface the consumer wrote -- which is the same
    // wound as moving them, taken from the other side.
    resolveUpdateMode() {
        return 'dom';
    }

    // What it owns is said in attributes the stylesheet reads: where the surface
    // sits, whether it is shown, how wide it is, and what it is to a reader.
    updateDom() {
        this.dataset.placement = this.placement;
        this.dataset.open = this.open ? 'true' : 'false';
        this._adoptLegacyRole();
        // The control that opens it says that it does and whether it has.
        const trigger = this.querySelector('[slot="trigger"]');
        const control = trigger?.matches?.('button, a[href], [tabindex]')
            ? trigger
            : trigger?.querySelector?.(`button, a[href], [tabindex], sf-button, ${tagSelector('sf-button-icon')}`);
        if (control) {
            control.setAttribute('aria-expanded', this.open ? 'true' : 'false');
            control.setAttribute('aria-haspopup', this.surfaceRole === 'group' ? 'true' : this.surfaceRole);
        }
        const surface = this.querySelector('[slot="content"]');
        if (!surface) return true;
        surface.setAttribute('role', this.surfaceRole);
        if (this.label) surface.setAttribute('aria-label', this.label);
        else surface.removeAttribute('aria-label');
        surface.style.setProperty('--sf-popover--width', this.width || '');
        // The gap to the trigger (#69), a margin on the trigger's side.
        if (this.offset) surface.style.setProperty('--sf-popover--offset', this.offset);
        else surface.style.removeProperty('--sf-popover--offset');
        this._syncAnchor(surface);
        return true;
    }

    // An open surface is kept on screen as every other floating surface is
    // (core/js/position.js): it hangs from the corner its placement names and
    // moves along the trigger's edge, or to the other side, when the window has
    // no room for it there. Placed by the stylesheet alone, a panel wider than
    // the room beside a trigger at the window's edge ran off it (ui-doc
    // «Рецепты», «Уведомления», 2026-11-10: 320px from a bell 60px from the
    // edge of a 400px window ended 260px past it). It stays where it stands in
    // the stacking order (no top layer): a window or a drawer opened from it is
    // still drawn over it. Closed, the stylesheet's placement is back.
    _syncAnchor(surface) {
        const want = this.open && surface?.isConnected ? `${this.placement}|${this.offset || ''}` : null;
        if (this._anchor && (this._anchorSurface !== surface || this._anchorKey !== want)) this._releaseAnchor();
        if (!want || this._anchor) return;
        const {side, align} = ANCHOR_PLACEMENTS[this.placement] || ANCHOR_PLACEMENTS['bottom-end'];
        this._anchor = positioning().anchor(this, surface, {
            side, align, offset: this.offset || 0, flip: true, shift: true, fitHeight: false, topLayer: false,
        });
        this._anchorSurface = surface;
        this._anchorKey = want;
    }

    _releaseAnchor() {
        this._anchor?.stop();
        this._anchor = null;
        this._anchorSurface = null;
        this._anchorKey = null;
    }

    templateContext() {
        return this.createTemplateContext({...this.getPropsContext(), component: this});
    }

    template() {
        return renderPopoverTemplate(this.templateContext());
    }
}

SfPopover.define('sf-popover');

export default SfPopover;
