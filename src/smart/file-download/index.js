import {
  bindDownloadFile,
  buildAnchorDownload,
  fileSaid,
  nameFromHref,
  unbindDownloadFile,
} from '../../component/download-file/js/_download-file';
import { noteDeprecated } from '../../core/js/deprecations';
import { pageLocale } from '../../core/js/page-language';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { instancePath, partId } from '../../core/js/instance-path.js';
import { renderDownloadFileTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-file-download from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. A press sends the
// cancelable request sf-file-download-request {href, fileName, download}
// (vocabulary 1.1.5 §5.1) on the host; its former names --
// sf-file-download-download, sf-download-file-download and the class event
// sf-download-file:click -- follow it as dated aliases (aliases.json), and a
// refused request stops the download.
const DownloadFileElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
  // «Не удалось подготовить файл» was the heading of the notice under the
  // file; the row now says «Не удалось собрать» itself (decision C51). A word
  // a page registered under the old key is still said until the day.
  formerWords: { since: '2026-11-11', remove_after: '2027-01-01', words: { 'failed-text': 'error-heading' } },
});

const STATES = ['ready', 'preparing', 'error'];
// The settings that can draw the file as another element (a button or a link).
const REDRAWN_BY = new Set(['href', 'disabled', 'state', 'target']);
// A file that comes within this long after the press, while the page is in
// sight, is fetched by itself; later, or on a hidden page, it waits for
// «Скачать» (decision C51): a download that arrives unasked surprises, and a
// phone may ask first.
const FETCH_ITSELF_WITHIN = 10000;
// A failed row in a column narrower than this (22.5rem, 360 px) puts
// «Повторить» under its text, from the text's edge (owner decision C88).
const NARROW_BELOW_REM = 22.5;

// The box that holds the row: the first ancestor that draws one (the host is
// display: contents).
function layoutParent(node) {
  for (let current = node.parentElement; current; current = current.parentElement) {
    if (getComputedStyle(current).display !== 'contents') return current;
  }
  return null;
}

// An element's max-content width, read with its inline size freed for one
// layout and given back.
function maxContentWidth(element) {
  const { style } = element;
  const saved = [style.getPropertyValue('inline-size'), style.getPropertyPriority('inline-size'),
    style.getPropertyValue('max-inline-size'), style.getPropertyPriority('max-inline-size')];
  style.setProperty('inline-size', 'max-content', 'important');
  style.setProperty('max-inline-size', 'none', 'important');
  const width = element.getBoundingClientRect().width;
  if (saved[0]) style.setProperty('inline-size', saved[0], saved[1]); else style.removeProperty('inline-size');
  if (saved[2]) style.setProperty('max-inline-size', saved[2], saved[3]); else style.removeProperty('max-inline-size');
  return width;
}

function contentWidth(element) {
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingInlineStart) || 0) - (parseFloat(style.paddingInlineEnd) || 0);
}

class SfDownloadFile extends DownloadFileElement {
  constructor() {
    super();
    this._boundRoot = null;
    // A press the host answered by preparing the file: when the file is ready
    // (state back to ready with an href) it is fetched, as the person asked
    // (decision C25) -- by itself within ten seconds on a page in sight, else
    // by «Скачать» (C51). A file prepared before anyone pressed is not.
    this._awaiting = false;
    this._pressedAt = 0;
    this._offer = false;
    this._cancelAsked = false;
    this._refocus = false;
    this._resolvedSize = '';
    this._live = { polite: '', assertive: '' };
    // A failed row's fit (decision C88): narrow puts «Повторить» under the
    // text, retryIcon draws it as the icon alone; retryWidth is the width of
    // the button with its words, measured while it had them.
    this._narrow = false;
    this._retryIcon = false;
    this._retryWidth = 0;
    this._retryReach = 0;
    this._fitObserver = null;
    this._fitFrame = 0;
    this._onPress = (event) => this.onPress(event);
  }

