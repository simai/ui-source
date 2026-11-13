import SfBaseElement from '../../core/js/smart-base';
import { applied, refused, elementFromManifest } from '../../core/js/element-manifest';
import { dismissAlertElement } from '../../component/alerts/dismiss';
import { renderAlertTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-alert from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §4.8, §8): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product adds
// a language through SF.language.register("sf-alert", code, words)), and the
// old names title, type, variant and dismiss() are dated aliases.
const AlertElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});


// The live region a status speaks through (§4.8, §7.4.1): polite for news,
// assertive for a warning or an error.
const ASSERTIVE = new Set(['warning', 'error']);

// A notice printed with the page is not news (NS-1, notices study
// 2026-11-12; WAI-ARIA APG alert: an alert present before the page has loaded
// is not announced and must not interrupt). So an alert the page had before
// its load event -- or whose server-printed first paint is in it -- is a
// polite status at every level; an alert put in the page after the load, or
// put back after it was taken out, speaks with its level's role. The host's
// own role attribute, status or alert (§3.1, as on sf-toast), is the author's
// choice and always wins.
// The page is settled at its load event and, on a page the Loader drives,
// once the Loader has sent sf-loader-ready ("all components loaded"): a page's
// own Smart modules can arrive after the load event, and their elements are
// defined in a batch on a later frame, so the alerts in the page at that
// moment are noted then. A module that arrives after the page settled was
// asked for by an alert put in later, which speaks.
const loaderPending = () => typeof window !== 'undefined' && Boolean(window.SF?.Loader) && !window.SF.Loader.eventSend;
let pageLoaded = typeof document === 'undefined' || (document.readyState === 'complete' && !loaderPending());
const inPageAtLoad = new WeakSet();
if (!pageLoaded) {
  const settle = () => {
    if (pageLoaded || document.readyState !== 'complete' || loaderPending()) return;
    document.querySelectorAll('sf-alert').forEach((element) => inPageAtLoad.add(element));
    pageLoaded = true;
  };
  window.addEventListener('load', settle, {once: true});
  window.addEventListener('sf-loader-ready', () => setTimeout(settle, 0), {once: true});
}

class SfAlert extends AlertElement {
  static get props() {
    return {
      ...super.props,
      // The shared status vocabulary. `clear` and `danger` are the words this
      // component used before it; both still work — see contracts/public-api-axes.json.
      status: {
        default: 'neutral',
        values: ['neutral', 'info', 'success', 'warning', 'error'],
        aliases: ['type'],
        valueAliases: {neutral: ['clear'], error: ['danger']},
      },
      appearance: {
        default: 'default',
        values: ['default', 'outlined', 'flat'],
        aliases: ['variant'],
      },
      rootClass: { default: '' },
    };
  }

  constructor() {
    super();
    this._boundRoot = null;
    // In the page before the load, or carrying its server-printed first paint.
    this._printedWithPage = !pageLoaded || inPageAtLoad.has(this)
      || Boolean(this.querySelector?.(':scope > [data-sf-static]'));
    this._connectedBefore = false;
  }

  onConnected() {
    super.onConnected?.();
    // Taken out and put back after the load: it is revealed, so it speaks.
    if (this._connectedBefore && pageLoaded && this._printedWithPage) {
      this._printedWithPage = false;
    }
    this._connectedBefore = true;
  }

  get status() {
    return this.getProp('status');
  }

  set status(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('status');
    else this.setAttribute('status', String(value));
  }

  get appearance() {
    return this.getProp('appearance');
  }

  set appearance(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('appearance');
    else this.setAttribute('appearance', String(value));
  }

  get liveRole() {
    const own = this.getAttribute('role');
    if (own === 'status' || own === 'alert') return own;
    if (this._printedWithPage) return 'status';
    return ASSERTIVE.has(this.status) ? 'alert' : 'status';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      heading: this.heading,
      status: this.status,
      appearance: this.appearance,
      closeLabel: this.closeLabel,
      liveRole: this.liveRole,
      // The name (§4.8): the heading, else the host's aria-label (§3.1).
      accessibleName: this.heading || this.getAttribute('aria-label') || '',
      component: this,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderAlertTemplate(this.templateContext());
  }

  afterRender() {
    if (this._boundRoot) {
      this.removeAlertListeners(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-alert');
    if (this._boundRoot) this.addAlertListeners(this._boundRoot);
  }

  onDisconnected() {
    if (this._boundRoot) {
      this.removeAlertListeners(this._boundRoot);
      this._boundRoot = null;
    }
  }

  addAlertListeners(root) {
    root.addEventListener('click', this._handleRootClick);
  }

  removeAlertListeners(root) {
    root.removeEventListener('click', this._handleRootClick);
  }

  _handleRootClick = (event) => {
    const trigger = event.target?.closest?.('[data-close], [data-alert-close], [data-action], [data-alert-action]');
    if (!trigger || !this._boundRoot?.contains(trigger) || trigger.closest('.sf-alert') !== this._boundRoot) return;
    if (trigger.matches(':disabled, [aria-disabled="true"]')) return;

    // Nested Smart buttons transfer data attributes onto their native button.
    // Delegation survives that transfer and subsequent child renders.
    if (trigger.matches('[data-close], [data-alert-close]')) {
      event.preventDefault();
      this._dismiss('close');
      return;
    }
    // An action of the alert's own (§8 own verb): data only in detail.
    this.sfEmit('action', {
      action: trigger.getAttribute('data-action') || trigger.getAttribute('data-alert-action') || '',
    });
  };

  // The request first (cancelable, §8); a page that prevents it keeps the alert.
  _dismiss(reason) {
    if (!this.isConnected) return refused('closed');
    if (!this.sfEmit('close', { reason }, { cancelable: true })) return refused('prevented');
    dismissAlertElement(this._boundRoot || this, this);
    return applied();
  }

  // Dismisses the alert with reason api. Answers an outcome (§4.4).
  close() {
    return this._dismiss('api');
  }

  onAction(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-alert-action', (event) => {
        if (event.target === this) handler(event.detail?.action, event.detail, event);
      }, options);
    }

    return this;
  }

  onClose(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-alert-close', (event) => {
        if (event.target === this) handler(event.detail, event);
      }, options);
    }

    return this;
  }
}

SfAlert.define('sf-alert');
