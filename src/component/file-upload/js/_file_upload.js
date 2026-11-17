import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { ladderSize } from '../../field-size';
import { pageText, pageWord } from '../../../core/js/page-language';
import { formatFileSize } from '../../../core/js/format-file-size.js';
import { fileIcon } from '../../../core/js/composition/file-size.mjs';
import { acceptFormats, fileRejection, positiveLimit } from './intake.mjs';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';
// Every word this part says. A product adds a language with
// SF.language.register('sf-file-upload', code, words); a ternary on «ru» allowed two
// and no more.
const FILE_UPLOAD_ITEM_TEXT = LANG_WORDS;


const FILE_UPLOAD_SELECTOR = '.sf-file-upload';
const FILE_UPLOAD_BOUND_FLAG = 'sfFileUploadBound';

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'disabled', 'multiple'].includes(
    String(value).toLowerCase(),
  );
}

// The area stands on the field ladder's five steps (field-size.js
// FIELD_LADDER; queue #70). A file's row is the file family's row
// (sf-file-preview's markup, C81, C260): one height at every size of the
// area.
function normalizeSize(value) {
  return ladderSize(value);
}


// An entry's state: ready (chosen, not sent), process (being sent), done,
// error. A chosen file was process at 0 % at once and looked like an upload
// that had stuck (FU-3); it is ready until the host or the uploader sends it.
const ITEM_STATES = Object.freeze(['ready', 'process', 'done', 'error']);

function normalizeItemState(item, fallback = 'process') {
  const state = String(item?.state || item?.status || fallback).toLowerCase();
  return ITEM_STATES.includes(state) ? state : 'process';
}

function getItemEventKey(item, index) {
  if (item?.id) return String(item.id);
  if (item?.file && item.file.name) {
    return `${item.file.name}-${item.file.size}-${item.file.lastModified}`;
  }
  if (item?.name || item?.fileName) {
    return `${item.name || item.fileName}-${index}`;
  }
  return `item-${index}`;
}

function isDisabledRoot(root) {
  if (!root) return false;
  return root.classList.contains('disabled') || root.hasAttribute('disabled');
}

function getInput(root) {
  return root?.querySelector?.('input[type="file"].sf-file-upload-input') || null;
}

function getFilesContainer(root) {
  if (!root) return null;

  const targetSelector = root.dataset.target || root.getAttribute('data-target') || '';
  if (targetSelector) {
    try {
      const external = document.querySelector(targetSelector);
      if (external) return external;
    } catch {
      // Ignore invalid selectors and fallback to structural lookup.
    }
  }

  let next = root.nextElementSibling;
  while (next?.classList?.contains('sf-file-upload-message') || next?.classList?.contains('sf-file-upload-status')) next = next.nextElementSibling;
  if (next?.classList?.contains('sf-file-upload-files')) {
    return next;
  }

  return root.querySelector('.sf-file-upload-files') || null;
}

function isManagedRenderRoot(root) {
  if (!root) return false;
  return (
    root.dataset.renderManaged === '1' ||
    root.hasAttribute('data-render-managed')
  );
}

function getMultiple(root) {
  return (
    root.hasAttribute('multiple') ||
    toBoolean(root.dataset.multiple ?? root.getAttribute('multiple'), false)
  );
}

function getAccept(root) {
  return root.dataset.accept || root.getAttribute('accept') || '';
}

// A limit in bytes or files, from data-<name> or <name>: a positive number, or
// none (FU-8). Each page wrote its own check (sf-chat-composer in ui-pro too).
function getLimit(root, name) {
  const key = name.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
  return positiveLimit(root.dataset[key] ?? root.getAttribute(name));
}

