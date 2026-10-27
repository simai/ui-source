import registerComponent from '../../register-helper';
import { instancePath, partId } from '../../../core/js/instance-path.js';

const accordionInstances = new WeakMap();
const ACCORDION_GROUP_SELECTOR = '.sf-accordion-group';
const LEGACY_SINGLE_GROUP_SELECTOR = '[data-sf-accordion-mode="single"]';
const PLUS_MINUS_MODIFIER = 'sf-accordion--plus-minus';
// One section needs no disclosure (simai/ui-source#19, #29; ui-mail P-07): a
// section marked single, or the only section of a group, is a plain section --
// its content always shown, its heading a heading and not a toggle.
const SINGLE_MODIFIER = 'sf-accordion--single';
// A group that keeps its one section a toggle says so.
const SINGLE_TOGGLE_ATTRIBUTE = 'data-single-section';

class SfAccordion {
  static componentName = 'Accordion';

  constructor(el) {
    this.el = el;
    this.content = el?.querySelector?.('.sf-accordion-content') || null;
    this.title = el?.querySelector?.('.sf-accordion-title') || null;
    this.trigger = el?.querySelector?.('.sf-accordion-trigger') || el;
    this.icon =
      this.trigger?.querySelector?.('.sf-icon') ||
      el?.querySelector?.(':scope > .sf-icon') ||
      el?.querySelector?.('.sf-icon');
    this.onClick = this.handleClick.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
  }

  init() {
    if (!this.el || this.el.dataset.sfAccordionInit === '1') return;
    this.el.dataset.sfAccordionInit = '1';
    accordionInstances.set(this.el, this);

    const usesLegacyTrigger = this.trigger === this.el;
    if (usesLegacyTrigger) {
      this.el.classList.add('sf-accordion--legacy');
      if (!this.trigger.hasAttribute('role')) {
        this.trigger.setAttribute('role', 'button');
      }
      if (!this.trigger.hasAttribute('tabindex')) {
        this.trigger.setAttribute('tabindex', '0');
      }
    }

    this.bindRelationship();
    this.syncState();
    this.trigger.addEventListener('click', this.onClick);
    if (usesLegacyTrigger) {
      this.trigger.addEventListener('keydown', this.onKeydown);
    }
    syncSingleSections(this.el.parentElement);
    this.syncSingle();
  }

  // Whether this section is alone: marked single, or the only section of a
  // group that does not keep its one section a toggle. The legacy markup,
  // where the section itself is the control, keeps its toggle.
  isSingle() {
    if (!this.el || this.trigger === this.el || !this.content) return false;
    if (this.el.classList.contains(SINGLE_MODIFIER)) return true;
    const group = this.el.parentElement;
    if (!group?.matches?.(ACCORDION_GROUP_SELECTOR)) return false;
    if (group.getAttribute(SINGLE_TOGGLE_ATTRIBUTE) === 'toggle') return false;
    return group.querySelectorAll(':scope > .sf-accordion').length === 1;
  }

  // A single section: the button gives way to a plain element holding the
  // same title (a heading with nothing to press), and the content is shown.
  // When a second section joins the group the button comes back, open: the
  // content the reader sees does not vanish under them.
  syncSingle() {
    if (!this.el || this.trigger === this.el) return;
    const single = this.isSingle();
    if (single === Boolean(this.staticHeader)) return;
    if (single) {
      const header = document.createElement('span');
      header.className = this.trigger.className;
      header.id = this.trigger.id;
      header.setAttribute('data-sf-accordion-static', '');
      header.append(...this.trigger.childNodes);
      this.trigger.removeAttribute('id');
      this.trigger.replaceWith(header);
      this.staticHeader = header;
      this.el.classList.add('sf-accordion--static');
      this.content.hidden = false;
      this.content.classList.remove('hidden');
      this.el.classList.add('active');
      return;
    }
    const header = this.staticHeader;
    this.trigger.id = header.id;
    this.trigger.append(...header.childNodes);
    header.replaceWith(this.trigger);
    this.staticHeader = null;
    this.el.classList.remove('sf-accordion--static');
    this.setOpen(true);
  }

