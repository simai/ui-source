import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { bindToast, dismissToast, unbindToast } from '../../component/toast/js/_toast';
import { renderToastTemplate } from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-toast", code, words).
const TOAST_TEXT = {
  en: {
    closeLabel: 'Close message',
  },
  ru: {
    closeLabel: 'Закрыть сообщение',
  },
};




class SfToast extends SfBaseElement {
  static get props() {
    return {
      status: {
        default: 'neutral',
        values: ['neutral', 'info', 'success', 'warning', 'error'],
        aliases: ['type'],
        valueAliases: {neutral: ['default'], info: ['primary']},
      },
      icon: { default: '' },
      title: { default: '' },
      supportingText: { default: '' },
      actionText: { default: '' },
      action: { default: 'action' },
      closable: { type: Boolean, default: true },
      closeLabel: { default: '' },
      duration: { type: Number, default: 0 },
      role: { default: '' },
      rootClass: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  // The shared status vocabulary. This component used `default` for a plain
  // message and `primary` for a highlighted one; both still work — `primary` was
  // a colour in a list of statuses, and its meaning here is info.
  get status() {
    return this.getProp('status');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.status;
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

  get closable() {
    return this.getBooleanAttr('closable', true);
  }

  get closeLabel() {
    return this.getAttribute('close-label') || pageText(TOAST_TEXT, "closeLabel", this);
  }

  get duration() {
    const duration = Number(this.getAttribute('duration'));
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  get role() {
    const role = this.getAttribute('role') || '';
    return role === 'status' || role === 'alert' ? role : '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      closeLabel: this.getAttribute("close-label") || pageText(TOAST_TEXT, "closeLabel", this),
      component: this,
      rootClass: this.getRootClass(),
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
    });
  }

  template() {
    return renderToastTemplate(this.templateContext());
  }

  afterRender() {
    if (this._boundRoot) {
      unbindToast(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-toast');
    if (!this._boundRoot) {
      return;
    }

    bindToast(this._boundRoot, this);
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindToast(this._boundRoot);
      this._boundRoot = null;
    }
  }

  dismiss() {
    if (this._boundRoot) {
      dismissToast(this._boundRoot, this);
    } else if (this.isConnected) {
      this.remove();
    }

    return this;
  }

  close() {
    return this.dismiss();
  }

  get state() {
    return {
      status: this.status,
      type: this.type,
      icon: this.icon,
      title: this.title,
      supportingText: this.supportingText,
      actionText: this.actionText,
      action: this.action,
      closable: this.closable,
      closeLabel: this.closeLabel,
      duration: this.duration,
      role: this.role,
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      if (value === false || value === null || value === undefined || value === '') {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, '');
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }

  onAction(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-toast-action', (event) => {
        handler(event.detail?.action, event.detail, event);
      }, options);
    }

    return this;
  }

  onClose(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-toast-close', (event) => {
        handler(event.detail, event);
      }, options);
    }

    return this;
  }
}

SfToast.define('sf-toast');
