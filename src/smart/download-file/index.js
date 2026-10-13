import {
  bindDownloadFile,
  unbindDownloadFile,
} from '../../component/download-file/js/_download-file';
import SfBaseElement from '../../core/js/smart-base';
import { renderDownloadFileTemplate } from './js/templates/default';


class SfDownloadFile extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1' },
      fileName: { default: 'File.pdf' },
      fileSize: { default: '' },
      icon: { default: 'download' },
      href: { default: '' },
      download: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      target: { default: '_blank' },
      ariaLabel: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get fileName() {
    return this.getAttribute('file-name') || 'File.pdf';
  }

  get fileSize() {
    return this.getAttribute('file-size') || '';
  }

  get icon() {
    return this.getAttribute('icon') || 'download';
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  get download() {
    return this.getBooleanAttr('download', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get target() {
    return this.getAttribute('target') || '_blank';
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
    });
  }

  template() {
    return renderDownloadFileTemplate(this.templateContext());
  }

  afterRender() {
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-download-file');
    if (this._boundRoot) {
      bindDownloadFile(this._boundRoot);
    }
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfDownloadFile.define('sf-download-file');
