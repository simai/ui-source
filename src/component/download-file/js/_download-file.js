import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import downloadFileUtility from '../json/download-file.utility.json';

const DOWNLOAD_FILE_SELECTOR = '.sf-download-file';
const DOWNLOAD_FILE_BOUND_FLAG = 'sfDownloadFileBound';

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'disabled', 'download'].includes(
    String(value).toLowerCase(),
  );
}

function normalizeSize(value) {
  const normalized = String(value || '').toLowerCase();
  const supported = ['1/3', '1/2', '1', '2', '3'];
  return supported.includes(normalized) ? normalized : '1';
}

function buildAnchorDownload(href, filename = '') {
  if (!href) return;

  const anchor = document.createElement('a');
  anchor.href = href;
  if (filename) {
    anchor.download = filename;
  }
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '';

  if (size < 1024) return `${size} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[unitIndex]}`;
}

async function resolveRemoteFileSize(href) {
  if (!href) return '';

  try {
    const response = await fetch(href, {
      method: 'HEAD',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return '';
    }

    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      return '';
    }

    return formatFileSize(contentLength);
  } catch {
    return '';
  }
}

function getRootLink(root) {
  if (!root || !(root instanceof HTMLElement)) return null;
  return root.tagName.toLowerCase() === 'a'
    ? root
    : root.querySelector('a.sf-download-file');
}

function getSizeNode(root) {
  return root?.querySelector?.('.sf-download-file-file-size') || null;
}

function getRootHref(root) {
  const href = root?.getAttribute?.('href');
  if (href) return href;
  const link = getRootLink(root);
  return link?.getAttribute?.('href') || '';
}

function isDisabledRoot(root) {
  if (!root) return false;
  return (
    root.classList.contains('disabled') ||
    root.hasAttribute('disabled') ||
    root.getAttribute('aria-disabled') === 'true'
  );
}

async function resolveAndApplyFileSize(root) {
  if (!root || isDisabledRoot(root)) return;

  const sizeNode = getSizeNode(root);
  if (!sizeNode) return;
  if (String(sizeNode.textContent || '').trim()) return;

  const href = getRootHref(root);
  if (!href) return;

  const resolvedSize = await resolveRemoteFileSize(href);
  if (!resolvedSize || !sizeNode.isConnected) return;

  sizeNode.textContent = resolvedSize;
}

function emitDownloadFileClick(root, href, fileName, download) {
  root?.dispatchEvent(
    new CustomEvent('sf-download-file:click', {
      bubbles: true,
      detail: { href, fileName, download },
    }),
  );
}

