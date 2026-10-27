import {
  bindDownloadFile,
  unbindDownloadFile,
} from '../../component/download-file/js/_download-file';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderDownloadFileTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-download-file from its component.json (standard simai.smart-component
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

class SfDownloadFile extends DownloadFileElement {
  constructor() {
    super();
    this._boundRoot = null;
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      size: this.size,
      ariaLabel: this.getAttribute('aria-label') || '',
      component: this,
    });
  }

  template() {
    return renderDownloadFileTemplate(this.templateContext());
  }

  // The class binder's activation, as the element's request: false when a
  // listener refused it.
  requestDownload = (detail) => this.sfEmit('download', detail, { cancelable: true });

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
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindDownloadFile(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfDownloadFile.define('sf-download-file');