function itemBytes(item) {
  const bytes = Number(item?.file?.size ?? item?.size);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

// function getTriggerLink(root) {
//   return root?.querySelector?.('.sf-file-upload-link') || null;
// }

function ensureInput(root) {
  let input = getInput(root);
  if (input) return input;

  input = document.createElement('input');
  input.type = 'file';
  input.classList.add('sf-file-upload-input');
  input.hidden = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  root.append(input);
  return input;
}

function syncInputConfig(root, input) {
  if (!root || !input) return;

  input.multiple = getMultiple(root);

  const accept = getAccept(root);
  if (accept) input.setAttribute('accept', accept);
  else input.removeAttribute('accept');

  input.disabled = isDisabledRoot(root);
}

// The rows this part names and switches off: its own (the family row's class
// markup) and hand-written .sf-upload-progress rows.
const CLASS_ROW = '.sf-upload-progress, .sf-file-upload-item > .sf-file-preview';
const CLASS_ROWS = ':is(.sf-upload-progress, .sf-file-upload-item > .sf-file-preview)';
const CLASS_ROW_NAME = '.sf-upload-progress-name, .sf-file-preview-name';

function syncFileUploadInteraction(root) {
  const state = root.__sfFileUploadInteractionState ||= {
    tabIndex: root.getAttribute('tabindex') ?? '0',
    disabled: false,
    buttons: new WeakMap(),
  };
  const disabled = isDisabledRoot(root);
  if (!state.disabled) state.tabIndex = root.getAttribute('tabindex') ?? '0';
  const tabIndex = disabled ? '-1' : state.tabIndex;
  if (root.getAttribute('tabindex') !== tabIndex) root.setAttribute('tabindex', tabIndex);
  if (root.getAttribute('aria-disabled') !== String(disabled)) root.setAttribute('aria-disabled', String(disabled));
  state.disabled = disabled;
  syncInputConfig(root, getInput(root));
  if (disabled && root.classList.contains('dragover')) root.classList.remove('dragover');

  const files = getFilesContainer(root);
  // The class rows only: the ones this part draws (the family row's class
  // markup, .sf-file-upload-item > .sf-file-preview) and hand-written
  // .sf-upload-progress rows. A Smart area's rows are sf-file-preview
  // elements, which name their own buttons («Убрать <имя>», «Повторить <имя>»).
  files?.querySelectorAll(':scope > .sf-file-upload-item > .sf-file-preview').forEach((row) => {
    row.classList.toggle('disabled', disabled);
    if (disabled) row.setAttribute('aria-disabled', 'true');
    else row.removeAttribute('aria-disabled');
  });
  files?.querySelectorAll(`${CLASS_ROWS} button[data-action="remove"], ${CLASS_ROWS} button[data-action="retry"]`).forEach(button => {
    let previous = state.buttons.get(button);
    if (!previous) {
      previous = {disabled: button.disabled, managedDisabled: false, label: null};
      state.buttons.set(button, previous);
    }
    if (!previous.managedDisabled) previous.disabled = button.disabled;
    const nextDisabled = disabled || previous.disabled;
    if (button.disabled !== nextDisabled) button.disabled = nextDisabled;
    previous.managedDisabled = disabled;
    // Remove and Retry are named with their file: three rows said «Удалить»
    // three times, and the retry button said only its word (FU-10).
    const currentLabel = button.getAttribute('aria-label');
    if (!button.hasAttribute('aria-labelledby') && (!currentLabel || currentLabel === previous.label)) {
      const name = button.closest(CLASS_ROW)?.querySelector(CLASS_ROW_NAME)?.textContent?.trim() || '';
      // The name has its place in the word ({name}, remove-name / retry-name),
      // so a language that puts it first can (C177 follow-up). A retry button
      // the author wrote another word on keeps that word before the name; the
      // icon-only retry (C260) carries its word in data-word.
      const retry = button.dataset.action === 'retry';
      const word = retry
        ? pageText(FILE_UPLOAD_ITEM_TEXT, 'retry', root, 'sf-file-upload')
        : pageText(FILE_UPLOAD_ITEM_TEXT, 'remove', root, 'sf-file-upload');
      const named = retry
        ? pageText(FILE_UPLOAD_ITEM_TEXT, 'retry-name', root, 'sf-file-upload')
        : pageText(FILE_UPLOAD_ITEM_TEXT, 'remove-name', root, 'sf-file-upload');
      const text = retry ? (button.dataset.word || (button.querySelector?.('.sf-button-text-container') || button).textContent).trim() : '';
      const own = text && text !== word ? text : '';
      const label = own ? `${own} ${name}`.trim() : name ? named.replace('{name}', name) : word;
      if (currentLabel !== label) button.setAttribute('aria-label', label);
      previous.label = label;
    }
    button.querySelectorAll('.sf-icon').forEach(icon => {
      if (icon.getAttribute('aria-hidden') !== 'true') icon.setAttribute('aria-hidden', 'true');
    });
  });

  // Each file's progress bar is a progressbar, and a progressbar without a name
  // is announced as a bare percentage: with three files uploading, the reader
  // hears three numbers and no way to tell them apart. It takes the file's name
  // the way the remove button does, unless the author named it.
  files?.querySelectorAll(CLASS_ROWS).forEach(item => {
    const name = item.querySelector(CLASS_ROW_NAME)?.textContent?.trim() || '';
    // The name has its place in the words ({name}), so a language that puts
    // it first can (C177 (9)).
    const label = name
      ? pageText(FILE_UPLOAD_ITEM_TEXT, 'uploading-name', root, 'sf-file-upload').replace('{name}', name)
      : pageText(FILE_UPLOAD_ITEM_TEXT, 'uploading', root, 'sf-file-upload');
    const host = item.querySelector('sf-progress-bar');
    if (host) {
      const managed = host.dataset.sfUploadLabel;
      if (!host.hasAttribute('label') || host.getAttribute('label') === managed) {
        if (host.getAttribute('label') !== label) host.setAttribute('label', label);
        host.dataset.sfUploadLabel = label;
      }
      return;
    }
    const bar = item.querySelector('.sf-progress-bar');
    if (!bar || bar.hasAttribute('aria-labelledby')) return;
    const current = bar.getAttribute('aria-label');
    if (!current || current === bar.dataset.sfUploadLabel) {
      if (current !== label) bar.setAttribute('aria-label', label);
      bar.dataset.label = label;
      bar.dataset.sfUploadLabel = label;
    }
  });
}

// What a row says, from its item: the same for the class row and the Smart
// template, so the two draw one row.
//   ready    name, size; Remove                      (FU-3)
//   process  name, size; Remove; the bar
//   done     name, «size · загружен», the check; Remove   (FU-4: it had no
//            way out and kept its 100 % bar)
//   error    name, «Не загрузился: <message>»; Remove; «Повторить»   (FU-5:
//            the message was the retry button's label, so the reason was the
//            thing a person pressed to send the same file again)
// `progress: null` is a transfer whose share is not known yet: the bar runs
// without a number. A missing progress reads 100 on done and 0 otherwise.
function describeUploadItem(item, owner = null, fallbackState = 'process') {
  const state = normalizeItemState(item, fallbackState);
  const name = String(item?.name || item?.fileName || 'File');
  const size = String(item?.fileSize || item?.sizeText || '');
  const raw = item?.progress;
  const progress = raw === null
    ? null
    : Math.max(0, Math.min(100, Number(raw ?? (state === 'done' ? 100 : 0)) || 0));
  const message = String(item?.errorMessage || item?.error || '');
  let line = size;
  if (state === 'done') line = size ? fileUploadWord(owner, 'done-line', {vars: {size}}) : fileUploadWord(owner, 'done');
  else if (state === 'error') line = message ? fileUploadWord(owner, 'error-line', {vars: {message}}) : fileUploadWord(owner, 'error');
  return {
    state,
    name,
    size,
    line,
    message,
    progress,
    icon: uploadItemIcon(item, state),
    retryText: String(item?.retryText || fileUploadWord(owner, 'retry')),
  };
}

// A row's glyph says what the file is (C81: a type icon where there is no
// thumbnail): the core file icons by media type, the type guessed from the
// extension when the item has none, a plain file otherwise; an error row
// shows the error glyph. It was cloud_upload in every state, in the primary
// colour, outside the three icon roles (FU-12).
const EXTENSION_TYPES = Object.freeze({
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', heic: 'image/heic', avif: 'image/avif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', gz: 'application/gzip', tar: 'application/x-tar',
  csv: 'text/csv', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', odp: 'application/vnd.oasis.opendocument.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', txt: 'text/plain', md: 'text/markdown',
});

function uploadItemIcon(item, state) {
  if (item?.icon) return String(item.icon);
  if (state === 'error') return 'error';
  const name = String(item?.name || item?.fileName || item?.file?.name || '');
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const type = String(item?.file?.type || item?.mime || EXTENSION_TYPES[extension] || '');
  const icon = fileIcon(type);
  return icon === 'download' ? 'draft' : icon;
}

// The pictures a browser draws from a chosen file's own bytes (C81: a photo's
// thumbnail in its row), as the Smart area draws them. A video's frame and a
// PDF's page are the host's imageUrl: the component never decodes them.
const DRAWN_PICTURES = /^image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml)$/u;

