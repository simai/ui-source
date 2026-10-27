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
import {elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
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
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are attributes and properties made by
// core/js/element-manifest.js, open, close and toggle answer outcomes, and the
// old event name sf-accordion:toggle is a dated alias of sf-accordion-toggle.
const AccordionElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

const HEADING_LEVELS = ['2', '3', '4', '5', '6'];

// open('main') and open({id: 'main'}) both name a section (§4.4).
const sectionArgument = (value) => (value && typeof value === 'object' ? value.id : value);

class SfSmartAccordion extends AccordionElement {
  static get props() {
    return {
      ...super.props,
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
        // A local name: the slot map is the element's own (§7.1.1, #41).
        section.slot = `sf-accordion-child-${index}`;
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

  // single, size, appearance, marker and heading-level are the manifest's
  // accessors (attribute and property); expanded is the open ids (§4 values).
  get expanded() { return this.openIds; }

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

  // The actions open, close and toggle {id} (§4.4): each answers an outcome.
  open(id) {
    return this.setOpen(sectionArgument(id), true, 'method');
  }

  close(id) {
    return this.setOpen(sectionArgument(id), false, 'method');
  }

  toggle(id) {
    const key = sectionArgument(id);
    return this.setOpen(key, !this.isOpen(key), 'method');
  }

  // Opens or closes one section. In single mode opening one closes the one
  // that was open, and each change is reported, as a native <details name>
  // group reports the one it closes. A disabled section, a section that is
  // already so, and the single section do nothing. Answers an outcome:
  // applied, or refused with unknown, static, disabled or already.
  setOpen(id, open, source = 'method') {
    const section = this.section(id);
    if (!section) return {outcome: 'refused', reason: 'unknown'};
    if (this.isStatic) return {outcome: 'refused', reason: 'static'};
    if (section.disabled && source === 'user') return {outcome: 'refused', reason: 'disabled'};
    const before = new Set(this.openIds);
    if (before.has(section.id) === Boolean(open)) return {outcome: 'refused', reason: 'already'};
    if (open && this.single) {
      for (const other of before) this._openState.set(other, false);
    }
    this._openState.set(section.id, Boolean(open));
    const after = new Set(this.openIds);
    this.requestComponentUpdate('open');
    const changed = this.sections.filter((one) => before.has(one.id) !== after.has(one.id));
    // The section asked for first, then the one single mode closed.
    changed.sort((a, b) => (a.id === section.id ? -1 : b.id === section.id ? 1 : 0));
    // sf-accordion-toggle, then its old name sf-accordion:toggle with the same
    // detail (aliases.json, until 2026-12-01).
    for (const one of changed) {
      this.sfEmit('toggle', {id: one.id, open: after.has(one.id), source, section: one});
    }
    return {outcome: 'applied'};
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
      // The host's path id (§7.1.1, simai/ui-source#41): the header and panel
      // ids are <path>--trigger-<n> and <path>--panel-<n>.
      id: partId(instancePath(this, {kind: 'sf-accordion'})),
      sections,
      open,
      single: this.single,
      isStatic: this.isStatic,
      size: this.size,
      appearance: this.appearance,
      marker: this.marker,
      // The enum of the class sheet's levels; the property is the number.
      headingLevel: this.getProp('headingLevel'),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderAccordionTemplate(this.templateContext());
  }
}

SfSmartAccordion.define('sf-accordion');

export {SfSmartAccordion};
