// sf-help-mark: a «?» beside a label that opens a short explanation -- a
// toggletip (owner-approved assignment, 2026-10-14). A press opens and closes
// it, never a hover, so it works by touch and keyboard alike; the
// explanation is announced politely when it opens, so a screen reader hears it
// without leaving the button. An explanation holding a link or a control
// follows the button in the focus order and closes when the focus leaves both.
import SfBaseElement from '../../core/js/smart-base';
import BundledPosition from '../../core/js/position.js';
import {pageText} from '../../core/js/page-language';
import {renderHelpMarkTemplate} from './js/templates/default';
import './scss/index.scss';

const position = () => globalThis.SF?.Position || BundledPosition;
const SIZES = ['1/3', '1/2', '1'];
const PLACEMENTS = {auto: 'block-end', bottom: 'block-end', top: 'block-start', start: 'inline-start', end: 'inline-end'};
const HELP_TEXT = {en: {label: 'More information'}, ru: {label: 'Подробнее'}};
let sequence = 0;

class SfHelpMark extends SfBaseElement {
  constructor() {
    super();
    this._id = `sf-help-mark-${++sequence}`;
    this.isOpen = false;
    this.announcement = '';
    this._onOutside = (event) => {
      if (!this.isOpen || event.composedPath().includes(this)) return;
      this.close({restoreFocus: false});
    };
    this._onKey = (event) => {
      if (!this.isOpen || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    };
    this.addEventListener('focusout', (event) => {
      // Focus left both the button and the explanation: an explanation one
      // could tab into closes; one without anything to reach stays.
      if (!this.isOpen || !this.interactive()) return;
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      this.close({restoreFocus: false});
    });
  }

  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      text: {default: ''},
      title: {default: ''},
      label: {default: ''},
      size: {default: '1/2'},
      placement: {default: 'auto'},
      rootClass: {default: ''},
    };
  }

  get text() { return this.getAttribute('text') || ''; }
  get title() { return this.getAttribute('title') || ''; }
  get label() { return this.getAttribute('label') || ''; }
  get size() { const value = this.getAttribute('size'); return SIZES.includes(value) ? value : '1/2'; }
  get placement() { const value = this.getAttribute('placement'); return PLACEMENTS[value] ? value : 'auto'; }

  panel() {
    return this.querySelector(':scope .sf-help-mark-panel');
  }

  button() {
    return this.querySelector(':scope .sf-help-mark-button button') ?? this.querySelector(':scope .sf-help-mark-button');
  }

  interactive() {
    return Boolean(this.panel()?.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  }

  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  async open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.requestComponentUpdate('open');
    await this.whenRendered?.();
    const panel = this.panel();
    const button = this.button();
    if (!panel || !button) return;
    if (typeof panel.showPopover === 'function') {
      panel.setAttribute('popover', 'manual');
      if (!panel.matches(':popover-open')) panel.showPopover();
    }
    this._position = position().anchor(button, panel, {side: PLACEMENTS[this.placement], align: 'center', flip: true, shift: true});
    document.addEventListener('pointerdown', this._onOutside, true);
    document.addEventListener('keydown', this._onKey, true);
    // Said once it is open: the text a screen reader hears is the text shown.
    this.announcement = '';
    this.requestComponentUpdate('announce-clear');
    setTimeout(() => {
      if (!this.isOpen) return;
      this.announcement = [this.title, this.text || panel.querySelector('.sf-help-mark-body')?.textContent?.trim()].filter(Boolean).join('. ');
      this.requestComponentUpdate('announce');
    }, 50);
    this.dispatchEvent(new CustomEvent('sf-help-mark-open', {bubbles: true, composed: true}));
  }

  close({restoreFocus = true} = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.announcement = '';
    this._position?.stop();
    this._position = null;
    document.removeEventListener('pointerdown', this._onOutside, true);
    document.removeEventListener('keydown', this._onKey, true);
    const panel = this.panel();
    if (panel?.matches?.(':popover-open')) panel.hidePopover();
    this.requestComponentUpdate('close');
    if (restoreFocus) this.button()?.focus({preventScroll: true});
    this.dispatchEvent(new CustomEvent('sf-help-mark-close', {bubbles: true, composed: true}));
  }

  disconnectedCallback() {
    this.close({restoreFocus: false});
    super.disconnectedCallback?.();
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      size: this.size,
      name: this.label || pageText(HELP_TEXT, 'label', this, 'sf-help-mark'),
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
