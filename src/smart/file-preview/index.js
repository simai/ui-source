import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import {renderFilePreviewTemplate} from './js/templates/default';
import {fileType} from '../../core/js/file-types/index.js';
import {fileIcon, formatFileSize} from '../../core/js/composition/file-size.mjs';
import {formatLocale, intlFormatter, toDate} from '../../core/js/format-intl.js';
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
const VIDEO_EXTENSION = /\.(?:mp4|m4v|webm|ogv|mov)(?:[?#].*)?$/i;
const PDF_EXTENSION = /\.pdf(?:[?#].*)?$/i;
const STATES = ['ready', 'uploading', 'error'];
const VIEWS = ['row', 'chip', 'tile'];
// The kinds the page's viewer shows in place (C149 (5), (6)): the rest download.
const VIEWABLE = new Set(['image', 'video', 'pdf']);
// The tail a cut name always keeps (C149 (2)): the extension and the end of
// the name before it.
const KEPT_TAIL = 10;
// The joints a name breaks after (C34), as nameParts in the template.
const JOINT = /(?<=[_\-–—/+])/u;

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

  // What a screen reader hears after the name (C51, C149 (7)): «, PDF,
  // 2,3 мегабайта, 12 ноября».
  get said() {
    const ready = this.shownState === 'ready';
    const parts = [this.extension, ready ? this.spokenSize : '', ready ? this.dateText('long') : ''].filter(Boolean);
    return parts.length ? `, ${parts.join(', ')}` : '';
  }

  get isImage() {
    return this.fileKind === 'image';
  }

  // The file's kind for the viewer and the picture (C149 (4), (5)): image,
  // video, pdf or file, from kind, the media type, then the name's or the
  // address's extension. A picture the host gave (image-url) does not make a
  // PDF an image: it is the PDF's first page.
  get fileKind() {
    if (this.kind === 'image') return 'image';
    const mime = String(this.mimeType || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    if (mime) return 'file';
    const named = String(this.fileName || '');
    const address = String(this.href || '').split(/[?#]/u)[0];
    for (const text of [named, address]) {
      if (IMAGE_EXTENSION.test(text)) return 'image';
      if (VIDEO_EXTENSION.test(text)) return 'video';
      if (PDF_EXTENSION.test(text)) return 'pdf';
    }
    return 'file';
  }

  // The picture in the holder (C149 (4)): the one the host gave, for any file;
  // an image's own address when it gave none. kind="icon" draws the glyph.
  get picture() {
    if (this.kind === 'icon') return '';
    if (this.imageUrl) return this.imageUrl;
    return this.fileKind === 'image' ? (this.href || '') : '';
  }

  // Opens in the page's viewer (C149 (5)): a picture, a PDF or a video that
  // is there.
  get viewable() {
    return VIEWABLE.has(this.fileKind) && Boolean(this.viewSource) && this.shownState === 'ready' && !this.disabled;
  }

  get viewSource() {
    return this.href || (this.fileKind === 'image' ? this.imageUrl : '') || '';
  }

  get shownView() {
    const view = String(this.getAttribute('appearance') || '').trim().toLowerCase();
    return VIEWS.includes(view) ? view : 'row';
  }

  // The date under the name (C149 (7)): «12 нояб.», with the year when it is
  // not this year; nothing when the page gives none or it is not a date.
  get fileMoment() {
    const raw = this.fileDate;
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    return toDate(raw);
  }

  dateText(month) {
    const moment = this.fileMoment;
    if (!moment) return '';
    const options = {day: 'numeric', month};
    if (moment.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    try {
      return intlFormatter('DateTimeFormat', formatLocale({node: this}), options).format(moment);
    } catch {
      return '';
    }
  }

  get shownDate() {
    return this.dateText('short');
  }

  // A video's length (C149 (4)): seconds (84) drawn as 1:24, text as written.
  get shownDuration() {
    const raw = String(this.duration ?? '').trim();
    if (!raw) return '';
    if (!/^\d+(?:\.\d+)?$/u.test(raw)) return raw;
    const total = Math.round(Number(raw));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  }

  // Under the name (C149 (7)): the type, the size and the date when the page
  // gives it, «PDF · 2,4 МБ · 12 нояб.»; a chip keeps type and size.
  get meta() {
    const parts = [this.extension, this.shownSize];
    if (this.shownView !== 'chip') parts.push(this.shownDate);
    return parts.filter(Boolean).join(' · ');
  }

  templateContext() {
    const props = this.getPropsContext();
    const name = this.fileName;
    const state = this.shownState;
    const errorText = String(this.getAttribute('error-text') || '').trim();
    const view = this.shownView;
    const stored = Boolean(this.stored);

    return this.createTemplateContext({
      ...props,
      component: this,
      fileName: name,
      fileId: String(this.fileId ?? ''),
      fileSize: this.shownSize,
      fileKind: this.fileKind,
      view,
      lines: view === 'row' ? 2 : 1,
      meta: this.meta,
      duration: this.shownDuration,
      picture: this.picture,
      viewable: this.viewable,
      stored,
      asking: Boolean(this._asking) && stored,
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
      // «Скачать <имя>», «Убрать <имя>» or, for a stored file, «Удалить <имя>»
      // (C51, C149 (8)): a page's own label is kept.
      downloadLabel: this.getAttribute('download-label') || this.sfWord('download-label', {vars: {name}}),
      removeLabel: this.getAttribute('remove-label') || this.sfWord(stored ? 'delete-label' : 'remove-label', {vars: {name}}),
      words: {
        uploading: this.sfWord('uploading-label', {vars: {name}}),
        failed: errorText ? this.sfWord('error-line', {vars: {message: errorText}}) : this.sfWord('error-text'),
        retry: this.sfWord('retry-text'),
        retryLabel: this.sfWord('retry-label', {vars: {name}}),
        deleteQuestion: this.sfWord('delete-question', {vars: {name}}),
        deleteText: this.sfWord('delete-text'),
      },
      onOpen: (event) => this.handleOpen(event),
      onDownload: (event) => this.handleDownload(event),
      onRemove: (event) => this.handleRemove(event),
      onRetry: (event) => this.handleRetry(event),
      onAnswer: (event) => this.handleAnswer(event),
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
  // (a middle click, «copy address» work). A picture, a PDF or a video opens
  // in the page's viewer (C149 (5)); any other file downloads, after the same
  // cancelable download request, and a page that refuses it keeps the press.
  handleOpen(event) {
    if (this.disabled) {
      event?.preventDefault?.();
      return;
    }
    const plain = event && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
    if (this.viewable && (plain || !event)) {
      event?.preventDefault?.();
      this.openViewer();
      return;
    }
    if (!this.request('download', 'download')) event?.preventDefault?.();
  }

  // The files a viewer pages through (C149 (6)): the viewable files of this
  // one's list -- the nearest parent holding more than one sf-file-preview,
  // three levels up at most -- in their order; else this file alone.
  viewerFiles() {
    let scope = this.parentElement;
    for (let level = 0; scope && level < 3; level += 1, scope = scope.parentElement) {
      const files = [...scope.querySelectorAll('sf-file-preview')];
      if (files.length > 1) {
        const shown = files.filter((file) => file.viewable && !file.hidden && !file.compact);
        if (shown.includes(this)) return shown;
        break;
      }
    }
    return [this];
  }

  viewerItem() {
    return {
      src: this.viewSource,
      type: this.fileKind,
      mime: this.mimeType || undefined,
      name: this.fileName,
      alt: this.fileKind === 'image' ? this.fileName : '',
      meta: [this.extension, this.shownSize].filter(Boolean).join(' · '),
      download: this.download ? this.fileName : false,
      open: true,
    };
  }

  // Opens this file in the page's full-screen viewer, sf-gallery's
  // SF.Gallery.view (C149 (6), C150 (7)): name, «N из M», download, open in a
  // tab, close, arrows, keys and a swipe; Escape gives the focus back to the
  // name of the file now shown. Answers false when the file cannot be viewed.
  async openViewer() {
    if (!this.viewable) return false;
    const files = this.viewerFiles();
    const start = files.indexOf(this) + 1;
    const nameOf = (file) => file?.querySelector?.('.sf-file-preview-name') || file;
    try {
      if (!globalThis.SF?.Gallery?.view) await globalThis.SF?.Loader?.ensure?.(['sf-gallery']);
    } catch {
      // Without the viewer the browser opens the file.
    }
    const gallery = globalThis.SF?.Gallery;
    if (!gallery?.view || !this.isConnected) {
      globalThis.location?.assign?.(this.viewSource);
      return false;
    }
    gallery.view(files.map((file) => file.viewerItem()), {
      start,
      counter: 'words',
      opener: (current) => nameOf(files[current - 1] || this),
      labels: {previous: this.sfWord('viewer-previous'), next: this.sfWord('viewer-next')},
    });
    return true;
  }

  // retry {id}: the host sends the file again and sets the state.
  handleRetry(event) {
    event?.preventDefault?.();
    if (!this.disabled) this.request('retry', 'retry');
  }

  // detach {id}: the host removes the file; the preview only asks. «×» takes
  // a file out of a draft or a field at once -- the page offers «Вернуть» in
  // its notice (C25); the trash of a stored file asks first (C149 (8)).
  handleRemove(event) {
    event?.preventDefault?.();
    if (this.disabled) return;
    if (!this.stored) {
      this.request('detach', 'remove');
      return;
    }
    this._asking = true;
    this.requestComponentUpdate('ask');
    this.whenRendered?.(() => {
      const answer = this.querySelector('.sf-file-preview-question');
      customElements.whenDefined('sf-confirm').then(() => requestAnimationFrame(() => {
        (answer?.querySelector('button') || answer)?.focus?.({preventScroll: true});
      }));
    }, {next: true});
  }

  // The answer to «Удалить «<имя>»?»: yes asks the page to erase the file
  // (detach with action delete); either way the question goes and the focus
  // comes back to the trash button.
  handleAnswer(event) {
    event?.stopPropagation?.();
    const accepted = Boolean(event?.detail?.accepted);
    event?.preventDefault?.();
    this._asking = false;
    if (accepted) this.request('detach', 'delete');
    this.requestComponentUpdate('answer');
    this.whenRendered?.(() => {
      this.querySelector('[data-action="delete"]')?.focus?.({preventScroll: true});
    }, {next: true});
  }

  // ── the name cut in the middle (C149 (2)) ──
  afterRender() {
    this.fitName();
    if (typeof ResizeObserver === 'function' && !this._fitObserver) {
      this._fitObserver = new ResizeObserver(() => this.fitName());
      // A face that arrives later changes the name's width, not its box.
      globalThis.document?.fonts?.ready?.then?.(() => this.fitName(true));
    }
    const name = this.querySelector('.sf-file-preview-name');
    if (this._fitObserver && name !== this._fitObserved) {
      if (this._fitObserved) this._fitObserver.unobserve(this._fitObserved);
      if (name) this._fitObserver.observe(name);
      this._fitObserved = name;
    }
  }

  onDisconnected() {
    super.onDisconnected?.();
    this._fitObserver?.disconnect();
    this._fitObserver = null;
    this._fitObserved = null;
  }

  // Draws the whole name; when it needs more lines than its view gives (two in
  // a row, one in a chip or a tile), draws the longest head that fits, an
  // ellipsis and the tail with the extension, broken by words as the whole.
  fitName(force = false) {
    const name = this.querySelector('.sf-file-preview-name');
    const fit = name?.querySelector('.sf-file-preview-fit');
    if (!name || !fit || !name.isConnected) return;
    const full = String(this.fileName ?? '');
    const width = name.clientWidth;
    if (!force && this._fitKey === `${full}|${width}` && name.hasAttribute('data-fitted') === Boolean(this._fitCut)) return;
    name.removeAttribute('data-fitted');
    fit.replaceChildren();
    this._fitKey = `${full}|${width}`;
    this._fitCut = false;
    if (!width || this.overflows(name) === false) return;
    const tail = full.slice(-KEPT_TAIL);
    const head = full.slice(0, -KEPT_TAIL);
    if (!head) return;
    name.setAttribute('data-fitted', '');
    const draw = (length) => {
      const shown = `${head.slice(0, length).replace(/[\s_.\-–—/+]+$/u, '')}…${tail}`;
      fit.replaceChildren(...shown.split(JOINT).flatMap((part, index) => (
        index ? [document.createElement('wbr'), document.createTextNode(part)] : [document.createTextNode(part)])));
    };
    let low = 0;
    let high = head.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      draw(middle);
      if (this.overflows(name)) high = middle - 1;
      else low = middle;
    }
    draw(low);
    this._fitCut = true;
  }

  // The name takes more room than its lines (the clamp hides the rest).
  overflows(name) {
    return name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1;
  }

  // The detail is data only (§8): the id, and for the old names' listeners
  // the action and the file (detail-adds rows of aliases.json).
  request(verb, action) {
    return this.sfEmit(verb, {id: String(this.fileId ?? ''), action, value: this.getValue()}, {cancelable: true});
  }
}

SfFilePreview.define('sf-file-preview');
