import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import {renderFilePreviewTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-file-preview from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8; vocabulary 1.1.5 §5 download and detach): its settings
// are attributes and properties made by core/js/element-manifest.js, its words
// are lang/<locale>.json (a product adds a language through
// SF.language.register("sf-file-preview", code, words)), and the old names --
// name, size, type, sf-file-preview:download, sf-file-preview:remove, open,
// setOpen(), toggleOpen() -- are dated rows of aliases.json.
const FilePreviewElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

// What retires without a new name (aliases.json rows with `to: null`): kept
// until the date, and each call is noted with it.
function noteRetired(from) {
  noteDeprecated({ component: 'sf-file-preview', tag: 'sf-file-preview', kind: 'action', from, to: null,
    since: aliases.since, remove_after: aliases.remove_after });
}

class SfFilePreview extends FilePreviewElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'auto', values: ['auto', 'icon', 'image'], aliases: ['type'], valueAliases: {auto: ['default']}},
    };
  }

  get componentName() {
    return 'file-preview';
  }

  shouldClearLightDomBeforeFirstRender() {
    return super.shouldClearLightDomBeforeFirstRender()
      || !!this.querySelector(':scope > .sf-file-preview[data-render-managed="1"]');
  }

  get kind() {
    return this.getProp('kind');
  }

  set kind(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('kind');
    else this.setAttribute('kind', String(value));
  }

  // The group's name (§3.1, §4.8): the host's aria-label, else the file name.
  get accessibleName() {
    return this.getAttribute('aria-label') || this.fileName || this.sfWord('aria-label');
  }

  get extension() {
    const match = /\.([a-z0-9]{1,5})$/iu.exec(String(this.fileName || '').trim());
    return match ? match[1].toUpperCase() : '';
  }

  get isImage() {
    if (this.kind === 'image') return true;
    if (this.kind === 'icon') return false;
    return this.mimeType.toLowerCase().startsWith('image/')
      || IMAGE_EXTENSION.test(this.imageUrl || this.href || this.fileName);
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      fileName: this.fileName,
      fileSize: this.fileSize,
      icon: this.icon,
      href: this.href,
      type: this.kind,
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
      ariaLabel: this.accessibleName,
      downloadLabel: this.downloadLabel,
      removeLabel: this.removeLabel,
      onDownload: (event) => this.handleDownload(event),
      onRemove: (event) => this.handleRemove(event),
    });
  }

  template() {
    return renderFilePreviewTemplate(this.templateContext());
  }

  // The file as data (§8): what download and detach carry in `value`.
  get data() {
    return this.getValue();
  }

  getValue() {
    return {
      fileName: this.fileName,
      fileSize: this.fileSize,
      icon: this.icon,
      href: this.href,
      type: this.kind,
      mimeType: this.mimeType,
      imageUrl: this.imageUrl,
      target: this.target,
    };
  }

  // The file's id in a detail (vocabulary §5 {id}): the host's id, else its
  // address, else its name.
  get fileId() {
    return this.id || this.href || this.fileName;
  }

  // §4.4 and compatibility.deprecations: open did nothing since 1.0.0.
  setOpen(value) {
    noteRetired('setOpen');
    this.toggleAttribute('open', Boolean(value));
    return this;
  }

  toggleOpen() {
    noteRetired('toggleOpen');
    this.toggleAttribute('open', !this.hasAttribute('open'));
    return this;
  }

  onDownload(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-preview-download', handler, options);
    }
    return this;
  }

  onRemove(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-preview-detach', handler, options);
    }
    return this;
  }

  // download {id}: a request a page may refuse; unrefused, the browser opens
  // or downloads the file.
  handleDownload(event) {
    event?.preventDefault?.();
    if (this.disabled || !this.request('download', 'download') || !this.href) return;
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

  // detach {id}: the host removes the file; the preview only asks.
  handleRemove(event) {
    event?.preventDefault?.();
    if (!this.disabled) this.request('detach', 'remove');
  }

  // The detail is data only (§8): the id, and for the old names' listeners
  // the action and the file (detail-adds rows of aliases.json).
  request(verb, action) {
    return this.sfEmit(verb, {id: String(this.fileId ?? ''), action, value: this.getValue()}, {cancelable: true});
  }
}

SfFilePreview.define('sf-file-preview');