function bindDownloadFile(root) {
  if (!root || root.dataset[DOWNLOAD_FILE_BOUND_FLAG] === '1') return;

  const handleClick = (event) => {
    if (isDisabledRoot(root)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const href = getRootHref(root);
    const fileName =
      root.getAttribute('download') ||
      root.dataset.fileName ||
      root.querySelector('.sf-download-file__name, .sf-download-file-file-name')?.textContent?.trim() ||
      '';
    const download =
      root.hasAttribute('download') || root.dataset.download === 'true';

    emitDownloadFileClick(root, href, fileName, download);

    if (root.tagName.toLowerCase() === 'a') {
      return;
    }

    if (!href) {
      return;
    }

    event.preventDefault();
    buildAnchorDownload(href, download ? fileName : '');
  };

  root.addEventListener('click', handleClick);
  root.__sfDownloadFileClick = handleClick;
  root.dataset[DOWNLOAD_FILE_BOUND_FLAG] = '1';
  resolveAndApplyFileSize(root);
}

function unbindDownloadFile(root) {
  if (!root || root.dataset[DOWNLOAD_FILE_BOUND_FLAG] !== '1') return;
  if (root.__sfDownloadFileClick) {
    root.removeEventListener('click', root.__sfDownloadFileClick);
  }
  delete root.__sfDownloadFileClick;
  delete root.dataset[DOWNLOAD_FILE_BOUND_FLAG];
}

function initExistingDownloadFiles(target = document) {
  target.querySelectorAll(DOWNLOAD_FILE_SELECTOR).forEach(bindDownloadFile);
}

class DownloadFile extends ComponentObserver {
  static componentName = 'DownloadFile';
  static utilityMap = downloadFileUtility;
  html = null;

  constructor(props) {
    super(props);

    const {
      size = '1',
      fileName = 'File.pdf',
      fileSize = '36MB',
      icon = 'download',
      href = '',
      download = false,
      disabled = false,
      target = '_blank',
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    const isDisabled = toBoolean(disabled, false);
    const canLink = Boolean(href) && !isDisabled;
    const root = document.createElement(canLink ? 'a' : 'button');

    if (this.id) {
      root.id = this.id;
    }

    if (canLink) {
      root.href = String(href);
      root.target = String(target || '_blank');
      root.rel = 'noopener noreferrer';
      if (toBoolean(download, false)) {
        root.download = String(fileName || '');
      }
    } else {
      root.type = 'button';
    }

    // Size 1 is the block's own rule; there is no --size-1 class to write, and
    // writing one left a class no sheet answers.
    root.classList.add('sf-download-file');
    if (normalizeSize(size) !== '1') root.classList.add(`sf-download-file--size-${normalizeSize(size)}`);

    if (!isDisabled) {
      root.classList.add('cursor-pointer', 'transition');
    } else {
      root.classList.add('disabled');
      root.setAttribute('aria-disabled', 'true');
      root.tabIndex = -1;
    }

    if (className) {
      root.classList.add(...String(className).split(' ').filter(Boolean));
    }

    const wrap = document.createElement('span');
    wrap.classList.add('sf-download-file__body', 'sf-download-file-wrap');

    const container = document.createElement('span');
    container.classList.add('sf-download-file__main', 'sf-download-file-container');

    const iconNode = document.createElement('i');
    iconNode.classList.add('sf-download-file__icon', 'sf-icon');
    iconNode.setAttribute('aria-hidden', 'true');
    iconNode.textContent = String(icon || 'download');

    const fileNameNode = document.createElement('span');
    fileNameNode.classList.add('sf-download-file__name', 'sf-download-file-file-name');
    fileNameNode.textContent = String(fileName || '');

    container.append(iconNode, fileNameNode);

    const fileSizeNode = document.createElement('span');
    fileSizeNode.classList.add('sf-download-file__size', 'sf-download-file-file-size');
    fileSizeNode.textContent = String(fileSize || '');

    wrap.append(container, fileSizeNode);
    root.append(wrap);

    this.href = String(href || '');
    this.download = toBoolean(download, false);
    this.fileName = String(fileName || '');
    this.fileSize = String(fileSize || '');
    this.disabled = isDisabled;
    this.fileSizeNode = fileSizeNode;
    this.template = root;

    this.applyLayoutUtilities(root, '.sf-download-file');
    this.applyLayoutUtilities(wrap, '.sf-download-file .sf-download-file-wrap');
  }

  init() {
    bindDownloadFile(this.template);
  }

  handleClick = (event) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.template?.tagName?.toLowerCase() === 'a') {
      this.template.dispatchEvent(
        new CustomEvent('sf-download-file:click', {
          bubbles: true,
          detail: {
            href: this.href,
            fileName: this.fileName,
            download: this.download,
          },
        }),
      );
      return;
    }

    if (this.href) {
      event.preventDefault();
      buildAnchorDownload(this.href, this.download ? this.fileName : '');
    }

    this.template?.dispatchEvent(
      new CustomEvent('sf-download-file:click', {
        bubbles: true,
        detail: {
          href: this.href,
          fileName: this.fileName,
          download: this.download,
        },
      }),
    );
  };

  destroyInternal() {
    unbindDownloadFile(this.template);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => initExistingDownloadFiles(),
      {
        once: true,
      },
    );
  } else {
    initExistingDownloadFiles();
  }
}

// A public bind, as the other bound components have: markup added by a script
// that the observer has not reached yet, or a root rebound after a change. The
// binders were exported for bundles only, so a page had none.
if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.DownloadFile = window.SF.DownloadFile || {};
  window.SF.DownloadFile.bind = bindDownloadFile;
  window.SF.DownloadFile.unbind = unbindDownloadFile;
  window.SF.DownloadFile.initAll = initExistingDownloadFiles;
}

export { bindDownloadFile, unbindDownloadFile, initExistingDownloadFiles };

registerComponent('DownloadFile', DownloadFile);
