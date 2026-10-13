import registerComponent from '../../register-helper';

const accordionInstances = new WeakMap();
const ACCORDION_GROUP_SELECTOR = '.sf-accordion-group';
const LEGACY_SINGLE_GROUP_SELECTOR = '[data-sf-accordion-mode="single"]';
const PLUS_MINUS_MODIFIER = 'sf-accordion--plus-minus';
let accordionId = 0;

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

    accordionId += 1;
    if (!this.trigger.id) {
      this.trigger.id = `sf-accordion-trigger-${accordionId}`;
    }
    if (!this.content.id) {
      this.content.id = `sf-accordion-panel-${accordionId}`;
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
    if (!this.content) return;

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
