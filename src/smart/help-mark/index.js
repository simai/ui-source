// sf-help-mark: a «?» beside a label that opens a short explanation -- a
// toggletip (owner-approved assignment, 2026-10-14). A press opens and closes
// it, never a hover, so it works by touch and keyboard alike; the
// explanation is announced politely when it opens, so a screen reader hears it
// without leaving the button. An explanation holding a link or a control
// follows the button in the focus order and closes when the focus leaves both.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js (title is heading's
// dated alias), open and close are the actions and answer outcomes, and the
// facts are sf-help-mark-opened and -closed, the old -open and -close their
// dated aliases (aliases.json).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark';
import {renderHelpMarkTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const position = () => globalThis.SF?.Position || BundledPosition;
const PLACEMENTS = {auto: 'block-end', bottom: 'block-end', top: 'block-start', start: 'inline-start', end: 'inline-end'};
let sequence = 0;

const HelpMarkElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions: {
    open() { return this.runOpen(); },
    close() { return this.runClose(); },
  },
});

class SfHelpMark extends HelpMarkElement {
  constructor() {
    super();
    this._id = `sf-help-mark-${++sequence}`;
    this.isOpen = false;
    this.announcement = '';
    this._onOutside = (event) => {
      if (!this.isOpen || event.composedPath().includes(this)) return;
      this.runClose({restoreFocus: false});
    };
    // An open explanation owns Escape as the innermost open layer, and says so
    // on the root through the shared mark, so a record panel listening in
    // capture before it stands back instead of closing with it.
    this._onKey = (event) => {
      if (!this.isOpen || event.key !== 'Escape' || event.defaultPrevented || !isTopOpenSurface(this)) return;
      event.preventDefault();
      event.stopPropagation();
      this.runClose();
    };
    this.addEventListener('focusout', (event) => {
      // Focus left both the button and the explanation: an explanation one
      // could tab into closes; one without anything to reach stays.
      if (!this.isOpen || !this.interactive()) return;
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      this.runClose({restoreFocus: false});
    });
  }

  panel() {
    return this.querySelector(':scope .sf-help-mark-panel');
  }

  button() {
    return this.querySelector(':scope .sf-help-mark-button button') ?? this.querySelector(':scope .sf-help-mark-button');
  }

  interactive() {
    return Boolean(this.panel()?.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  }

  // The template's press: a helper, not an action (the actions are open and
  // close).
  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  // The action open (component.json).
  async runOpen() {
    if (this.isOpen) return {outcome: 'applied'};
    this.isOpen = true;
    this.sfHostState('data-open', true);
    this.requestComponentUpdate('open');
    await this.whenRendered?.();
    // Closed while it was drawing: it must not raise a mark nobody releases.
    if (!this.isOpen) return {outcome: 'cancelled'};
    const panel = this.panel();
    const button = this.button();
    if (!panel || !button) return {outcome: 'applied'};
    if (typeof panel.showPopover === 'function') {
      panel.setAttribute('popover', 'manual');
      if (!panel.matches(':popover-open')) panel.showPopover();
    }
    this._position = position().anchor(button, panel, {side: PLACEMENTS[this.placement], align: 'center', flip: true, shift: true});
    holdOpenSurfaceMark(this, true);
    document.addEventListener('pointerdown', this._onOutside, true);
    document.addEventListener('keydown', this._onKey, true);
    // Said once it is open: the text a screen reader hears is the text shown.
    this.announcement = '';
    this.requestComponentUpdate('announce-clear');
    setTimeout(() => {
      if (!this.isOpen) return;
      this.announcement = [this.heading, this.text || panel.querySelector('.sf-help-mark-body')?.textContent?.trim()].filter(Boolean).join('. ');
      this.requestComponentUpdate('announce');
    }, 50);
    this.sfEmit('opened', {});
    return {outcome: 'applied'};
  }

  // The action close (component.json); inside, an outside press or focus
  // leaving both parts closes without taking the focus back.
  runClose({restoreFocus = true} = {}) {
    if (!this.isOpen) return {outcome: 'applied'};
    this.isOpen = false;
    this.sfHostState('data-open', false);
    this.announcement = '';
    this._position?.stop();
    this._position = null;
    holdOpenSurfaceMark(this, false);
    document.removeEventListener('pointerdown', this._onOutside, true);
    document.removeEventListener('keydown', this._onKey, true);
    const panel = this.panel();
    if (panel?.matches?.(':popover-open')) panel.hidePopover();
    this.requestComponentUpdate('close');
    if (restoreFocus) this.button()?.focus({preventScroll: true});
    this.sfEmit('closed', {});
    return {outcome: 'applied'};
  }

  disconnectedCallback() {
    this.runClose({restoreFocus: false});
    super.disconnectedCallback?.();
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      size: this.size,
      heading: this.heading,
      name: this.label,
      open: this.isOpen,
      announcement: this.announcement,
      body: this.hasSlotContent?.('content') ? this.getSlotContent('content') : null,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderHelpMarkTemplate(this.templateContext());
  }
}

SfHelpMark.define('sf-help-mark');
