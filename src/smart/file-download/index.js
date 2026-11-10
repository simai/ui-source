import {
  bindDownloadFile,
  buildAnchorDownload,
  nameFromHref,
  unbindDownloadFile,
} from '../../component/download-file/js/_download-file';
import { noteDeprecated } from '../../core/js/deprecations';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderDownloadFileTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-file-download from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. A press sends the
// cancelable request sf-download-file-download {href, fileName, download}
// (vocabulary 1.1.5 §5.1) on the host; the old sf-download-file:click follows
// it as a dated alias (aliases.json), and a refused request stops the download.
const DownloadFileElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const STATES = ['ready', 'preparing', 'error'];

class SfDownloadFile extends DownloadFileElement {
  constructor() {
    super();
    this._boundRoot = null;
    // A press the host answered by preparing the file: when the file is ready
    // (state back to ready with an href) it is fetched once, as the person
    // asked (decision C25). A file prepared before anyone pressed is not.
    this._awaiting = false;
    this._refocus = false;
    this._onAlertAction = (event) => this.onAlertAction(event);
  }

  get shownState() {
    const value = this.getAttribute('state');
    return STATES.includes(value) ? value : 'ready';
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

  templateContext() {
    const props = this.getPropsContext();
    const href = this.getAttribute('href') || '';
    const opensTab = Boolean(href) && this.getAttribute('target') === '_blank';

    return this.createTemplateContext({
      ...props,
      size: this.size,
      state: this.shownState,
      // No invented file: an absent name is the link's last part, else «Файл».
      fileName: this.fileName,
      fileType: this.getAttribute('file-type') || '',
      icon: this.signIcon,
      opensTab,
      // A file link downloads where the person is (decision C25): the
      // download semantics are the default, a tab opened to view has none.
      download: this.download,
      errorText: this.getAttribute('error-text') || '',
      words: {
        preparing: this.sfWord('preparing-text'),
        errorHeading: this.sfWord('error-heading'),
        retry: this.sfWord('retry-text'),
        newTab: this.sfWord('new-tab-text'),
      },
      ariaLabel: this.getAttribute('aria-label') || '',
      component: this,
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name !== 'state' || oldValue === newValue) return;
    const next = STATES.includes(newValue) ? newValue : 'ready';
    if (next === 'error') return;
    if (next === 'ready' && this._awaiting && oldValue === 'preparing') {
      this._awaiting = false;
      const href = this.getAttribute('href');
      if (href && !this.hasAttribute('disabled')) {
        buildAnchorDownload(href, this.getAttribute('file-name') || nameFromHref(href));
      }
    }
  }

  template() {
    return renderDownloadFileTemplate(this.templateContext());
  }

  // The class binder's activation, as the element's request: false when a
  // listener refused it. A refused request is the host taking the download
  // over -- preparing the file, perhaps -- so the press is remembered.
  requestDownload = (detail) => {
    const delivered = this.sfEmit('download', detail, { cancelable: true });
    this._awaiting = !delivered;
    return delivered;
  };

  // «Повторить» under a file that could not be prepared: the host is asked to
  // make it again (vocabulary §5 retry); the press counts as the person's.
  onAlertAction(event) {
    if (event.detail?.action !== 'retry' || !event.target?.closest?.('.sf-download-file__error')) return;
    event.stopPropagation();
    this._awaiting = true;
    // The notice and its button go away when the host starts preparing the
    // file again; focus would fall to the page's body (docs acceptance
    // 2026-11-10, L1). It is kept on the file the person asked for.
    this._refocus = true;
    this.sfEmit('retry', { href: this.getAttribute('href') || '', fileName: this.getAttribute('file-name') || '' });
  }

  onConnected() {
    super.onConnected?.();
    this.addEventListener('sf-alert-action', this._onAlertAction);
  }

  afterRender() {
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-download-file');
    if (this._boundRoot) {
      // The class script binds every .sf-download-file it finds on the page; a
      // root it reached first is bound again with the element's request.
      unbindDownloadFile(this._boundRoot);
      bindDownloadFile(this._boundRoot, { onActivate: this.requestDownload });
    }

    // After «Повторить»: once the notice is gone, the file takes the focus the
    // button held -- only if the focus was lost with it, never taken from
    // where the person has moved since.
    if (this._refocus && !this.querySelector('.sf-download-file__error')) {
      this._refocus = false;
      const active = document.activeElement;
      if (this._boundRoot && (!active || active === document.body)) {
        this._boundRoot.focus({ preventScroll: true });
      }
    }
  }

  onDisconnected() {
    this.removeEventListener('sf-alert-action', this._onAlertAction);
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfDownloadFile.define('sf-file-download');
