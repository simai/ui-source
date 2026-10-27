import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { bindToast, dismissToast, unbindToast } from '../../component/toast/js/_toast';
import { renderToastTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-toast from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product adds
// a language through SF.language.register("sf-toast", code, words)), and the
// old names title and type are dated aliases.
const ToastElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const applied = () => ({ outcome: 'applied' });
const refused = (reason) => ({ outcome: 'refused', reason });

class SfToast extends ToastElement {
  static get props() {
    return {
      ...super.props,
      // The shared status vocabulary. This component used `default` for a plain
      // message and `primary` for a highlighted one; both still work — `primary`
      // was a colour in a list of statuses, and its meaning here is info.
      status: {
        default: 'neutral',
        values: ['neutral', 'info', 'success', 'warning', 'error'],
        aliases: ['type'],
        valueAliases: {neutral: ['default'], info: ['primary']},
      },
      // A host attribute (§3.1): status or alert, written on the toast's root.
      role: { default: '' },
      rootClass: { default: '' },
    };
  }

  constructor() {
    super();
    this._boundRoot = null;
    this._closeReason = 'api';
  }

  get status() {
    return this.getProp('status');
  }

  get duration() {
    const duration = Number(this.getAttribute('duration'));
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  // The root's role: the host's role attribute when it says status or alert.
  get toastRole() {
    const role = this.getAttribute('role') || '';
    return role === 'status' || role === 'alert' ? role : '';
  }

  onConnected() {
    super.onConnected?.();
    // The shared class toast sends its events on its root with the elements in
    // detail; the element's own events are sent from the host with data only
    // (§8), so the class events stop here.
    this.addEventListener('sf-toast-close', this._onRootClose, true);
    this.addEventListener('sf-toast-action', this._onRootAction, true);
  }

  _onRootClose = (event) => {
    if (event.target === this) return;
    event.stopImmediatePropagation();
    const reason = event.detail?.trigger ? 'close' : this._closeReason;
    this._closeReason = 'api';
    // A refused request keeps the toast (§19.3): the class dismissal hears the
    // cancel on its own event.
    if (!this.sfEmit('close', { reason }, { cancelable: true })) {
      event.preventDefault();
      return;
    }
    this.sfEmit('closed', { reason });
  };

  _onRootAction = (event) => {
    if (event.target === this) return;
    event.stopImmediatePropagation();
    this.sfEmit('action', { action: event.detail?.action ?? '' });
  };

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      closeLabel: this.closeLabel,
      component: this,
      rootClass: this.getRootClass(),
      // Resolved names the template reads (contracts/template-context.json).
      title: this.heading,
      type: this.status,
      role: this.toastRole,
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

  // Closes the toast with reason api. Answers an outcome (§4.4): refused when
  // a listener prevents sf-toast-close.
  close() {
    if (!this._boundRoot) {
      if (!this.isConnected) return refused('closed');
      this.remove();
      return applied();
    }
    this._closeReason = 'api';
    return dismissToast(this._boundRoot, this) ? applied() : refused('prevented');
  }

  // Says a message: text (the assembly's word for code and count, §11.2) is the
  // heading, tone the status.
  show(params = {}) {
    const text = typeof params === 'string' ? params : params?.text;
    if (typeof text === 'string' && text) this.setAttribute('heading', text);
    if (params?.tone) this.setAttribute('status', params.tone);
    return this.isConnected ? applied() : refused('closed');
  }

  get state() {
    return {
      status: this.status,
      icon: this.icon,
      heading: this.heading,
      supportingText: this.supportingText,
      actionText: this.actionText,
      action: this.action,
      closable: this.closable,
      closeLabel: this.closeLabel,
      duration: this.duration,
      role: this.toastRole,
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
        if (event.target === this) handler(event.detail?.action, event.detail, event);
      }, options);
    }

    return this;
  }

  onClose(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-toast-close', (event) => {
        if (event.target === this) handler(event.detail, event);
      }, options);
    }

    return this;
  }
}

SfToast.define('sf-toast');
