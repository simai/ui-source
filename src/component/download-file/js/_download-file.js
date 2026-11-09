import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import downloadFileUtility from '../json/download-file.utility.json';
import { formatFileSize } from '../../../core/js/format-file-size.js';
import { pageText } from '../../../core/js/page-language';

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

// A file is fetched where the person is (decision C25, 2026-11-09): in the
// same tab, as a download. A new tab is for a file opened to view, and the
// control that does that says so with its sign.
function buildAnchorDownload(href, filename = '') {
  if (!href) return;

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename || '';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

// The size in the page's language (decision C25; the core formatter, the one
// SF.format.fileSize is): «2,4 МБ» on a Russian page, «2.4 MB» on an English
// one. It printed «2.4MB» in English units on every page.
async function resolveRemoteFileSize(href, node = null) {
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

    return formatFileSize(Number(contentLength), { node });
  } catch {
    return '';
  }
}

// The words a screen reader hears after a link that opens a tab.
const NEW_TAB_WORDS = {
  ru: { 'new-tab': '(откроется в новой вкладке)' },
  en: { 'new-tab': '(opens in a new tab)' },
};

// A file's name when the markup gives none: the link's last part, decoded.
function nameFromHref(href) {
  const path = String(href || '').split(/[?#]/u)[0];
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (!last || /^(?:data|blob):/u.test(path)) return '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
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

  const resolvedSize = await resolveRemoteFileSize(href, root);
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

// `onActivate(detail)` takes the place of the class event: sf-download-file
// sends its own cancelable `sf-download-file-download` (standard 1.3.8 §8,
// vocabulary 1.1.5 §5.1), and the old `sf-download-file:click` follows it as a
// dated alias. Answering false cancels the download.
function bindDownloadFile(root, {onActivate} = {}) {
  if (!root || root.dataset[DOWNLOAD_FILE_BOUND_FLAG] === '1') return;

  const handleClick = (event) => {
    // A file being prepared (aria-busy) takes no second press: the first one
    // is on its way (decision C25).
    if (root.getAttribute('aria-busy') === 'true') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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

    if (typeof onActivate === 'function') {
      if (onActivate({ href, fileName, download }) === false) {
        event.preventDefault();
        return;
      }
    } else {
      emitDownloadFileClick(root, href, fileName, download);
    }

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

    // No invented file: an absent name is the link's own last part, an absent
    // size is asked of the file (one HEAD request). They were «File.pdf» and
    // «36MB» on any markup that left them out.
    const {
      size = '1',
      fileName = '',
      fileSize = '',
      fileType = '',
      icon = 'download',
      href = '',
      download = true,
      disabled = false,
      target = '',
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;
    const isDisabled = toBoolean(disabled, false);
    const canLink = Boolean(href) && !isDisabled;
    const root = document.createElement(canLink ? 'a' : 'button');

    if (this.id) {
      root.id = this.id;
    }

    const shownName = String(fileName || nameFromHref(href));
    // A file link downloads in the same tab (decision C25); target="_blank" is
    // a file opened to view, and the link says so: a sign after the name and
    // words for a screen reader.
    const opensTab = canLink && String(target || '') === '_blank';
    if (canLink) {
      root.href = String(href);
      if (opensTab) {
        root.target = '_blank';
        root.rel = 'noopener noreferrer';
      } else {
        if (target) root.target = String(target);
        if (toBoolean(download, true)) root.download = shownName;
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
    fileNameNode.textContent = shownName;
    // The name is one line cut with an ellipsis (component.download-file
    // 1.1.0): the title shows the whole of it.
    if (shownName) fileNameNode.title = shownName;

    container.append(iconNode, fileNameNode);
    if (opensTab) {
      const tabNode = document.createElement('i');
      tabNode.classList.add('sf-download-file__tab', 'sf-icon');
      tabNode.setAttribute('aria-hidden', 'true');
      tabNode.textContent = 'open_in_new';
      const tabWords = document.createElement('span');
      tabWords.classList.add('sf-download-file__tab-words');
      tabWords.textContent = pageText(NEW_TAB_WORDS, 'new-tab', document.documentElement, 'download-file');
      container.append(tabNode, tabWords);
    }

    // The type and the size are two facts (decision C25): «PDF · 2,4 МБ».
    const metaNode = document.createElement('span');
    metaNode.classList.add('sf-download-file__meta');
    if (fileType) {
      const fileTypeNode = document.createElement('span');
      fileTypeNode.classList.add('sf-download-file__type');
      fileTypeNode.textContent = String(fileType);
      metaNode.append(fileTypeNode);
    }
    const fileSizeNode = document.createElement('span');
    fileSizeNode.classList.add('sf-download-file__size', 'sf-download-file-file-size');
    fileSizeNode.textContent = String(fileSize || '');
    metaNode.append(fileSizeNode);

    wrap.append(container, metaNode);
    root.append(wrap);

    this.href = String(href || '');
    this.download = canLink && !opensTab && toBoolean(download, true);
    this.fileName = shownName;
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

export { bindDownloadFile, unbindDownloadFile, initExistingDownloadFiles, nameFromHref, buildAnchorDownload, NEW_TAB_WORDS };

registerComponent('DownloadFile', DownloadFile);