function rowPicture(root, item) {
  const given = item?.imageUrl ?? item?.['image-url'];
  if (given) return String(given);
  const file = item?.file;
  if (typeof Blob === 'undefined' || !(file instanceof Blob) || !DRAWN_PICTURES.test(String(file.type || ''))) return '';
  if (typeof URL?.createObjectURL !== 'function') return '';
  const pictures = root.__sfFileUploadPictures ||= new Map();
  if (!pictures.has(file)) pictures.set(file, URL.createObjectURL(file));
  return pictures.get(file);
}

// A chosen photo's address lives while its file is listed.
function releaseRowPictures(root, items = []) {
  const pictures = root?.__sfFileUploadPictures;
  if (!pictures?.size) return;
  const listed = new Set(items.map((item) => item?.file).filter(Boolean));
  for (const [file, address] of [...pictures]) {
    if (listed.has(file)) continue;
    pictures.delete(file);
    URL.revokeObjectURL?.(address);
  }
}

// A row is the file family's row (owner decisions C81 and C149), the class
// markup of the sf-file-preview row the Smart area draws: the picture of a
// photo or the type's glyph in the grey holder, the name and under it one
// line -- the size (ready; «size · загружен» when sent), the bar (uploading)
// or the reason (error) -- and the actions at the end: «Повторить» on a
// failed file, «×» «Убрать <имя>» on every one. One height in every state
// and at every zone size: the class row stacked the bar and the retry under
// the text, so a list of four files was 44 / 68 / 44 / 84 and jumped at each
// change of state (RG-FU-1).
// «Повторить» as the icon alone, the Smart row's (owner decision C260): the
// sheet draws it in place of the button with words in a row too narrow for
// them (sf-file-preview, the container step g2). Named «Повторить <имя>» by
// the list's labelling, «Повторить» in the Framework's plain tooltip, which
// the anchor links to the button.
function createRetryIcon(word) {
  const anchor = document.createElement('span');
  anchor.className = 'sf-file-preview-retry-icon sf-tooltip-anchor';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--primary sf-icon-button--size-1';
  button.dataset.action = 'retry';
  button.dataset.tooltip = '';
  button.dataset.word = word;
  const glyph = document.createElement('i');
  glyph.className = 'sf-icon';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = 'refresh';
  button.append(glyph);
  const tip = document.createElement('span');
  tip.className = 'sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  const content = document.createElement('span');
  content.className = 'sf-tooltip-content';
  const text = document.createElement('span');
  text.className = 'sf-tooltip-text';
  text.textContent = word;
  content.append(text);
  tip.append(content);
  anchor.append(button, tip);
  return anchor;
}

function createUploadProgressItem(item, owner = null) {
  const row = describeUploadItem(item, owner, 'done');
  const {state, progress} = row;

  const wrap = document.createElement('div');
  wrap.className = 'sf-file-upload-item';
  wrap.setAttribute('role', 'listitem');

  const root = document.createElement('div');
  root.className = [
    'sf-file-preview',
    'sf-file-preview--row',
    state === 'process' ? 'sf-file-preview--uploading' : '',
    state === 'error' ? 'sf-file-preview--error' : '',
  ].filter(Boolean).join(' ');
  root.dataset.state = state;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', row.name);
  if (state === 'process') root.setAttribute('aria-busy', 'true');

  const holder = document.createElement('span');
  holder.className = 'sf-file-preview-holder';
  const picture = owner ? rowPicture(owner, item) : '';
  if (picture) {
    holder.classList.add('sf-file-preview-holder--picture');
    const image = document.createElement('img');
    image.className = 'sf-file-preview-thumbnail';
    image.src = picture;
    image.alt = '';
    image.decoding = 'async';
    holder.append(image);
  } else {
    const glyph = document.createElement('i');
    glyph.className = 'sf-icon';
    // The glyphs are pictures: their ligature names were read as text (docs
    // pre-check 2026-11-10 FU-03).
    glyph.setAttribute('aria-hidden', 'true');
    // The type's glyph in every state, as the Smart row: the error is said by
    // the reason line in the error colour.
    glyph.textContent = uploadItemIcon(item, 'ready');
    holder.append(glyph);
  }

  const main = document.createElement('span');
  main.className = 'sf-file-preview-main';
  const nameNode = document.createElement('span');
  nameNode.className = 'sf-file-preview-name';
  nameNode.title = row.name;
  nameNode.textContent = row.name;
  main.append(nameNode);

  if (state === 'process') {
    // A chosen file that is not being sent, and a sent one, have no bar: there
    // is no transfer to show (FU-3, FU-4). The bar stands in the size line's
    // place, the size 1/2 bar with its per cent at the end (C131 (4)).
    const holderBar = document.createElement('span');
    holderBar.className = 'sf-file-preview-progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'sf-progress-bar sf-progress-bar--size-1/2 flex flex-row items-cross-center';
    if (progress === null) progressBar.dataset.indeterminate = 'true';
    else progressBar.dataset.value = String(progress);
    progressBar.dataset.textPosition = 'inline-end';
    const progressMain = document.createElement('div');
    progressMain.className = 'sf-progress-bar-main';
    const progressValue = document.createElement('div');
    progressValue.className = 'sf-progress-bar-progress transition';
    if (progress !== null) progressValue.style.width = `${progress}%`;
    const progressText = document.createElement('div');
    progressText.className = 'sf-progress-bar-text';
    progressText.textContent = progress === null ? '' : `${progress}%`;
    progressMain.append(progressValue);
    progressBar.append(progressMain, progressText);
    holderBar.append(progressBar);
    main.append(holderBar);
  } else if (state === 'error') {
    const reason = document.createElement('span');
    reason.className = 'sf-file-preview-error';
    reason.textContent = row.line;
    main.append(reason);
  } else if (row.line) {
    const line = document.createElement('span');
    line.className = 'sf-file-preview-meta sf-file-preview-size';
    line.textContent = row.line;
    main.append(line);
  }

  const actions = document.createElement('span');
  actions.className = 'sf-file-preview-actions';
  if (state === 'error') {
    // «Повторить» ends the row, first of its buttons (C88), the button the
    // Smart row draws: ghost, primary, size 1, on the rung of «×» beside it
    // (C103; it was the low button, 32 beside 40).
    const retryHost = document.createElement('span');
    retryHost.className = 'sf-file-preview-retry';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'sf-button sf-button--size-1 sf-button--ghost sf-button--link sf-button--primary flex items-cross-center';
    retry.dataset.action = 'retry';
    const retryIcon = document.createElement('i');
    retryIcon.className = 'sf-icon pointer-events-none';
    retryIcon.setAttribute('aria-hidden', 'true');
    retryIcon.textContent = 'refresh';
    const retryText = document.createElement('span');
    retryText.className = 'sf-button-text-container text-center pointer-events-none';
    retryText.textContent = row.retryText;
    retry.append(retryIcon, retryText);
    retryHost.append(retry);
    actions.append(retryHost, createRetryIcon(row.retryText));
  }
  // Every state can be taken out of the list: «×» «Убрать <имя>», nothing is
  // erased (C149 (8)); the trash is a stored file's, in sf-file-preview.
  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1';
  removeButton.dataset.action = 'remove';
  const removeIcon = document.createElement('i');
  removeIcon.className = 'sf-icon';
  removeIcon.setAttribute('aria-hidden', 'true');
  removeIcon.textContent = 'close';
  removeButton.append(removeIcon);
  actions.append(removeButton);

  root.append(holder, main, actions);
  wrap.append(root);
  return wrap;
}

