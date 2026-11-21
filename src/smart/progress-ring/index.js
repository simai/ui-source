import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { breakpointMedia } from '../../core/js/breakpoints.js';
import { renderProgressRingTemplate } from './js/templates/default';
import manifest from './component.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// sf-progress-ring from its component.json (standard simai.smart-component
// 1.3.11 §3, §4; the 1.4 folder of five authored files): its settings are
// attributes and properties made by core/js/element-manifest.js, and a job's
// part arrives as the stream fact chunk {done, total} (vocabulary 1.1.5 §5.2),
// which a rule hands to the action chunk, as on sf-progress-bar. The drawing
// is the class component progress-ring's: the value is a custom property on
// the root, the ring carries the role, the slot content stands beside it.
const ProgressRingElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  actions: {
    chunk({ done, total } = {}) {
      return showChunk(this, done, total);
    },
  },
});

// A part of a job as a percentage of the ring: done of total (100 when the
// rule gives none), clamped to 0..100 (vocabulary §5.2).
export function showChunk(element, done, total) {
  const whole = total === undefined || total === null || total === '' ? 100 : Number(total);
  const part = Number(done);
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return { outcome: 'refused', reason: 'invalid' };
  }
  const percent = Math.max(0, Math.min(100, (part / whole) * 100));
  element.value = Math.round(percent * 100) / 100;
  return { outcome: 'applied' };
}

// The status drawn (owner decision C131 (7), as sf-progress-bar 1.2.0): the
// more serious of the page's status and the threshold the value reached. The
// thresholds are the page's, in per cent like the value; unset is none.
const RANK = { warning: 1, error: 2 };

// The tooltips' ids, one per element on the page (stable across renders).
let tipSequence = 0;
export function drawnStatus(status, value, warningAt, errorAt) {
  const number = Number(value);
  let reached = '';
  if (Number.isFinite(number)) {
    if (Number.isFinite(errorAt) && number >= errorAt) reached = 'error';
    else if (Number.isFinite(warningAt) && number >= warningAt) reached = 'warning';
  }
  return (RANK[reached] ?? 0) > (RANK[status] ?? 0) ? reached : status;
}

class SfProgressRing extends ProgressRingElement {
  static get props() {
    return {
      ...super.props,
      // No status (empty) is the theme's primary; neutral is grey (C131 (1)).
      status: {default: '', values: ['', 'neutral', 'info', 'success', 'warning', 'error'], valueAliases: {'': ['primary']}},
    };
  }

  get status() {
    return this.getProp('status');
  }

  // A threshold holds only where the page set it.
  threshold(attribute) {
    if (!this.hasAttribute(attribute)) return null;
    const number = Number(this.getAttribute(attribute));
    return Number.isFinite(number) ? number : null;
  }

