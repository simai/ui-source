import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
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

const applied = () => ({ outcome: 'applied' });
const refused = (reason) => ({ outcome: 'refused', reason });

// The live region a status speaks through (§4.8, §7.4.1): polite for news,
// assertive for a warning or an error.
const ASSERTIVE = new Set(['warning', 'error']);

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