// The focus inside the list keeps its place when the rows are drawn again: a
// row taken out gives it to the row that took its place (the previous one
// when it was the last), the area when none is left (C81, accessibility). The
// list was rebuilt whole and the focus fell to the page's start (RG-FU-3).
function listFocus(container) {
  const active = container?.ownerDocument?.activeElement;
  if (!active || !container.contains(active)) return null;
  const row = active.closest('[data-index]');
  return {index: Number(row?.dataset.index) || 0, action: active.dataset?.action || ''};
}

function restoreListFocus(root, container, held) {
  if (!held) return;
  const rows = container.querySelectorAll(':scope > [data-index]');
  const row = rows[Math.min(held.index, rows.length - 1)];
  // A failed row holds «Повторить» twice, with words and as the icon alone;
  // the sheet draws one of them (C260): the focus goes to the drawn one.
  const drawn = (selector) => [...(row?.querySelectorAll(selector) || [])].find((button) => button.getClientRects().length > 0);
  const target = (held.action && drawn(`button[data-action="${held.action}"]:not(:disabled)`))
    || drawn('button[data-action="remove"]:not(:disabled)')
    || root;
  target?.focus?.({preventScroll: true});
}

function renderFileUploadItems(root, items = []) {
  root?.classList?.toggle?.('has-files', items.length > 0);

  const container = getFilesContainer(root);
  if (!container || isManagedRenderRoot(root)) {
    if (root) syncFileUploadInteraction(root);
    return;
  }

  const held = listFocus(container);
  container.replaceChildren();
  // The rows are a list (C81), as the Smart area's.
  if (items.length && !container.hasAttribute('role')) container.setAttribute('role', 'list');

  items.forEach((item, index) => {
    const node = createUploadProgressItem(item, root);
    node.dataset.index = String(index);
    container.append(node);
  });
  releaseRowPictures(root, items);
  syncFileUploadInteraction(root);
  restoreListFocus(root, container, held);
}

function emitFileUploadItemAdd(root, item, index, items, source = 'input') {
  root.dispatchEvent(
    new CustomEvent('sf-file-upload:file-add', {
      bubbles: true,
      detail: {
        item,
        index,
        items,
        source,
        multiple: getMultiple(root),
      },
    }),
  );
}

function emitFileUploadItemError(root, item, index, items) {
  root.dispatchEvent(
    new CustomEvent('sf-file-upload:file-error', {
      bubbles: true,
      detail: {
        item,
        index,
        items,
      },
    }),
  );
}

function emitFileUploadItemComplete(root, item, index, items) {
  root.dispatchEvent(
    new CustomEvent('sf-file-upload:file-complete', {
      bubbles: true,
      detail: {
        item,
        index,
        items,
      },
    }),
  );
}

function emitFileUploadComplete(root, items) {
  root.dispatchEvent(
    new CustomEvent('sf-file-upload:complete', {
      bubbles: true,
      detail: {
        items,
      },
    }),
  );
}

function syncFileUploadStateEvents(root, nextItems = [], previousItems = []) {
  const previousMap = new Map(
    previousItems.map((item, index) => [getItemEventKey(item, index), normalizeItemState(item)]),
  );
  const said = [];

  nextItems.forEach((item, index) => {
    const key = getItemEventKey(item, index);
    const nextState = normalizeItemState(item);
    const prevState = previousMap.get(key);

    if (nextState === 'error' && prevState !== 'error') {
      emitFileUploadItemError(root, item, index, nextItems);
      // A list set from scratch (a stored value) is not news.
      if (prevState !== undefined) {
        const message = String(item?.errorMessage || item?.error || '');
        said.push(fileUploadWord(root, message ? 'said-error-line' : 'said-error', {vars: {name: itemName(item), message}}));
      }
    }

    if (nextState === 'done' && prevState !== 'done') {
      emitFileUploadItemComplete(root, item, index, nextItems);
      if (prevState !== undefined) said.push(fileUploadWord(root, 'said-done', {vars: {name: itemName(item)}}));
    }
  });
  announceFileUpload(root, said);

  const hasItems = nextItems.length > 0;
  const isAllDone = hasItems && nextItems.every((item) => normalizeItemState(item) === 'done');
  const wasAllDone =
    previousItems.length > 0 &&
    previousItems.every((item) => normalizeItemState(item) === 'done');

  if (isAllDone && !wasAllDone) {
    emitFileUploadComplete(root, nextItems);
  }
}

