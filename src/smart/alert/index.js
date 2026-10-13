import SfBaseElement from '../../core/js/smart-base';
import { dismissAlertElement } from '../../component/alerts/dismiss';
import { renderAlertTemplate } from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-alert", code, words).
const ALERT_TEXT = {
  en: {
    closeLabel: 'Close alert',
  },
  ru: {
    closeLabel: 'Закрыть сообщение',
  },
};



class SfAlert extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
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
      icon: { default: '' },
      title: { default: '' },
      supportingText: { default: '' },
      actionText: { default: '' },
      action: { default: 'action' },
      secondaryActionText: { default: '' },
      secondaryAction: { default: 'secondary' },
      closable: { type: Boolean, default: false },
      closeLabel: { default: '' },
      rootClass: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  // The shared status vocabulary. `clear` and `danger` are the words this
  // component used before it; both still work — see contracts/public-api-axes.json.
  get status() {
    return this.getProp('status');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.status;
  }

  get appearance() {
    return this.getProp('appearance');
  }

  // The legacy name for the appearance.
  get variant() {
    return this.appearance;
  }

  get icon() {
    return this.getAttribute('icon') || '';
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  get supportingText() {
    return this.getAttribute('supporting-text') || '';
  }

  get actionText() {
    return this.getAttribute('action-text') || '';
  }

  get action() {
    return this.getAttribute('action') || 'action';
  }

  get secondaryActionText() {
    return this.getAttribute('secondary-action-text') || '';
  }

  get secondaryAction() {
    return this.getAttribute('secondary-action') || 'secondary';
  }

  get closable() {
    return this.getBooleanAttr('closable', false);
  }

  get closeLabel() {
    return this.getAttribute('close-label') || pageText(ALERT_TEXT, "closeLabel", this);
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      closeLabel: this.getAttribute("close-label") || pageText(ALERT_TEXT, "closeLabel", this),
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
    if (!this._boundRoot) {
      return;
    }

    this.addAlertListeners(this._boundRoot);
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
    if (trigger.matches('[data-close], [data-alert-close]')) this._handleCloseClick(event);
    else this._handleActionClick(event, trigger);
  };

  _handleCloseClick = (event) => {
    event.preventDefault();
    this.dismiss();
  };

  _handleActionClick = (event, trigger = event.currentTarget) => {
    this.dispatchEvent(
      new CustomEvent('sf-alert-action', {
        bubbles: true,
        composed: true,
        detail: {
          action: trigger?.getAttribute('data-action')
            || trigger?.getAttribute('data-alert-action')
            || '',
          alert: this,
        },
      }),
    );
  };

  dismiss() {
    this.dispatchEvent(
      new CustomEvent('sf-alert-close', {
        bubbles: true,
        composed: true,
        detail: { alert: this },
      }),
    );

    dismissAlertElement(this._boundRoot || this, this);

    return this;
  }

  close() {
    return this.dismiss();
  }

  onAction(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-alert-action',
        (event) => {
          handler(event.detail?.action, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  onClose(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-alert-close',
        (event) => {
          handler(event.detail, event);
        },
        options,
      );
    }

    return this;
  }
}

SfAlert.define('sf-alert');