  destroy() {
    if (!this.el) return;
    this.trigger?.removeEventListener('click', this.onClick);
    this.trigger?.removeEventListener('keydown', this.onKeydown);
    accordionInstances.delete(this.el);
    this.el.classList.remove('sf-accordion--legacy');
    delete this.el.dataset.sfAccordionInit;
  }

  bindRelationship() {
    if (!this.trigger || !this.content) return;

    // A section's path id and a local name (standard 1.3.8 §7.1.1,
    // simai/ui-source#41): <path>--trigger and <path>--panel, the same in every
    // bundle and in server markup. A module counter numbered them in creation
    // order, once per bundle that carries this code.
    const path = instancePath(this.el, { kind: 'sf-accordion' });
    if (!this.trigger.id) {
      this.trigger.id = partId(path, 'trigger');
    }
    if (!this.content.id) {
      this.content.id = partId(path, 'panel');
    }

    this.trigger.setAttribute('aria-controls', this.content.id);
    if (this.content.getAttribute('role') === 'region') {
      this.content.setAttribute('aria-labelledby', this.trigger.id);
    }
  }

  handleClick() {
    this.toggle();
  }

  handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.toggle();
  }

  isOpen() {
    if (!this.content) return false;
    return !this.content.hidden && !this.content.classList.contains('hidden');
  }

  toggle() {
    if (!this.content) return;
    this.setOpen(!this.isOpen());
  }

  setOpen(open) {
    if (!this.content || this.staticHeader) return;

    if (open) {
      this.closeSingleModeSiblings();
    }

    this.content.hidden = !open;
    this.content.classList.toggle('hidden', !open);
    this.syncState();
  }

  closeSingleModeSiblings() {
    const group = this.singleModeGroup();
    if (!group) return;

    group.querySelectorAll(':scope > .sf-accordion').forEach((item) => {
      if (item === this.el) return;
      const instance = accordionInstances.get(item);
      if (instance?.isOpen()) {
        instance.setOpen(false);
      }
    });
  }

  singleModeGroup() {
    const canonicalGroup = this.el.closest?.(ACCORDION_GROUP_SELECTOR);
    if (canonicalGroup) {
      return canonicalGroup.getAttribute('data-mode') === 'single'
        ? canonicalGroup
        : null;
    }

    return this.el.closest?.(LEGACY_SINGLE_GROUP_SELECTOR) || null;
  }

  syncState() {
    const open = this.isOpen();
    this.trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.el?.classList.toggle('active', open);

    if (this.icon) {
      this.icon.textContent = this.el.classList.contains(PLUS_MINUS_MODIFIER)
        ? open
          ? 'remove'
          : 'add'
        : 'chevron_right';
      this.icon.setAttribute('aria-hidden', 'true');
    }
  }
}

// Re-reads whether the sections of a group are single, after a section joined
// or left it.
function syncSingleSections(group) {
  if (!group?.matches?.(ACCORDION_GROUP_SELECTOR)) return;
  group.querySelectorAll(':scope > .sf-accordion').forEach((item) => {
    accordionInstances.get(item)?.syncSingle();
  });
}

function initAccordions(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.sf-accordion').forEach((el) => {
    const inst = accordionInstances.get(el) || new SfAccordion(el);
    inst.init();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAccordions(), {
    once: true,
  });
} else {
  initAccordions();
}

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if ([...mutation.removedNodes].some((node) => node instanceof HTMLElement && node.matches('.sf-accordion'))) {
        syncSingleSections(mutation.target);
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.sf-accordion')) {
          const inst = accordionInstances.get(node) || new SfAccordion(node);
          inst.init();
          return;
        }
        if (node.querySelector?.('.sf-accordion')) {
          initAccordions(node);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

registerComponent('Accordion', SfAccordion);

export default SfAccordion;