// A chosen file's size is written by the core formatter in the page's
// language: «342 КБ» on a Russian page, «342 KB» on an English one (C25,
// docs pre-check 2026-11-10 FU-01). The part's own formatter wrote «342KB»
// in English units with no space on every page.
function normalizeFileItems(files = [], root = null) {
  return Array.from(files).map((file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    fileSize: formatFileSize(file.size, {node: root}),
    state: 'ready',
    file,
  }));
}

// options.action says how the file left: remove («×», taken out of the list)
// or delete (a stored file the person chose to erase; C149 (8)). detach
// carries it, so the page knows which one to answer.
function removeFileUploadItem(root, index, options = {}) {
  if (!root) return false;

  const currentItems = Array.from(root.__sfFileUploadItems || []);
  if (!currentItems.length) return false;

  const normalizedIndex = Number(index);
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= currentItems.length) {
    return false;
  }

  const [removed] = currentItems.splice(normalizedIndex, 1);
  root.__sfFileUploadItems = currentItems;
  renderFileUploadItems(root, currentItems);

  root.dispatchEvent(
    new CustomEvent('sf-file-upload:remove', {
      bubbles: true,
      detail: {
        item: removed || null,
        index: normalizedIndex,
        items: currentItems,
        action: options?.action === 'delete' ? 'delete' : 'remove',
      },
    }),
  );

  return true;
}

function retryFileUploadItem(root, index) {
  if (!root) return false;

  const currentItems = Array.from(root.__sfFileUploadItems || []);
  if (!currentItems.length) return false;

  const normalizedIndex = Number(index);
  if (
    !Number.isInteger(normalizedIndex) ||
    normalizedIndex < 0 ||
    normalizedIndex >= currentItems.length
  ) {
    return false;
  }

  const nextItems = currentItems.map((item) => ({ ...item }));
  const currentItem = nextItems[normalizedIndex];

  // Back in process with its share not known yet: the bar runs without a
  // number until the transfer reports one. It went to 0 % and stood there,
  // which read as a second failure when nothing sent the file again (FU-11);
  // sf-file-upload's uploader sends it, an ordinary area's page answers
  // retry.
  currentItem.state = 'process';
  currentItem.progress = null;
  delete currentItem.errorMessage;
  delete currentItem.error;
  delete currentItem.reason;

  const previousItems = Array.from(root.__sfFileUploadItems || []);
  root.__sfFileUploadItems = nextItems;
  renderFileUploadItems(root, nextItems);
  syncFileUploadStateEvents(root, nextItems, previousItems);

  root.dispatchEvent(
    new CustomEvent('sf-file-upload:retry', {
      bubbles: true,
      detail: {
        item: currentItem,
        index: normalizedIndex,
        items: nextItems,
      },
    }),
  );

  return true;
}

function emitSelect(root, files, source = 'input') {
  root.dispatchEvent(
    new CustomEvent('sf-file-upload:select', {
      bubbles: true,
      detail: {
        files,
        source,
        multiple: getMultiple(root),
      },
    }),
  );
}

// A choice adds to the list on a multiple area, so files can be added in
// portions; a file already listed (same name, size and time) is not listed
// twice. A single area keeps one file: a new choice replaces it, and the
// replaced entry leaves with remove {reason: 'replaced'}. The choice assigned
// the new files over the list, so a second pick wiped the first (study
// 2026-11-11 FU-1). Returns the entries that entered the list.
function applySelectedFiles(root, files = [], source = 'input') {
  const chosen = normalizeFileItems(files, root);
  const previousItems = Array.from(root.__sfFileUploadItems || []);
  const multiple = getMultiple(root);
  const listed = new Set(previousItems.map((item, index) => getItemEventKey(item, index)));
  const added = multiple
    ? chosen.filter((item, index) => !listed.has(item.id) && chosen.findIndex((other) => other.id === item.id) === index)
    : chosen.slice(0, 1);
  if (!added.length) return [];
  const replaced = multiple ? [] : previousItems;
  const nextFiles = multiple ? [...previousItems, ...added] : added;
  root.__sfFileUploadItems = nextFiles;
  renderFileUploadItems(root, nextFiles);
  syncFileUploadStateEvents(root, nextFiles, previousItems);
  replaced.forEach((item, index) => {
    root.dispatchEvent(new CustomEvent('sf-file-upload:remove', {
      bubbles: true,
      detail: {item, index, items: nextFiles, reason: 'replaced'},
    }));
  });
  added.forEach((item) => {
    emitFileUploadItemAdd(root, item, nextFiles.indexOf(item), nextFiles, source);
  });
  announceFileUpload(root, [added.length === 1
    ? fileUploadWord(root, 'said-added', {vars: {name: itemName(added[0])}})
    : fileUploadWord(root, 'said-added-many', {count: added.length})]);
  emitSelect(root, added, source);
  return added;
}

function fileUploadWord(root, key, options = {}) {
  return pageWord(FILE_UPLOAD_ITEM_TEXT, key, root, {component: 'sf-file-upload', ...options});
}

// The formats an accept list names, as people read them: «PDF, DOCX»,
// «изображения». `type/*` is the kind's word; it wrote «*» before.
// The names are the core's (intake.mjs): image/jpeg reads «JPG», image/svg+xml
// «SVG».
function formatAcceptWords(accept, root = null) {
  return acceptFormats(accept, (kind) => fileUploadWord(root, `formats-${kind}`));
}

// Where a file that was not added is said: the line under the area (C81: the
// message under the field, not a row in the list), a polite status a screen
// reader announces. The Smart template draws it; an ordinary area gets one
// after it when it is bound: a live region made at the moment of its first
// words is often not heard (RG-FU-4).
function getMessage(root, create = false) {
  if (!root) return null;
  const next = root.nextElementSibling;
  if (next?.classList?.contains('sf-file-upload-message')) return next;
  if (!create || isManagedRenderRoot(root) || typeof document === 'undefined' || typeof root.after !== 'function') return null;
  const message = document.createElement('div');
  message.className = 'sf-file-upload-message';
  message.setAttribute('role', 'status');
  message.hidden = true;
  root.after(message);
  return message;
}