  get shownState() {
    const value = this.getAttribute('state');
    return STATES.includes(value) ? value : 'ready';
  }

  // What the row shows: the state, and offer for a ready file that waits for
  // its «Скачать».
  get view() {
    const state = this.shownState;
    if (state === 'ready' && this._offer && this.getAttribute('href') && !this.hasAttribute('disabled')) return 'offer';
    return state;
  }

  // What the template draws is what the component answers (template-context):
  // an absent name is the link's last part, else «Файл»; a file link
  // downloads in the same tab unless target="_blank" opens it to view
  // (decision C25), whether or not the download attribute is given.
  get fileName() {
    return this.getAttribute('file-name') || nameFromHref(this.getAttribute('href') || '') || this.sfWord('file');
  }

  get download() {
    return Boolean(this.getAttribute('href')) && this.getAttribute('target') !== '_blank';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  // The share made so far, 0 to 100, or null when the host does not know it
  // (the spinner then stands in the sign's place).
  get shownValue() {
    const raw = this.getAttribute('value');
    if (raw === null || raw.trim() === '') return null;
    const number = Number(raw);
    if (!Number.isFinite(number)) return null;
    return Math.min(100, Math.max(0, Math.round(number)));
  }

  get shownSize() {
    return this.getAttribute('file-size') || this._resolvedSize || '';
  }

  // The sign is the download sign (decision C25): a file-type glyph in its
  // place read as «open a document». icon is still drawn until 2027-01-01 and
  // noted once; the type is file-type, in words.
  get signIcon() {
    const icon = this.getAttribute('icon');
    if (!icon || icon === 'download') return 'download';
    if (!this._iconNoted) {
      this._iconNoted = true;
      noteDeprecated({ component: 'sf-file-download', tag: 'sf-file-download', kind: 'setting', attribute: 'icon',
        from: 'icon', to: 'file-type', since: '2026-11-09', remove_after: '2027-01-01' });
    }
    return icon;
  }

  percentText(value) {
    try {
      return new Intl.NumberFormat(pageLocale(this), { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
    } catch {
      return `${value} %`;
    }
  }

  templateContext() {
    const props = this.getPropsContext();
    const href = this.getAttribute('href') || '';
    const opensTab = Boolean(href) && this.getAttribute('target') === '_blank';
    const name = this.fileName;
    const fileType = this.getAttribute('file-type') || '';
    const fileSize = this.shownSize;
    const value = this.shownValue;

    return this.createTemplateContext({
      ...props,
      size: this.size,
      state: this.shownState,
      view: this.view,
      // No invented file: an absent name is the link's last part, else «Файл».
      fileName: name,
      fileType,
      fileSize,
      // «, CSV, 112 байт»: what a screen reader hears after the name.
      said: fileSaid(fileType, fileSize, this),
      icon: this.signIcon,
      opensTab,
      // A file link downloads where the person is (decision C25): the
      // download semantics are the default, a tab opened to view has none.
      download: this.download,
      fullWidth: this.hasAttribute('full-width') && this.getAttribute('full-width') !== 'false',
      value,
      cancelable: this.hasAttribute('cancelable') && this.getAttribute('cancelable') !== 'false',
      errorText: this.getAttribute('error-text') || '',
      narrow: this._narrow,
      retryIcon: this._retryIcon,
      tipIds: this.view === 'error'
        ? {
          name: partId(instancePath(this, { kind: 'sf-file-download' }), 'name'),
          retry: this._retryIcon ? partId(instancePath(this, { kind: 'sf-file-download' }), 'retry') : '',
        }
        : {},
      words: {
        preparing: this.sfWord('preparing-text'),
        preparingValue: value === null ? '' : this.sfWord('preparing-value-text', { vars: { percent: this.percentText(value) } }),
        failed: this.sfWord('failed-text'),
        retry: this.sfWord('retry-text'),
        retryLabel: this.sfWord('retry-label', { vars: { name } }),
        cancel: this.sfWord('cancel-text'),
        cancelLabel: this.sfWord('cancel-label', { vars: { name } }),
        ready: this.sfWord('ready-text'),
        get: this.sfWord('get-text'),
        getLabel: this.sfWord('get-label', { vars: { name } }),
        newTab: this.sfWord('new-tab-text'),
      },
      live: this._live,
      ariaLabel: this.getAttribute('aria-label') || '',
      component: this,
    });
  }

  // A line for the live regions: polite for the start, the end and a cancel,
  // assertive for an error (decision C51). The other region is emptied, so a
  // later line of the same words is said again.
  say(text, { urgent = false } = {}) {
    this._live = urgent ? { polite: '', assertive: text } : { polite: text, assertive: '' };
    this.requestComponentUpdate?.('live');
  }

  // Did the focus sit on what this element drew (read before a change draws
  // anything)?
  holdsFocus() {
    const active = this.ownerDocument.activeElement;
    return Boolean(active && active !== this.ownerDocument.body && this.contains(active));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // The file is a button until it has an address and a link after (a host
    // that prepares the file sets href when it is ready), and a row that
    // cannot be pressed when it failed or waits for «Скачать»: the new element
    // takes the focus the old one held, so a keyboard user is not dropped to
    // the page's body. Only when the focus was on the file; read before the
    // change draws anything.
    if (oldValue !== newValue && REDRAWN_BY.has(name) && this.holdsFocus()) {
      this._refocus = true;
    }
    if (name === 'href' && oldValue !== newValue) this._resolvedSize = '';
    // Another size or another state draws «Повторить» anew: its width with
    // its words is measured again.
    if ((name === 'size' || name === 'state' || name === 'lang') && oldValue !== newValue) {
      this._retryIcon = false;
      this._retryWidth = 0;
    }
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name !== 'state' || oldValue === newValue) return;
    const next = STATES.includes(newValue) ? newValue : 'ready';
    const previous = STATES.includes(oldValue) ? oldValue : 'ready';
    const file = this.fileName;
    // A state the page was written with is shown, not said: only a change
    // while the file is on the page is announced.
    const shown = this.isRendered;
    if (next === 'preparing') {
      this._offer = false;
      this._cancelAsked = false;
      if (shown) this.say(this.sfWord('said-preparing', { vars: { name: file } }));
      return;
    }
    if (next === 'error') {
      this._offer = false;
      this._awaiting = false;
      this._cancelAsked = false;
      const reason = this.getAttribute('error-text') || '';
      if (shown) this.say(`${this.sfWord('said-failed', { vars: { name: file } })}${reason ? ` ${reason}` : ''}`, { urgent: true });
      return;
    }
    if (previous !== 'preparing') return;
    // Back to ready after «Отменить»: the file was not made.
    if (this._cancelAsked) {
      this._cancelAsked = false;
      this._awaiting = false;
      if (shown) this.say(this.sfWord('said-cancelled', { vars: { name: file } }));
      return;
    }
    if (!shown) return;
    const href = this.getAttribute('href');
    if (!href || this.hasAttribute('disabled')) {
      this._awaiting = false;
      return;
    }
    const said = fileSaid(this.getAttribute('file-type') || '', this.shownSize, this);
    if (!this._awaiting) {
      this.say(this.sfWord('said-ready', { vars: { name: file, said } }));
      return;
    }
    this._awaiting = false;
    const inTime = Date.now() - this._pressedAt <= FETCH_ITSELF_WITHIN;
    const inSight = this.ownerDocument.visibilityState !== 'hidden';
    if (inTime && inSight) {
      buildAnchorDownload(href, this.getAttribute('file-name') || nameFromHref(href));
      this.say(this.sfWord('said-fetched', { vars: { name: file, said } }));
      return;
    }
    this._offer = true;
    this.say(this.sfWord('said-offer', { vars: { name: file, said } }));
    this.requestComponentUpdate?.('state');
  }

  template() {
    return renderDownloadFileTemplate(this.templateContext());
  }

  // The class binder's activation, as the element's request: false when a
  // listener refused it. A refused request is the host taking the download
  // over -- preparing the file, perhaps -- so the press is remembered.
  requestDownload = (detail) => {
    const delivered = this.sfEmit('request', detail, { cancelable: true });
    this._awaiting = !delivered;
    if (!delivered) this._pressedAt = Date.now();
    return delivered;
  };

  // The size the class binder asked of the file (one HEAD to this page's own
  // server): drawn by the template, which also says it.
  takeResolvedSize = (text) => {
    if (this.getAttribute('file-size') || this._resolvedSize === text) return;
    this._resolvedSize = text;
    this.requestComponentUpdate?.('file-size');
  };

  // The buttons the row draws (decision C51): «Повторить» in a row that
  // failed, «Отменить» beside one being made, «Скачать» beside one ready.
  onPress(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('.sf-download-file__retry, .sf-download-file__cancel, .sf-download-file__get');
    if (!control || !this.contains(control)) return;
    const href = this.getAttribute('href') || '';
    const fileName = this.getAttribute('file-name') || '';

    if (control.classList.contains('sf-download-file__retry')) {
      if (this.shownState !== 'error') return;
      // The press counts as the person's: the file is fetched when it is made.
      this._awaiting = true;
      this._pressedAt = Date.now();
      // The row and its button are drawn again when the host starts preparing
      // the file; the focus is kept on the file the person asked for (docs
      // acceptance 2026-11-10, L1).
      this._refocus = true;
      this.sfEmit('retry', { href, fileName });
      return;
    }

    if (control.classList.contains('sf-download-file__cancel')) {
      if (this.shownState !== 'preparing') return;
      this._refocus = true;
      // A cancelable request: a host that answers it itself prevents it;
      // otherwise the file is back as it was before the press.
      // The host that prevents it sets ready itself when the work stopped;
      // either way the return to ready is said as a cancel.
      this._cancelAsked = true;
      this._awaiting = false;
      const goes = this.sfEmit('cancel', { href, fileName }, { cancelable: true });
      if (goes) this.setAttribute('state', 'ready');
      return;
    }

    // «Скачать»: the person's fresh press fetches the file; the row is the
    // file's link again and takes the focus.
    if (this.view !== 'offer' || !href) return;
    this._offer = false;
    this._refocus = true;
    buildAnchorDownload(href, fileName || nameFromHref(href));
    this.requestComponentUpdate?.('state');
  }

  onConnected() {
    super.onConnected?.();
    this.addEventListener('click', this._onPress);
  }

  // Where the focus goes when what held it was drawn away: the button the
  // row now offers, else the row.
  focusTarget() {
    const view = this.view;
    const host = view === 'error'
      ? this.querySelector('.sf-download-file__retry')
      : view === 'offer'
        ? this.querySelector('.sf-download-file__get')
        : null;
    return host || this._boundRoot;
  }

  afterRender() {
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }

    const root = this.querySelector('.sf-download-file');
    this._boundRoot = root?.matches('a, button') ? root : null;
    if (this._boundRoot) {
      // The class script binds every .sf-download-file it finds on the page; a
      // root it reached first is bound again with the element's request.
      unbindDownloadFile(this._boundRoot);
      bindDownloadFile(this._boundRoot, { onActivate: this.requestDownload, onSize: this.takeResolvedSize });
    }

    this.watchFit();

    // After «Повторить», «Отменить» or «Скачать», or when the file was drawn
    // as another element while it held the focus (the button became the link,
    // the row failed): the file, or the button it now offers, takes the focus
    // back -- only if the focus was lost with it, never taken from where the
    // person has moved since.
    if (this._refocus) {
      this._refocus = false;
      const active = document.activeElement;
      if (!active || active === document.body) {
        const target = this.focusTarget();
        if (target === this._boundRoot && this._boundRoot) {
          this._boundRoot.focus({ preventScroll: true });
        } else if (target) {
          // An sf-button draws its own button and shows it once its sheets
          // are applied: before that the button takes no focus (the probe of
          // 2026-11-11 found the focus left on the body). Focus it when it has
          // rendered.
          const place = () => {
            const now = document.activeElement;
            if (target.isConnected && (!now || now === document.body)) target.focus({ preventScroll: true });
          };
          customElements.whenDefined(target.localName).then(() => {
            if (target.isRendered === false && typeof target.whenRendered === 'function') target.whenRendered(place);
            else place();
          });
        }
      }
    }
  }

  // A failed row's fit (decision C88), measured after it is drawn and again
  // when its column or the row changes size: narrow below 22.5rem of the
  // column, and the icon alone only while narrow and the button with its
  // words is wider than the text column it would stand under (it reaches
  // into the gap before the text by its own padding, so its words line up
  // with the text).
  fitError() {
    const row = this.view === 'error' ? this.querySelector('.sf-download-file--error') : null;
    if (!row) {
      this._fitObserver?.disconnect();
      return;
    }
    const column = layoutParent(this);
    const rem = parseFloat(getComputedStyle(this.ownerDocument.documentElement).fontSize) || 16;
    const width = column ? contentWidth(column) : 0;
    const narrow = width > 0 && width < NARROW_BELOW_REM * rem;

    // The button's own width with its words (max-content): under the text a
    // button wider than its column is squeezed to it, so its drawn width
    // cannot tell whether the words fit.
    const button = row.querySelector('.sf-download-file__retry > button');
    if (!this._retryIcon && button) {
      const measured = maxContentWidth(button);
      if (measured > 0) {
        this._retryWidth = measured;
        this._retryReach = parseFloat(getComputedStyle(button).paddingInlineStart) || 0;
      }
    }

    let retryIcon = false;
    if (narrow && this._narrow && this._retryWidth > 0) {
      const text = row.querySelector('.sf-download-file__text');
      // The text column the row would have at the column's whole width: the
      // column less what the row draws beside the text (border, padding, sign
      // and gap).
      const beside = text ? row.getBoundingClientRect().width - text.getBoundingClientRect().width : 0;
      const room = width - beside + this._retryReach;
      retryIcon = this._retryWidth > room + 0.5;
    }

    if (narrow === this._narrow && retryIcon === this._retryIcon) return;
    if ((retryIcon !== this._retryIcon) && this.holdsFocus()) this._refocus = true;
    this._narrow = narrow;
    this._retryIcon = narrow ? retryIcon : false;
    this.requestComponentUpdate?.('fit');
  }

  watchFit() {
    if (this.view !== 'error') {
      this._fitObserver?.disconnect();
      return;
    }
    if (typeof ResizeObserver === 'undefined') return;
    if (!this._fitObserver) {
      this._fitObserver = new ResizeObserver(() => {
        if (this._fitFrame) return;
        this._fitFrame = requestAnimationFrame(() => {
          this._fitFrame = 0;
          this.fitError();
        });
      });
      globalThis.document?.fonts?.ready?.then?.(() => this.fitError());
    }
    this._fitObserver.disconnect();
    const column = layoutParent(this);
    const row = this.querySelector('.sf-download-file--error');
    const retry = this.querySelector('.sf-download-file__retry');
    if (column) this._fitObserver.observe(column);
    if (row) this._fitObserver.observe(row);
    // The button draws itself after the row: its first size starts the fit.
    if (retry) customElements.whenDefined(retry.localName).then(() => {
      const inner = retry.querySelector(':scope > button');
      if (inner && this._fitObserver) this._fitObserver.observe(inner);
      this.fitError();
    });
    this.fitError();
  }

  onDisconnected() {
    this._fitObserver?.disconnect();
    this._fitObserver = null;
    if (this._fitFrame) cancelAnimationFrame(this._fitFrame);
    this._fitFrame = 0;
    this.removeEventListener('click', this._onPress);
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfDownloadFile.define('sf-file-download');
