import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import {renderFilePreviewTemplate} from './js/templates/default';
import {fileType} from '../../core/js/file-types/index.js';
import {fileIcon, formatFileSize} from '../../core/js/composition/file-size.mjs';
import {formatLocale, intlFormatter} from '../../core/js/format-intl.js';
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
const STATES = ['ready', 'uploading', 'error'];

// The media type a name's extension says, for the formats the core's file
// icons tell apart (core/js/composition/file-size.mjs FILE_ICONS, the icons
// sf-file-upload's rows draw): PDF, a sheet and slides each get their own
// glyph (C81: «значок с типом у остальных»). Other names take the kind of the
// file-type map (core/js/file-types, C102): code, data, image, video, audio.
const EXTENSION_MEDIA = Object.freeze({
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
});
const SIZE_STEPS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];

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

  // The glyph of the file's type (C81, C51): the host's icon when it names one,
  // else the media type's, else the name's extension's, else the default.
  get typeIcon() {
    if (this.hasAttribute('icon') && this.icon) return this.icon;
    const byMedia = fileIcon(String(this.mimeType || '').toLowerCase());
    if (byMedia !== 'download') return byMedia;
    const byExtension = fileIcon(EXTENSION_MEDIA[this.extension.toLowerCase()] || '');
    if (byExtension !== 'download') return byExtension;
    const {kind, icon} = fileType({name: this.fileName});
    return kind !== 'file' && icon ? icon : this.icon;
  }

  // The state of the file (C81, the upload core's rows): ready, uploading or
  // error; anything else reads as ready.
  get shownState() {
    const state = String(this.getAttribute('state') || '').trim().toLowerCase();
    return STATES.includes(state) ? state : 'ready';
  }

  // The upload's share, per cent (0 to 100), or null: not known yet.
  get shownProgress() {
    const raw = this.getAttribute('value');
    if (raw === null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
  }

  // A size in bytes («2457600») is drawn in the page's units («2,3 МБ», C25,
  // core formatFileSize); a size the host wrote as text stays as written.
  get bytes() {
    const raw = this.fileSize;
    if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
    return /^\s*\d+\s*$/u.test(String(raw ?? '')) ? Number(raw) : null;
  }

  get shownSize() {
    const bytes = this.bytes;
    return bytes === null ? String(this.fileSize ?? '').trim() : formatFileSize(bytes, {node: this});
  }

  // The size as it is said (C51: the unit as a word): «2,3 мегабайта».
  get spokenSize() {
    const bytes = this.bytes;
    if (bytes === null) return this.shownSize;
    let amount = bytes;
    let index = 0;
    while (amount >= 1024 && index < SIZE_STEPS.length - 1) {
      amount /= 1024;
      index += 1;
    }
    const digits = index === 0 || amount >= 10 ? 0 : 1;
    try {
      return intlFormatter('NumberFormat', formatLocale({node: this}), {
        style: 'unit', unit: SIZE_STEPS[index], unitDisplay: 'long', maximumFractionDigits: digits,
      }).format(amount);
    } catch {
      return this.shownSize;
    }
  }

  // What a screen reader hears after the name (C51): «, PDF, 2,3 мегабайта».
  get said() {
    const parts = [this.extension, this.shownState === 'ready' ? this.spokenSize : ''].filter(Boolean);
    return parts.length ? `, ${parts.join(', ')}` : '';
  }

  get isImage() {
    if (this.kind === 'image') return true;
    if (this.kind === 'icon') return false;
    return this.mimeType.toLowerCase().startsWith('image/')
      || IMAGE_EXTENSION.test(this.imageUrl || this.href || this.fileName);
  }

  templateContext() {
    const props = this.getPropsContext();
    const name = this.fileName;
    const state = this.shownState;
    const errorText = String(this.getAttribute('error-text') || '').trim();

    return this.createTemplateContext({
      ...props,
      component: this,
      fileName: name,
      fileSize: this.shownSize,
      said: this.said,
      state,
      progress: this.shownProgress,
      // The name is a link to the file while the file is there (C51).
      linked: Boolean(this.href) && state === 'ready' && !this.disabled,
      icon: this.typeIcon,
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
      // «Скачать <имя>», «Удалить <имя>» (C51): a page's own label is kept.
      downloadLabel: this.getAttribute('download-label') || this.sfWord('download-label', {vars: {name}}),
      removeLabel: this.getAttribute('remove-label') || this.sfWord('remove-label', {vars: {name}}),
      words: {
        uploading: this.sfWord('uploading-label', {vars: {name}}),
        failed: errorText ? this.sfWord('error-line', {vars: {message: errorText}}) : this.sfWord('error-text'),
        retry: this.sfWord('retry-text'),
        retryLabel: this.sfWord('retry-label', {vars: {name}}),
      },
      onOpen: (event) => this.handleOpen(event),
      onDownload: (event) => this.handleDownload(event),
      onRemove: (event) => this.handleRemove(event),
      onRetry: (event) => this.handleRetry(event),
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
      kind: this.kind,
      // The field's former name, until 2027-01-01 (docs precheck smart content
      // FP-05; journal event-file-preview-value-type-to-kind): the same value.
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

  // The name is the file's link (C51): the browser follows it as any link
  // (a middle click, «copy address» work); the same cancelable download
  // request goes first, and a page that refuses it keeps the press.
  handleOpen(event) {
    if (this.disabled || !this.request('download', 'download')) event?.preventDefault?.();
  }

  // retry {id}: the host sends the file again and sets the state.
  handleRetry(event) {
    event?.preventDefault?.();
    if (!this.disabled) this.request('retry', 'retry');
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