  get drawnStatus() {
    return drawnStatus(this.status, this.value, this.threshold('warning-at'), this.threshold('error-at'));
  }

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'aria-label'])];
  }

  // A lone avatar child is the ring's content (owner decision C152 (8), DEV
  // AR-4, fix/avatar-ring-ar1 2026-11-16): the recipe is a ring holding an
  // avatar, and a page that left out slot="content" got the avatar beside
  // the ring, 60 px off its middle. The ring names the slot for it when the
  // avatar (sf-avatar or a class .sf-avatar) is its only element child and
  // no child names the content slot; a printed first paint (data-sf-static)
  // is a picture of the ring, not a child.
  captureSlotTemplates() {
    if (!this._slotTemplatesCaptured && !this.querySelector(':scope > [slot="content"]')) {
      const children = [...this.children].filter((child) => !child.hasAttribute('data-sf-static'));
      const [only] = children;
      if (children.length === 1 && !only.hasAttribute('slot')
        && (only.localName === 'sf-avatar' || only.classList?.contains('sf-avatar'))) {
        only.setAttribute('slot', 'content');
      }
    }
    super.captureSlotTemplates();
  }

  // An avatar the ring cannot take as its content -- beside other children,
  // or under a content slot already named -- stands beside the ring (AR-4,
  // recipe C152 (8)). It is said once a page -- one console warning,
  // wherever the ring is -- and each ring is listed in SF.deprecations, so a
  // person or a probe finds it.
  noteUnslottedAvatar() {
    if (this._unslottedNoted) return;
    const stray = [...this.children].find((child) => (child.localName === 'sf-avatar' || child.classList?.contains('sf-avatar'))
      && !child.hasAttribute('slot') && !child.hasAttribute('data-sf-held'));
    if (!stray) return;
    this._unslottedNoted = true;
    noteDeprecated({component: 'sf-progress-ring', tag: 'sf-progress-ring', kind: 'markup', attribute: 'slot', from: 'sf-avatar without slot', to: 'slot="content"'});
    const root = globalThis.SF = globalThis.SF || {};
    if (root.__progressRingAvatarWarned) return;
    Object.defineProperty(root, '__progressRingAvatarWarned', {value: true, configurable: true});
    globalThis.console?.warn?.(`[SIMAI Framework] sf-progress-ring${this.id ? ` #${this.id}` : ''}: an sf-avatar inside the ring beside other content is drawn beside the ring, not in it. Give the sf-avatar slot="content" (decision C152 (8)).`);
  }

  // The tooltip's id, one per element on the page (stable across renders),
  // asked for only where the ring shows its value as a tooltip (show-text up to
  // size 1, DEV msg-1c3a4f0b); the tooltip relation is lazy.
  tooltipId(props) {
    const shown = props.showText === true || props.showText === '' || props.showText === 'true';
    const textless = ['1/4', '1/3', '1/2', '1'].includes(String(props.size ?? '1')) || this._textHidden;
    if (!shown || !textless || this.hasSlotContent?.('content')) return '';
    if (!this._tipId) this._tipId = this.id ? `${this.id}--tooltip` : `sf-progress-ring-tip-${++tipSequence}`;
    globalThis.SF?.Loader?.ensurePlugin?.('tooltip');
    return this._tipId;
  }

  templateContext() {
    this.noteUnslottedAvatar();
    const status = this.drawnStatus;
    this.sfHostState('data-status', status);
    const props = this.getPropsContext();
    return this.createTemplateContext({
      ...props,
      drawnStatus: status,
      label: this.accessibleLabel,
      tipId: this.tooltipId(props),
      textHidden: Boolean(this._textHidden),
      content: this.hasSlotContent?.('content') ? this.getSlotContent('content') : null,
      rootClass: this.getRootClass(),
      component: this,
    });
  }

  template() {
    return renderProgressRingTemplate(this.templateContext());
  }

  // A value that fits no text step is not drawn inside (1.7.1: «100%» at
  // size 2 of a compact region on a wide screen, where 12 px is the floor of
  // the text ladder); then it carries the same tooltip as a ring of size 1
  // (1.7.2, DEV look answer msg-8e6b1330). The sheet decides, so the ring
  // reads what it drew after each draw and when the screen crosses 60rem, the
  // width the sheet's rule starts at (lg).
  afterRender() {
    const view = this.ownerDocument?.defaultView;
    if (!this._wideQuery && view?.matchMedia) {
      // lg, the step the sheet's @media (min-width: 60rem) is written at.
      this._wideQuery = breakpointMedia('lg', {view});
      this._onWide = () => this.readTextHidden();
      this._wideQuery.addEventListener?.('change', this._onWide);
    }
    this.readTextHidden();
  }

  readTextHidden() {
    const text = this.querySelector('.sf-progress-ring-content--long[aria-hidden="true"]');
    const hidden = Boolean(text) && this.ownerDocument.defaultView.getComputedStyle(text).display === 'none';
    if (hidden === Boolean(this._textHidden)) return;
    this._textHidden = hidden;
    this.requestComponentUpdate('text-hidden');
  }

  disconnectedCallback() {
    this._wideQuery?.removeEventListener?.('change', this._onWide);
    this._wideQuery = null;
    super.disconnectedCallback?.();
  }
}

SfProgressRing.define('sf-progress-ring');
