// sf-accordion: sections built from data -- a record's groups, a settings
// panel, an FAQ -- drawn as the class accordion (src/component/accordion), so
// its styles apply and nothing of them is forked (owner, 2026-10-25). The
// sections come from `items` (an array, or the same as JSON) or from <details>
// written inside the element; a section's markup can come from a slot.
//
// The element draws the class markup and keeps its state itself: open
// sections, single mode, the single section that is a plain section. Each
// section it draws carries data-sf-accordion-init, the class runtime's own
// mark of a section already set up, so that runtime -- loaded beside it for
// the sheet -- leaves the element's sections alone and two owners never toggle
// one section.
import SfBaseElement from '../../core/js/smart-base';
import {renderAccordionTemplate} from './js/templates/default';
import {
  ACCORDION_APPEARANCES,
  ACCORDION_MARKERS,
  ACCORDION_SIZES,
  normaliseSection,
  normaliseSections,
  openSections,
} from './sections.mjs';
import './scss/index.scss';

const HEADING_LEVELS = ['2', '3', '4', '5', '6'];
let sequence = 0;

class SfSmartAccordion extends SfBaseElement {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      items: {default: []},
      single: {type: Boolean, default: false},
      size: {default: '', values: ACCORDION_SIZES},
      appearance: {default: 'default', values: ACCORDION_APPEARANCES},
      marker: {default: 'chevron', values: ACCORDION_MARKERS},
      // One section is a plain section (simai/ui-source#19, #29); `toggle`
      // keeps it a disclosure -- a list that fills in later.
      singleSection: {attribute: 'single-section', default: 'static', values: ['static', 'toggle']},
      headingLevel: {attribute: 'heading-level', default: '3', values: HEADING_LEVELS},
      rootClass: {default: ''},
    };
  }

  constructor() {
    super();
    this._id = `sf-smart-accordion-${++sequence}`;
    // undefined: follow the attribute. Set by the property; an attribute
    // written later takes over again.
    this._items = undefined;
    // What the person or the host opened and closed, by section id, over the
    // open flag each section carries.
    this._openState = new Map();
    this._childSections = [];
    // A value set as a property before the element was defined -- a lit
    // `.items` binding on a tag the loader had not upgraded yet -- is an own
    // property that would hide the accessor; it is taken through it.
    if (Object.prototype.hasOwnProperty.call(this, 'items')) {
      const early = this.items;
      delete this.items;
      this._items = normaliseSections(early);
    }
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeydown);
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'items' && previous !== next) this._items = undefined;
    super.attributeChangedCallback(name, previous, next);
  }

  // The <details> written inside the element are sections too: the summary
  // is the title, everything else the content, which stays the same live
  // nodes. Read once, as slots are, and taken out of the light DOM.
  captureSlotTemplates() {
    const first = !this._slotTemplatesCaptured;
    super.captureSlotTemplates();
    if (!first) return;
    Array.from(this.children)
      .filter((child) => child.localName === 'details')
      .forEach((details, index) => {
        const summary = details.querySelector(':scope > summary');
        const section = normaliseSection({
          id: details.dataset.id || details.id,
          title: summary?.textContent.replace(/\s+/gu, ' ').trim() || '',
          open: details.open,
          disabled: details.hasAttribute('data-disabled'),
          icon: details.dataset.icon,
          badge: details.dataset.badge,
        }, index);
        section.slot = `${this._id}-child-${index}`;
        const nodes = Array.from(details.childNodes).filter((node) => node !== summary);
        if (nodes.length) this._liveSlotNodes.set(section.slot, nodes);
        this._childSections.push(section);
        details.remove();
      });
  }

  // The sections, from the property or the attribute, else from the markup.
  get items() {
    if (this._items !== undefined) return this._items;
    return normaliseSections(this.getAttribute('items'));
  }

  set items(next) {
    this._items = normaliseSections(next);
    this.requestComponentUpdate('items');
  }

  get sections() {
    const items = this.items;
    return items.length ? items : this._childSections;
  }

  get single() { return this.getBooleanAttr('single', false); }
  get size() { return this.getProp('size'); }
  get appearance() { return this.getProp('appearance'); }
  get marker() { return this.getProp('marker'); }
  get headingLevel() { return this.getProp('headingLevel'); }

  // The one section that stands alone is a plain section: no toggle.
  get isStatic() {
    return this.sections.length === 1 && this.getProp('singleSection') !== 'toggle';
  }

  // The ids of the open sections, in order. A single section is always open.
  get openIds() {
    const sections = this.sections;
    if (this.isStatic) return sections.map((section) => section.id);
    return [...openSections(sections, this._openState, this.single)];
  }

  isOpen(id) {
    return this.openIds.includes(String(id));
  }

  section(id) {
    return this.sections.find((section) => section.id === String(id)) || null;
  }

  open(id) {
    return this.setOpen(id, true, 'method');
  }

  close(id) {
    return this.setOpen(id, false, 'method');
  }

  toggle(id) {
    return this.setOpen(id, !this.isOpen(id), 'method');
  }

  // Opens or closes one section. In single mode opening one closes the one
  // that was open, and each change is reported, as a native <details name>
  // group reports the one it closes. A disabled section, a section that is
  // already so, and the single section do nothing. Returns whether anything
  // changed.
  setOpen(id, open, source = 'method') {
    const section = this.section(id);
    if (!section || this.isStatic) return false;
    if (section.disabled && source === 'user') return false;
    const before = new Set(this.openIds);
    if (before.has(section.id) === Boolean(open)) return false;
    if (open && this.single) {
      for (const other of before) this._openState.set(other, false);
    }
    this._openState.set(section.id, Boolean(open));
    const after = new Set(this.openIds);
    this.requestComponentUpdate('open');
    const changed = this.sections.filter((one) => before.has(one.id) !== after.has(one.id));
    // The section asked for first, then the one single mode closed.
    changed.sort((a, b) => (a.id === section.id ? -1 : b.id === section.id ? 1 : 0));
    for (const one of changed) {
      this.dispatchEvent(new CustomEvent('sf-accordion:toggle', {
        bubbles: true,
        composed: true,
        detail: {id: one.id, open: after.has(one.id), source, section: one},
      }));
    }
    return true;
  }

  // The header buttons of this element, not of an accordion nested inside it.
  triggers() {
    return Array.from(this.querySelectorAll('.sf-accordion-trigger[data-sf-accordion-section]'))
      .filter((trigger) => trigger.closest('sf-accordion') === this && trigger.localName === 'button');
  }

  ownTrigger(target) {
    const trigger = target?.closest?.('button.sf-accordion-trigger[data-sf-accordion-section]');
    return trigger && trigger.closest('sf-accordion') === this ? trigger : null;
  }

  focusDelegate() {
    return this.triggers().find((trigger) => !trigger.disabled) || null;
  }

  onClick = (event) => {
    const trigger = this.ownTrigger(event.target);
    if (!trigger || trigger.disabled) return;
    const id = trigger.dataset.sfAccordionSection;
    this.setOpen(id, !this.isOpen(id), 'user');
  };

  // Enter and Space are the button's own. The arrows walk the headers, Home
  // and End go to the first and the last (WAI-ARIA accordion pattern); a
  // disabled header is passed over, as it takes no focus.
  onKeydown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const trigger = this.ownTrigger(event.target);
    if (!trigger || event.target !== trigger) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const triggers = this.triggers().filter((one) => !one.disabled);
    if (!triggers.length) return;
    const at = triggers.indexOf(trigger);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? triggers.length - 1
        : (at + (event.key === 'ArrowDown' ? 1 : -1) + triggers.length) % triggers.length;
    event.preventDefault();
    triggers[next].focus();
  };

  templateContext() {
    const props = this.getPropsContext();
    const sections = this.sections;
    const open = new Set(this.openIds);
    return this.createTemplateContext({
      ...props,
      component: this,
      id: this._id,
      sections,
      open,
      single: this.single,
      isStatic: this.isStatic,
      size: this.size,
      appearance: this.appearance,
      marker: this.marker,
      headingLevel: this.headingLevel,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderAccordionTemplate(this.templateContext());
  }
}

SfSmartAccordion.define('sf-accordion');

export {SfSmartAccordion};
