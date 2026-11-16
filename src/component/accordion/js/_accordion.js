import registerComponent from '../../register-helper';
import { instancePath, partId } from '../../../core/js/instance-path.js';
import { moveSection, sectionHeight, stopSectionMotion } from './motion.js';

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
// Every closed panel is findable (owner decision C154 (6)): it is closed
// with hidden="until-found", so the browser's find-in-page searches it and
// opens it, firing beforematch first, and the section follows (aria-expanded,
// the active mark, the marker). A panel the page closed with the hidden
// attribute or the hidden class becomes findable when the runtime takes it;
// the hidden class is never left on a closed panel, as its display: none
// would take the text out of the search (accordion study AC-8). A browser
// without until-found hides such a panel as it hides any hidden one.
const UNTIL_FOUND = 'until-found';
// Marks a section whose panel is closed but still drawn while the section
// shrinks to its header (C154 (4)); the class sheet keeps it in view.
const CLOSING_ATTRIBUTE = 'data-sf-accordion-closing';
// The marker is the header's last icon; an icon before the title
// (.sf-accordion-lead) is not the marker and keeps its glyph.
const MARKER_SELECTOR = '.sf-icon:not(.sf-accordion-lead)';

class SfAccordion {
  static componentName = 'Accordion';

  constructor(el) {
    this.el = el;
    this.content = el?.querySelector?.('.sf-accordion-content') || null;
    this.title = el?.querySelector?.('.sf-accordion-title') || null;
    this.trigger = el?.querySelector?.('.sf-accordion-trigger') || el;
    const markers = this.trigger?.querySelectorAll?.(MARKER_SELECTOR);
    this.icon =
      (markers?.length ? markers[markers.length - 1] : null) ||
      el?.querySelector?.(`:scope > ${MARKER_SELECTOR}`) ||
      el?.querySelector?.(MARKER_SELECTOR);
    this.onClick = this.handleClick.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
    this.onBeforeMatch = this.handleBeforeMatch.bind(this);
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
    // A closed panel is hidden for everyone from the first paint, not only to
    // the eye: markup that closes it with the `hidden` class alone (a utility
    // that may not have arrived yet) gets the `hidden` attribute too, so its
    // content is out of the tab order and the accessibility tree before the
    // first toggle (simai/ui-source#30).
    // A closed panel is findable from here on: hidden="until-found".
    if (this.content && !this.isOpen()) {
      this.hideContent();
    }
    this.syncState();
    this.trigger.addEventListener('click', this.onClick);
    this.content?.addEventListener('beforematch', this.onBeforeMatch);
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
    this.content?.removeEventListener('beforematch', this.onBeforeMatch);
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

  // Find-in-page found text in a closed panel: the browser is about to show
  // it, so the section opens as a click would open it -- aria-expanded, the
  // active mark, the chevron, and in single mode the other section closes.
  // The browser shows the text at once, so the section does not move.
  handleBeforeMatch() {
    if (this.staticHeader) return;
    this.setOpen(true, { motion: false });
  }

  // Closes the panel: hidden="until-found", findable, never the hidden class.
  hideContent() {
    this.content.setAttribute('hidden', UNTIL_FOUND);
    this.content.classList.remove('hidden');
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

  // Opens or closes the panel. The section moves to its new height on the
  // sheet's clock (C154 (4)); a closing panel stays drawn until the section
  // has shrunk to its header. No motion under reduced motion.
  setOpen(open, { motion = true } = {}) {
    if (!this.content || this.staticHeader) return;

    const from = sectionHeight(this.el);
    stopSectionMotion(this.el);
    this.el.removeAttribute(CLOSING_ATTRIBUTE);
    if (open) {
      this.closeSingleModeSiblings();
      this.content.hidden = false;
      this.content.classList.remove('hidden');
    } else {
      this.hideContent();
    }
    this.syncState();
    if (!motion) return;
    const moving = moveSection(this.el, from, () => this.el.removeAttribute(CLOSING_ATTRIBUTE));
    if (moving && !open) this.el.setAttribute(CLOSING_ATTRIBUTE, '');
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