// What happened to the list, for a screen reader only (C81, accessibility):
// a file added, sent, or not sent, said politely; the per cent is not said.
// A region of its own beside the message, made with the area (the Smart
// template and the class draw it): the message is seen and says only what
// was left out.
function getStatus(root, create = false) {
  if (!root) return null;
  let next = root.nextElementSibling;
  if (next?.classList?.contains('sf-file-upload-message')) next = next.nextElementSibling;
  if (next?.classList?.contains('sf-file-upload-status')) return next;
  if (!create || isManagedRenderRoot(root) || typeof document === 'undefined') return null;
  const anchor = getMessage(root, true);
  if (!anchor) return null;
  const status = document.createElement('div');
  status.className = 'sf-file-upload-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  anchor.after(status);
  return status;
}

function announceFileUpload(root, lines = []) {
  const said = lines.filter(Boolean);
  if (!said.length) return;
  const status = getStatus(root);
  if (!status) return;
  const text = said.join('. ');
  // The same words again (a second file of one name) are said again: the
  // region is emptied first.
  if (status.textContent === text) status.textContent = '';
  status.textContent = text;
}

function itemName(item) {
  return String(item?.name || item?.fileName || item?.file?.name || '');
}

function showFileUploadRejections(root, rejected = []) {
  const message = getMessage(root, rejected.length > 0);
  root.__sfFileUploadRejected = rejected;
  if (!message) return;
  message.replaceChildren();
  message.hidden = !rejected.length;
  if (!rejected.length) return;
  if (rejected.length === 1) {
    message.textContent = rejected[0].message;
    return;
  }
  const head = document.createElement('span');
  head.textContent = fileUploadWord(root, 'not-added', {count: rejected.length});
  const list = document.createElement('ul');
  rejected.forEach((entry) => {
    const line = document.createElement('li');
    line.textContent = entry.message;
    list.append(line);
  });
  message.append(head, list);
}

// What a choice or a drop leaves out, and why: a type the accept list does
// not name (on a pick too: the dialog's «All files» skipped the filter), a
// second file on a single area, a file already listed. The drop took the
// first file and said nothing of the rest (FU-6); a wrong type sent
// rejected and showed nothing (FU-7). Each one is said under the area and in
// reject {files, rejected: [{file, name, reason, message}], accept, source}.
function takeFiles(root, files = [], source = 'input') {
  const accept = getAccept(root);
  const multiple = getMultiple(root);
  const kept = multiple ? Array.from(root.__sfFileUploadItems || []) : [];
  const listed = new Set(kept.map((item, index) => getItemEventKey(item, index)));
  const maxSize = getLimit(root, 'max-size');
  const minSize = getLimit(root, 'min-size');
  const maxFiles = multiple ? getLimit(root, 'max-files') : 0;
  const maxTotal = getLimit(root, 'max-total-size');
  const size = (bytes) => formatFileSize(bytes, {node: root});
  let count = kept.length;
  let total = kept.reduce((sum, item) => sum + itemBytes(item), 0);
  const accepted = [];
  const rejected = [];
  Array.from(files).forEach((file) => {
    const name = String(file?.name || '');
    const key = `${file?.name}-${file?.size}-${file?.lastModified}`;
    const bytes = Number(file?.size) || 0;
    let reason = '';
    let vars = {name};
    let words = {};
    const own = fileRejection(file, {accept, maxSize, minSize});
    if (!multiple && accepted.length) reason = 'one';
    else if (listed.has(key)) reason = 'duplicate';
    else if (own === 'type') {
      reason = 'type';
      vars = {name, formats: formatAcceptWords(accept, root)};
    } else if (own === 'empty') reason = 'empty';
    else if (own === 'size') {
      reason = 'size';
      vars = {name, size: size(bytes), max: size(maxSize)};
    } else if (own === 'min-size') {
      reason = 'min-size';
      vars = {name, size: size(bytes), min: size(minSize)};
    } else if (maxFiles && count >= maxFiles) {
      reason = 'count';
      words = {count: maxFiles};
    } else if (maxTotal && total + bytes > maxTotal) {
      reason = 'total';
      vars = {name, max: size(maxTotal)};
    }
    if (reason) {
      rejected.push({file, name, reason: reason === 'one' ? 'count' : reason, message: fileUploadWord(root, `reject-${reason}`, {vars, ...words})});
      return;
    }
    listed.add(key);
    count += 1;
    total += bytes;
    accepted.push(file);
  });
  showFileUploadRejections(root, rejected);
  if (rejected.length) {
    root.dispatchEvent(new CustomEvent('sf-file-upload:reject', {
      bubbles: true,
      detail: {files: rejected.map((entry) => entry.file), rejected, accept, source},
    }));
  }
  return accepted.length ? applySelectedFiles(root, accepted, source) : [];
}

// The words about dragging («или перетащите их сюда») are a part of their
// own, so a screen that cannot drag hides them (owner decision C223): the
// author's markup wrote them as bare text after the link; they are put in
// .sf-file-upload-drag when the zone is bound.
function wrapDragWords(root) {
  const block = root?.querySelector?.('.sf-file-upload-block-text');
  if (!block || block.querySelector('.sf-file-upload-drag')) return;
  // Only the words after the link: without a link the text is the zone's
  // whole call and stays.
  const link = block.querySelector('.sf-file-upload-link');
  if (!link) return;
  const loose = Array.from(block.childNodes).filter((node) => node.nodeType === 3
    && node.textContent.trim()
    && (link.compareDocumentPosition(node) & 4));
  if (!loose.length) return;
  const drag = document.createElement('span');
  drag.className = 'sf-file-upload-drag';
  drag.textContent = loose.map((node) => node.textContent).join('').trim();
  loose[0].before(' ', drag);
  loose.forEach((node) => node.remove());
}

