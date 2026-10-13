import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { fieldSize, retireFieldSizeClass } from '../../field-size';
import { pageText } from '../../../core/js/page-language';
// Every word this part says. A product adds a language with
// SF.language.register('sf-file-upload', code, words); a ternary on «ru» allowed two
// and no more.
const FILE_UPLOAD_ITEM_TEXT = {
  en: {
    remove: 'Remove',
    uploading: 'Uploading',
    retry: 'Try again',
    linkText: 'Click to upload',
    text: 'or drag and drop',
  },
  ru: {
    remove: 'Удалить',
    uploading: 'Загрузка',
    retry: 'Повторить',
    linkText: 'Выберите файл',
    text: 'или перетащите его сюда',
  },
};


const FILE_UPLOAD_SELECTOR = '.sf-file-upload';
const FILE_UPLOAD_BOUND_FLAG = 'sfFileUploadBound';

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'disabled', 'multiple'].includes(
    String(value).toLowerCase(),
  );
}

function normalizeSize(value) {
  return fieldSize(value, 'sf-file-upload');
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '';
  if (size < 1024) return `${size} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[index]}`;
}

function normalizeItemState(item) {
  const state = String(item?.state || item?.status || 'process').toLowerCase();
  return ['process', 'done', 'error'].includes(state) ? state : 'process';
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

  const next = root.nextElementSibling;
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
  files?.querySelectorAll('button[data-action="remove"], button[data-action="retry"]').forEach(button => {
    let previous = state.buttons.get(button);
    if (!previous) {
      previous = {disabled: button.disabled, managedDisabled: false, label: null};
      state.buttons.set(button, previous);
    }
    if (!previous.managedDisabled) previous.disabled = button.disabled;
    const nextDisabled = disabled || previous.disabled;
    if (button.disabled !== nextDisabled) button.disabled = nextDisabled;
    previous.managedDisabled = disabled;
    if (button.dataset.action !== 'remove') return;
    const currentLabel = button.getAttribute('aria-label');
    if (!button.hasAttribute('aria-labelledby') && (!currentLabel || currentLabel === previous.label)) {
      const name = button.closest('.sf-upload-progress')?.querySelector('.sf-upload-progress-name')?.textContent?.trim() || '';
      const label = `${pageText(FILE_UPLOAD_ITEM_TEXT, 'remove', root, 'sf-file-upload')} ${name}`.trim();
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
  files?.querySelectorAll('.sf-upload-progress').forEach(item => {
    const name = item.querySelector('.sf-upload-progress-name')?.textContent?.trim() || '';
    const label = `${pageText(FILE_UPLOAD_ITEM_TEXT, 'uploading', root, 'sf-file-upload')} ${name}`.trim();
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

function createUploadProgressItem(item, size = '1', owner = null) {
  const normalizedSize = normalizeSize(size);
  const state = String(item.state || item.status || 'done').toLowerCase();
  const fileName = String(item.name || item.fileName || 'File');
  const fileSize = String(item.fileSize || item.sizeText || '');
  const progress = Math.max(0, Math.min(100, Number(item.progress ?? 100) || 0));
  const iconName = String(item.icon || 'cloud_upload');
  const errorMessage = String(item.errorMessage || item.retryText || pageText(FILE_UPLOAD_ITEM_TEXT, 'retry', owner, 'sf-file-upload'));

  const root = document.createElement('div');
  root.className = [
    'sf-upload-progress',
    `sf-upload-progress--size-${normalizedSize}`,
    `sf-upload-progress--${state}`,
    'flex',
    'items-main-start',
    'items-cross-start',
  ].join(' ');

  const leftIcon = document.createElement('i');
  leftIcon.classList.add('sf-icon');
  leftIcon.textContent = iconName;

  const content = document.createElement('div');
  content.className = 'sf-upload-progress-content flex flex-col flex-1';

  const top = document.createElement('div');
  top.className = 'sf-upload-progress-top flex content-main-between';

  const left = document.createElement('div');
  left.className = 'sf-upload-progress-left flex flex-col';

  const nameNode = document.createElement('div');
  nameNode.className = 'sf-upload-progress-name';
  nameNode.textContent = fileName;

  const textNode = document.createElement('div');
  textNode.className = 'sf-upload-progress-text';
  textNode.textContent = fileSize;

  left.append(nameNode, textNode);
  top.append(left);

  if (state === 'done') {
    const doneIcon = document.createElement('i');
    doneIcon.className = 'sf-icon sf-icon-solid';
    doneIcon.textContent = 'check_circle';
    top.append(doneIcon);
  } else if (state === 'error') {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className =
      `sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${normalizedSize} flex items-cross-center content-main-center self-cross-start`;
    removeButton.dataset.action = 'remove';

    const removeIcon = document.createElement('i');
    removeIcon.className = 'sf-icon';
    removeIcon.textContent = 'delete';
    removeButton.append(removeIcon);
    top.append(removeButton);

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'sf-upload-progress-repeat self-cross-start';
    retry.dataset.action = 'retry';
    retry.textContent = errorMessage;
    content.append(top, retry);
    root.append(leftIcon, content);
    return root;
  } else {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className =
      `sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${normalizedSize} flex items-cross-center content-main-center self-cross-start`;
    removeButton.dataset.action = 'remove';

    const removeIcon = document.createElement('i');
    removeIcon.className = 'sf-icon';
    removeIcon.textContent = 'delete';
    removeButton.append(removeIcon);
    top.append(removeButton);
  }

  const progressBar = document.createElement('div');
  progressBar.className =
    `sf-progress-bar sf-progress-bar--size-${normalizedSize} flex flex-row items-cross-center`;
  progressBar.dataset.value = String(progress);
  progressBar.dataset.textPosition = 'inline-end';

  const progressMain = document.createElement('div');
  progressMain.className = 'sf-progress-bar-main';

  const progressValue = document.createElement('div');
  progressValue.className = 'sf-progress-bar-progress transition';
  progressValue.style.width = `${progress}%`;

  const progressText = document.createElement('div');
  progressText.className = 'sf-progress-bar-text';
  progressText.textContent = `${progress}%`;

  progressMain.append(progressValue);
  progressBar.append(progressMain, progressText);
  content.append(top, progressBar);
  root.append(leftIcon, content);

  return root;
}

function renderFileUploadItems(root, items = []) {
  root?.classList?.toggle?.('has-files', items.length > 0);

  const container = getFilesContainer(root);
  if (!container || isManagedRenderRoot(root)) {
    if (root) syncFileUploadInteraction(root);
    return;
  }

  container.innerHTML = '';
  const size = normalizeSize(
    Array.from(root.classList)
      .find((cls) => cls.startsWith('sf-file-upload--size-'))
      ?.replace('sf-file-upload--size-', '') || '1',
  );

  items.forEach((item, index) => {
    const node = createUploadProgressItem(item, size, root);
    node.dataset.index = String(index);
    container.append(node);
  });
  syncFileUploadInteraction(root);
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

  nextItems.forEach((item, index) => {
    const key = getItemEventKey(item, index);
    const nextState = normalizeItemState(item);
    const prevState = previousMap.get(key);

    if (nextState === 'error' && prevState !== 'error') {
      emitFileUploadItemError(root, item, index, nextItems);
    }

    if (nextState === 'done' && prevState !== 'done') {
      emitFileUploadItemComplete(root, item, index, nextItems);
    }
  });

  const hasItems = nextItems.length > 0;
  const isAllDone = hasItems && nextItems.every((item) => normalizeItemState(item) === 'done');
  const wasAllDone =
    previousItems.length > 0 &&
    previousItems.every((item) => normalizeItemState(item) === 'done');

  if (isAllDone && !wasAllDone) {
    emitFileUploadComplete(root, nextItems);
  }
}

function normalizeFileItems(files = []) {
  return Array.from(files).map((file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    fileSize: formatFileSize(file.size),
    progress: 0,
    state: 'process',
    file,
  }));
}

function removeFileUploadItem(root, index) {
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

  currentItem.state = 'process';
  currentItem.progress = 0;
  delete currentItem.errorMessage;
  delete currentItem.retryText;

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

// Whether a file is one the accept list names: `.ext`, `type/*` or `type/sub`,
// as the platform dialog reads it. The dialog filters what a person may pick; a
// drop went past it and took any file at all.
function acceptsFile(accept, file) {
  const tokens = String(accept || '').split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
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

function applySelectedFiles(root, files = [], source = 'input') {
  const nextFiles = normalizeFileItems(files);
  const previousItems = Array.from(root.__sfFileUploadItems || []);
  root.__sfFileUploadItems = nextFiles;
  renderFileUploadItems(root, nextFiles);
  syncFileUploadStateEvents(root, nextFiles, previousItems);
  nextFiles.forEach((item, index) => {
    emitFileUploadItemAdd(root, item, index, nextFiles, source);
  });
  emitSelect(root, nextFiles, source);
}

function bindFileUpload(root) {
  retireFieldSizeClass(root, 'sf-file-upload');
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
    if (target.closest('.sf-upload-progress-repeat')) return;
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
    applySelectedFiles(root, files, 'input');
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

    const accepted = files.filter((file) => acceptsFile(getAccept(root), file));
    const rejected = files.filter((file) => !accepted.includes(file));
    if (rejected.length) {
      root.dispatchEvent(new CustomEvent('sf-file-upload:reject', {
        bubbles: true,
        detail: {files: rejected, accept: getAccept(root), source: 'drop'},
      }));
    }
    if (!accepted.length) return;
    const normalized = getMultiple(root) ? accepted : accepted.slice(0, 1);
    applySelectedFiles(root, normalized, 'drop');
    // A pick sends change from the native input; a drop sent none, so a form
    // listening for change never heard of a dropped file.
    root.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      detail: {files: normalized, source: 'drop'},
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

    const itemNode = (removeButton || retryButton).closest('.sf-upload-progress');
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
    wrapper.className = 'sf-file-upload-wrap flex flex-col gap-1';
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
    blockText.append(link, ` ${text ?? pageText(FILE_UPLOAD_ITEM_TEXT, 'text', root, 'sf-file-upload')}`);
    block.append(blockText);
    bottom.append(block);
    if (supportingText) {
      const support = document.createElement('span');
      support.className = 'sf-file-upload-text';
      support.textContent = supportingText;
      bottom.append(support);
    }
    root.append(featured, bottom);
    const files = document.createElement('div');
    files.className = 'sf-file-upload-files grid grid-col-1 gap-1 w-full';
    wrapper.append(root, files);
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
};
