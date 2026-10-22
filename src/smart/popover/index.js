import SfBaseElement from '../../core/js/smart-base';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {renderPopoverTemplate} from './js/templates/default';

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

const PLACEMENTS = [
    'bottom-start', 'bottom-end', 'top-start', 'top-end',
    'inline-start', 'inline-end',
];

class SfPopover extends SfBaseElement {
    static get props() {
        return {
            templateName: {attribute: 'template', default: 'default'},
            open: {type: Boolean, default: false},
            placement: {default: 'bottom-end', values: PLACEMENTS},
            label: {default: ''},
            // What the surface is to a reader. `role` was the name, and a role
            // attribute on the host made the host itself a menu or a dialog
            // beside its surface; it is still read once and moved off the host.
            surfaceRole: {attribute: 'surface-role', default: 'dialog', values: ['dialog', 'menu', 'listbox', 'group']},
            // A surface wider than its trigger says how wide it is; left to the
            // content, a list of field names made the surface as wide as its
            // longest one.
            width: {default: ''},
            // Esc and a press outside both close it. A consumer that owns those
            // keys itself -- a step in a wizard, say -- turns them off and calls
            // `close()` when it decides.
            dismissible: {type: Boolean, default: true},
        };
    }

    constructor() {
        super();
        this._onDocumentPointerDown = null;
        this._onDocumentKeyDown = null;
    }

    static get observedAttributes() {
        return [...(super.observedAttributes ?? []), 'open'];
    }

    get open() {
        return this.getBooleanAttr('open', false);
    }

    get placement() {
        return this.getEnumAttr('placement', PLACEMENTS, 'bottom-end');
    }

    get label() {
        return this.getAttribute('label') || '';
    }

    get surfaceRole() {
        const values = ['dialog', 'menu', 'listbox', 'group'];
        if (this.hasAttribute('surface-role')) return this.getEnumAttr('surface-role', values, 'dialog');
        return values.includes(this._legacyRole) ? this._legacyRole : 'dialog';
    }

    // The legacy name, kept so a consumer reading el.role still gets an answer.
    get role() {
        return this.surfaceRole;
    }

    // A role written on the host is the surface's: it is taken once and removed,
    // so the host is not a second menu or dialog around the real one.
    _adoptLegacyRole() {
        if (!this.hasAttribute('role')) return;
        this._legacyRole = String(this.getAttribute('role') || '').trim().toLowerCase();
        this.removeAttribute('role');
        globalThis.SF?.deprecations?.note?.({component: 'sf-popover', kind: 'attribute', attribute: 'role', from: 'role', to: 'surface-role'});
    }

    get width() {
        return this.getAttribute('width') || '';
    }

    get dismissible() {
        return this.getBooleanAttr('dismissible', true);
    }

    // The host is a box rather than a passthrough: the surface is positioned
    // against it and the trigger sits inside it. The base makes every Smart
    // element `display: contents`, which has no box to position against -- and
    // the alternative, moving the children into one this component renders, is
    // undone by the next render of whatever template engine put them there.
    // Nothing is moved: the children stay exactly where the consumer wrote them
    // and this says where they are.
    applyHostDisplayStyle() {
        const next = 'display: inline-flex; align-items: center; position: relative;';
        if (this.getAttribute('style') === next) return this;
        this._syncingHostStyle = true;
        this.setAttribute('style', next);
        this._syncingHostStyle = false;
        return this;
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

    // A press anywhere in the trigger opens it; a press in the content is the
    // content's own.
    _onTriggerClick = (event) => {
        const path = event.composedPath?.() ?? [];
        const inTrigger = path.some((node) => node?.getAttribute?.('slot') === 'trigger');
        if (!inTrigger) return;
        event.preventDefault();
        this.toggle();
    };

    onDisconnected() {
        this.removeEventListener('click', this._onTriggerClick);
        this._releaseDismissal();
        super.onDisconnected?.();
    }

    attributeChangedCallback(name, previous, next) {
        super.attributeChangedCallback?.(name, previous, next);
        if (previous === next || name !== 'open') return;
        this._bindDismissal();
        this.emitComponentEvent(this.open ? 'popover-open' : 'popover-close', {open: this.open});
        if (!this.open) this.returnFocus();
    }

    toggle(force) {
        const next = typeof force === 'boolean' ? force : !this.open;
        if (next === this.open) return this.open;
        if (next) this._opener = this.querySelector('[slot="trigger"]') ?? null;
        this.toggleAttribute('open', next);
        this.requestComponentUpdate('open');
        return next;
    }

    show() {
        return this.toggle(true);
    }

    close() {
        return this.toggle(false);
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
            this.close();
        };
        // Capture, and the press is stopped going further: a surface closing
        // under the pointer must not also activate what the pointer landed on.
        this._onDocumentKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            this.close();
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
            : trigger?.querySelector?.('button, a[href], [tabindex], sf-button, sf-icon-button');
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
        return true;
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