function bindFileUpload(root) {
  // The area stands on the field ladder: 1/3 and 3 are its own steps, no
  // class to move.
  if (!root) return;

  const input = ensureInput(root);
  const filesContainer = getFilesContainer(root);
  // DOM markers survive cloneNode; listeners and selected File objects do not.
  if (typeof root.__sfFileUploadOnClick === 'function') {
    if (root.__sfFileUploadBoundInput === input && root.__sfFileUploadBoundFiles === filesContainer) return;
    unbindFileUpload(root);
  } else if (root.dataset[FILE_UPLOAD_BOUND_FLAG] === '1' && !root.__sfFileUploadItems && !isManagedRenderRoot(root)) {
    root.__sfFileUploadItems = [];
    if (root.classList.contains('has-files') && !root.hasAttribute('data-target')) {
      renderFileUploadItems(root, []);
    }
    root.classList.remove('has-files', 'dragover');
  }
  syncFileUploadInteraction(root);
  if (!root.hasAttribute('role')) {
    root.setAttribute('role', 'button');
  }
  // The live regions stand from the start (RG-FU-4).
  getStatus(root, true);
  if (!isManagedRenderRoot(root)) wrapDragWords(root);

  const openInput = () => {
    if (isDisabledRoot(root)) return;
    syncInputConfig(root, input);
    input.click();
  };

  const onRootClick = (event) => {
    if (isDisabledRoot(root)) {
      event.preventDefault();
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.sf-upload-progress-repeat, [data-action="retry"]')) return;
    if (target.closest('input[type="file"]')) return;
    if (target.closest('[data-action="remove"]')) return;

    openInput();
  };

  const onKeydown = (event) => {
    if (event.target !== root || event.repeat || root.matches('button, input, a[href]')) return;
    if (isDisabledRoot(root)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openInput();
  };

  const onInputChange = (event) => {
    if (isDisabledRoot(root)) return;
    const files = Array.from(event.target?.files || []);
    if (!files.length) return;
    takeFiles(root, files, 'input');
    event.target.value = '';
  };

  const onDragOver = (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    if (isDisabledRoot(root)) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    root.classList.add('dragover');
  };

  const onDragLeave = (event) => {
    if (!root.contains(event.relatedTarget)) {
      root.classList.remove('dragover');
    }
  };

  const onDrop = (event) => {
    root.classList.remove('dragover');
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length && !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    if (isDisabledRoot(root) || !files.length) return;

    const added = takeFiles(root, files, 'drop');
    if (!added.length) return;
    // A pick sends change from the native input; a drop sent none, so a form
    // listening for change never heard of a dropped file.
    root.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      detail: {files: added.map((item) => item.file), source: 'drop'},
    }));
  };

  const onFilesClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const removeButton = target.closest('[data-action="remove"]');
    const retryButton = target.closest('[data-action="retry"]');

    if (!removeButton && !retryButton) return;

    if (isDisabledRoot(root) || (removeButton || retryButton).disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const itemNode = (removeButton || retryButton).closest('[data-index], .sf-upload-progress');
    if (!itemNode) return;

    event.preventDefault();
    event.stopPropagation();

    if (removeButton) {
      removeFileUploadItem(root, itemNode.dataset.index);
      return;
    }

    retryFileUploadItem(root, itemNode.dataset.index);
  };

  root.addEventListener('click', onRootClick);
  root.addEventListener('keydown', onKeydown);
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('dragleave', onDragLeave);
  root.addEventListener('drop', onDrop);
  input.addEventListener('change', onInputChange);
  filesContainer?.addEventListener('click', onFilesClick);

  root.__sfFileUploadOnClick = onRootClick;
  root.__sfFileUploadOnKeydown = onKeydown;
  root.__sfFileUploadOnDragOver = onDragOver;
  root.__sfFileUploadOnDragLeave = onDragLeave;
  root.__sfFileUploadOnDrop = onDrop;
  root.__sfFileUploadOnChange = onInputChange;
  root.__sfFileUploadOnFilesClick = onFilesClick;
  root.__sfFileUploadBoundInput = input;
  root.__sfFileUploadBoundFiles = filesContainer;
  const interactionObserver = new MutationObserver(() => syncFileUploadInteraction(root));
  interactionObserver.observe(root, {attributes: true, attributeFilter: ['disabled', 'class', 'accept', 'multiple', 'data-accept', 'data-multiple']});
  if (filesContainer) interactionObserver.observe(filesContainer, {childList: true, subtree: true, characterData: true});
  root.__sfFileUploadInteractionObserver = interactionObserver;
  root.dataset[FILE_UPLOAD_BOUND_FLAG] = '1';
}

function unbindFileUpload(root) {
  if (!root) return;

  const input = root.__sfFileUploadBoundInput || getInput(root);
  root.__sfFileUploadInteractionObserver?.disconnect();
  delete root.__sfFileUploadInteractionObserver;
  if (root.__sfFileUploadOnClick) {
    root.removeEventListener('click', root.__sfFileUploadOnClick);
  }
  if (root.__sfFileUploadOnKeydown) {
    root.removeEventListener('keydown', root.__sfFileUploadOnKeydown);
  }
  if (root.__sfFileUploadOnDragOver) {
    root.removeEventListener('dragover', root.__sfFileUploadOnDragOver);
  }
  if (root.__sfFileUploadOnDragLeave) {
    root.removeEventListener('dragleave', root.__sfFileUploadOnDragLeave);
  }
  if (root.__sfFileUploadOnDrop) {
    root.removeEventListener('drop', root.__sfFileUploadOnDrop);
  }
  if (input && root.__sfFileUploadOnChange) {
    input.removeEventListener('change', root.__sfFileUploadOnChange);
  }
  const filesContainer = root.__sfFileUploadBoundFiles || getFilesContainer(root);
  if (filesContainer && root.__sfFileUploadOnFilesClick) {
    filesContainer.removeEventListener('click', root.__sfFileUploadOnFilesClick);
  }

  delete root.__sfFileUploadOnClick;
  delete root.__sfFileUploadOnKeydown;
  delete root.__sfFileUploadOnDragOver;
  delete root.__sfFileUploadOnDragLeave;
  delete root.__sfFileUploadOnDrop;
  delete root.__sfFileUploadOnChange;
  delete root.__sfFileUploadOnFilesClick;
  delete root.__sfFileUploadBoundInput;
  delete root.__sfFileUploadBoundFiles;
  delete root.dataset[FILE_UPLOAD_BOUND_FLAG];
}

