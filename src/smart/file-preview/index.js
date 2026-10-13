import SfBaseElement from '../../core/js/smart-base';
import {renderFilePreviewTemplate} from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-file-preview", code, words).
const FILE_PREVIEW_TEXT = {
  en: {
    ariaLabel: 'File',
    downloadLabel: 'Download file',
    removeLabel: 'Remove file',
  },
  ru: {
    ariaLabel: 'Файл',
    downloadLabel: 'Скачать файл',
    removeLabel: 'Удалить файл',
  },
};


const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

class SfFilePreview extends SfBaseElement {
  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      name: {default: 'File'},
      fileName: {attribute: 'file-name', default: 'File'},
      size: {default: ''},
      fileSize: {attribute: 'file-size', default: ''},
      icon: {default: 'description'},
      href: {default: ''},
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'auto', values: ['auto', 'icon', 'image'], aliases: ['type'], valueAliases: {auto: ['default']}},
      mimeType: {attribute: 'mime-type', default: ''},
      imageUrl: {attribute: 'image-url', default: ''},
      avatarSize: {attribute: 'avatar-size', default: ''},
      open: {type: Boolean, default: false},
      surface: {type: Boolean, default: false},
      download: {type: Boolean, default: true},
      target: {default: '_blank'},
      actions: {type: Boolean, default: true},
      downloadAction: {attribute: 'download-action', type: Boolean, default: true},
      removeAction: {attribute: 'remove-action', type: Boolean, default: true},
      disabled: {type: Boolean, default: false},
      compact: {type: Boolean, default: false},
      ariaLabel: {attribute: 'aria-label', default: ''},
      downloadLabel: {attribute: 'download-label', default: ''},
      removeLabel: {attribute: 'remove-label', default: ''},
    };
  }

  get componentName() {
    return 'file-preview';
  }

  shouldClearLightDomBeforeFirstRender() {
    return super.shouldClearLightDomBeforeFirstRender()
      || !!this.querySelector(':scope > .sf-file-preview[data-render-managed="1"]');
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get name() {
    return this.getAttribute('name') || this.getAttribute('file-name') || 'File';
  }

  get fileName() {
    return this.getAttribute('file-name') || this.getAttribute('name') || 'File';
  }

  get size() {
    return this.getAttribute('size') || this.fileSize;
  }

  get fileSize() {
    return this.getAttribute('file-size') || this.getAttribute('size') || '';
  }

  get icon() {
    return this.getAttribute('icon') || 'description';
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get mimeType() {
    return this.getAttribute('mime-type') || '';
  }

  get imageUrl() {
    return this.getAttribute('image-url') || '';
  }

  get avatarSize() {
    return this.getAttribute('avatar-size') || '';
  }

  get open() {
    return this.getBooleanAttr('open', false);
  }

  get surface() {
    return this.getBooleanAttr('surface', false);
  }

  get download() {
    return this.getBooleanAttr('download', true);
  }

  get target() {
    return this.getAttribute('target') || '_blank';
  }

  get actions() {
    return this.getBooleanAttr('actions', true);
  }

  get downloadAction() {
    return this.getBooleanAttr('download-action', true);
  }

  get removeAction() {
    return this.getBooleanAttr('remove-action', true);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || this.fileName;
  }

  get downloadLabel() {
    return this.getAttribute('download-label') || pageText(FILE_PREVIEW_TEXT, "downloadLabel", this);
  }

  get removeLabel() {
    return this.getAttribute('remove-label') || pageText(FILE_PREVIEW_TEXT, "removeLabel", this);
  }

  // Only the leading visual, on a row's line: a list of files shows each as a
  // thumbnail or as its extension, and the record shows the rest.
  get compact() {
    return this.getBooleanAttr('compact', false);
  }

  get extension() {
    const match = /\.([a-z0-9]{1,5})$/iu.exec(String(this.fileName || '').trim());
    return match ? match[1].toUpperCase() : '';
  }

  get isImage() {
    if (this.type === 'image') return true;
    if (this.type === 'icon') return false;

    return this.mimeType.toLowerCase().startsWith('image/')
      || IMAGE_EXTENSION.test(this.imageUrl || this.href || this.fileName);
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.getAttribute("aria-label") || pageText(FILE_PREVIEW_TEXT, "ariaLabel", this),
      downloadLabel: this.getAttribute("download-label") || pageText(FILE_PREVIEW_TEXT, "downloadLabel", this),
      removeLabel: this.getAttribute("remove-label") || pageText(FILE_PREVIEW_TEXT, "removeLabel", this),
      component: this,
      fileName: this.fileName,
      fileSize: this.fileSize,
      icon: this.icon,
      href: this.href,
      type: this.type,
      mimeType: this.mimeType,
      imageUrl: this.imageUrl,
      isImage: this.isImage,
      compact: this.compact,
      extension: this.extension,
      surface: this.surface,
      download: this.download,
      target: this.target,
      actions: this.actions,
      downloadAction: this.downloadAction,
      removeAction: this.removeAction,
      disabled: this.disabled,
      ariaLabel: this.ariaLabel,
      downloadLabel: this.downloadLabel,
      removeLabel: this.removeLabel,
      onDownload: (event) => this.handleDownload(event),
      onRemove: (event) => this.handleRemove(event),
    });
  }

  template() {
    return renderFilePreviewTemplate(this.templateContext());
  }

  get data() {
    return this.getValue();
  }

  getValue() {
    return {
      fileName: this.fileName,
      fileSize: this.fileSize,
      icon: this.icon,
      href: this.href,
      type: this.type,
      mimeType: this.mimeType,
      imageUrl: this.imageUrl,
      target: this.target,
    };
  }

  setOpen(value) {
    this.toggleAttribute('open', Boolean(value));
    return this;
  }

  toggleOpen() {
    return this.setOpen(!this.open);
  }

  onDownload(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-preview:download', handler, options);
    }
    return this;
  }

  onRemove(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-preview:remove', handler, options);
    }
    return this;
  }

  handleDownload(event) {
    event?.preventDefault?.();
    if (this.disabled || !this.dispatchFilePreviewEvent('download') || !this.href) return;

    const anchor = document.createElement('a');
    anchor.href = this.href;
    if (this.download) {
      anchor.download = this.fileName;
    } else {
      anchor.target = this.target;
      anchor.rel = 'noopener noreferrer';
    }
    anchor.click();
  }

  handleRemove(event) {
    event?.preventDefault?.();
    if (!this.disabled) this.dispatchFilePreviewEvent('remove');
  }

  dispatchFilePreviewEvent(action) {
    return this.dispatchEvent(new CustomEvent(`sf-file-preview:${action}`, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: {action, value: this.getValue()},
    }));
  }
}

SfFilePreview.define('sf-file-preview');