function initExistingFileUploads(target = document) {
  target.querySelectorAll(FILE_UPLOAD_SELECTOR).forEach(bindOrdinaryFileUpload);
}

function bindOrdinaryFileUpload(root) {
  // Smart owns its render timing and teardown, even when both bundles load.
  if (root.isConnected && !root.closest('sf-file-upload')) bindFileUpload(root);
}

function getFileUploadItems(target) {
  const root =
    target instanceof HTMLElement
      ? target.closest(FILE_UPLOAD_SELECTOR) || target
      : null;

  if (!root) return [];
  return Array.from(root.__sfFileUploadItems || []);
}

function setFileUploadItems(target, items = []) {
  const root =
    target instanceof HTMLElement
      ? target.closest(FILE_UPLOAD_SELECTOR) || target
      : null;

  if (!root) return false;
  const previousItems = Array.from(root.__sfFileUploadItems || []);
  root.__sfFileUploadItems = Array.isArray(items) ? items : [];
  renderFileUploadItems(root, root.__sfFileUploadItems);
  syncFileUploadStateEvents(root, root.__sfFileUploadItems, previousItems);
  return true;
}

function clearFileUpload(target) {
  const root = target instanceof HTMLElement ? target.closest(FILE_UPLOAD_SELECTOR) || target : null;
  if (root) showFileUploadRejections(root, []);
  return setFileUploadItems(target, []);
}

// The class built nothing: template stayed null and render() returned null. It
// builds the drop area and its list now, the markup the Smart template draws.
class FileUpload extends ComponentObserver {
  static componentName = 'FileUpload';

  constructor(props) {
    super(props);
    const {
      size = '1', accept = '', multiple = false, disabled = false, icon = 'cloud_upload',
      linkText, text, supportingText = '', label = '',
    } = this.params || {};
    const step = normalizeSize(size);
    const wrapper = document.createElement('div');
    // The list keeps its distance from the area itself (FU-12), the same
    // inside this wrapper and under a Smart host.
    wrapper.className = 'sf-file-upload-wrap flex flex-col';
    const root = document.createElement('div');
    if (this.id) root.id = this.id;
    root.className = `sf-file-upload sf-file-upload--size-${step} flex flex-col items-cross-center cursor-pointer`;
    const className = this.attrs.class || this.attrs.className;
    if (className) root.classList.add(...String(className).split(' ').filter(Boolean));
    if (accept) root.dataset.accept = accept;
    root.dataset.multiple = toBoolean(multiple) ? 'true' : 'false';
    if (toBoolean(multiple)) root.setAttribute('multiple', '');
    if (toBoolean(disabled)) root.setAttribute('disabled', '');
    if (label) root.setAttribute('aria-label', label);
    root.tabIndex = 0;
    const featured = document.createElement('div');
    featured.className = `sf-featured-icon sf-featured-icon--size-${step} sf-featured-icon--soft sf-featured-icon--circle sf-featured-icon--neutral`;
    const glyph = document.createElement('i');
    glyph.className = 'sf-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = icon;
    featured.append(glyph);
    const bottom = document.createElement('div');
    bottom.className = 'sf-file-upload-bottom flex flex-col items-cross-center';
    const block = document.createElement('div');
    block.className = 'sf-file-upload-block flex';
    const blockText = document.createElement('div');
    blockText.className = 'sf-file-upload-block-text';
    const link = document.createElement('span');
    link.className = 'sf-file-upload-link';
    link.textContent = linkText ?? pageText(FILE_UPLOAD_ITEM_TEXT, 'linkText', root, 'sf-file-upload');
    const drag = document.createElement('span');
    drag.className = 'sf-file-upload-drag';
    drag.textContent = text ?? pageText(FILE_UPLOAD_ITEM_TEXT, 'text', root, 'sf-file-upload');
    blockText.append(link, ' ', drag);
    block.append(blockText);
    bottom.append(block);
    if (supportingText) {
      const support = document.createElement('span');
      support.className = 'sf-file-upload-text';
      support.textContent = supportingText;
      bottom.append(support);
    }
    root.append(featured, bottom);
    const message = document.createElement('div');
    message.className = 'sf-file-upload-message';
    message.setAttribute('role', 'status');
    message.hidden = true;
    const status = document.createElement('div');
    status.className = 'sf-file-upload-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    const files = document.createElement('div');
    // The rows' list, as the Smart area's (C81).
    files.className = 'sf-file-upload-files grid grid-col-1 gap-1/2 w-full';
    files.setAttribute('role', 'list');
    wrapper.append(root, message, status, files);
    this.root = root;
    this.template = wrapper;
  }

  init() {
    bindFileUpload(this.root);
  }

  destroyInternal() {
    unbindFileUpload(this.root);
  }
}

registerComponent('FileUpload', FileUpload);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.FileUpload = window.SF.FileUpload || {};
  window.SF.FileUpload.getItems = getFileUploadItems;
  window.SF.FileUpload.setItems = setFileUploadItems;
  window.SF.FileUpload.clear = clearFileUpload;
  window.SF.FileUpload.removeItem = removeFileUploadItem;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingFileUploads(), {
    once: true,
  });
} else {
  initExistingFileUploads();
}

const fileUploadObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(FILE_UPLOAD_SELECTOR)) {
        bindOrdinaryFileUpload(node);
      }
      initExistingFileUploads(node);
    });
    mutation.removedNodes.forEach((node) => {
      if (!(node instanceof Element) || node.isConnected) return;
      const roots = [...node.querySelectorAll(FILE_UPLOAD_SELECTOR)];
      if (node.matches(FILE_UPLOAD_SELECTOR)) roots.push(node);
      roots.forEach((root) => {
        if (!root.isConnected && !root.closest('sf-file-upload')) unbindFileUpload(root);
      });
    });
  });
});

fileUploadObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindFileUpload,
  unbindFileUpload,
  initExistingFileUploads,
  getFileUploadItems,
  setFileUploadItems,
  clearFileUpload,
  retryFileUploadItem,
  removeFileUploadItem,
  takeFiles,
  formatAcceptWords,
  normalizeItemState,
  describeUploadItem,
  ITEM_STATES,
};
