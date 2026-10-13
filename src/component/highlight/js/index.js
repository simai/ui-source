import { initLineNumbers } from './line_numbers';
import { AVAILABLE_LANGUAGES, LANGUAGE_ALIASES } from './languages';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
// Every word this part says. A product adds a language with
// SF.language.register('sf-highlight', code, words); a ternary on «ru» allowed two
// and no more.
const HIGHLIGHT_TEXT = {
  en: {
    copy: 'Copy code',
    copied: 'Code copied',
  },
  ru: {
    copy: 'Копировать код',
    copied: 'Код скопирован',
  },
};


const CODE_SELECTOR = 'pre code';
const ROOT_SELECTOR = '.sf-highlight, .source';
const CHROME_MODES = new Set(['auto', 'none', 'static']);
const highlightedNodes = new WeakSet();
const sourceText = new WeakMap();
const plugins = [];
const supportedLanguages = new Set(AVAILABLE_LANGUAGES);
const languageAliases = { ...LANGUAGE_ALIASES };
let codeId = 0;

function normalizeLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase();
  return languageAliases[normalized] || normalized;
}

function requestedLanguage(block) {
  const className = [...block.classList].find((name) => /^(?:language|lang)-/.test(name));
  return String(block.dataset.lang || className?.replace(/^(?:language|lang)-/, '') || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally',
  'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
  'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'undefined', 'var', 'void', 'while', 'yield', 'echo', 'public',
  'private', 'protected', 'fn', 'def', 'pass', 'elif', 'fi', 'then', 'select',
  'insert', 'update', 'where', 'and', 'or', 'not', 'into', 'values',
]);

function tokenClass(token) {
  if (/^\/\//.test(token) || /^\/\*/.test(token) || /^#(?![0-9a-f]{3,8}\b)/i.test(token)) return 'comment';
  if (/^['"`]/.test(token)) return 'string';
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(token)) return 'number';
  if (KEYWORDS.has(token.toLowerCase())) return 'keyword';
  return '';
}

function highlightSource(source, language) {
  if (language === 'plaintext') return escapeHtml(source);
  const pattern = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|-?(?:\d+\.?\d*|\.\d+)|[A-Za-z_$][\w$-]*)/g;
  let output = '';
  let cursor = 0;
  for (const match of String(source).matchAll(pattern)) {
    output += escapeHtml(source.slice(cursor, match.index));
    const token = match[0];
    const kind = tokenClass(token);
    output += kind ? `<span class="hljs-${kind}">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = match.index + token.length;
  }
  return output + escapeHtml(source.slice(cursor));
}

const hljs = {
  componentName: 'hljs',
  addPlugin(plugin) { plugins.push(plugin); },
  getLanguage(language) { return supportedLanguages.has(normalizeLanguage(language)); },
  registerAliases(aliases, { languageName }) {
    aliases.forEach((alias) => { languageAliases[alias] = languageName; });
  },
  registerLanguage(language) { supportedLanguages.add(normalizeLanguage(language)); },
  highlight(source, { language = 'plaintext' } = {}) {
    const normalized = normalizeLanguage(language);
    return { language: normalized, relevance: 0, value: highlightSource(source, normalized) };
  },
  highlightElement(element) {
    const language = normalizeLanguage(requestedLanguage(element) || 'plaintext');
    plugins.forEach((plugin) => plugin['before:highlightElement']?.({ el: element }));
    const result = this.highlight(element.textContent, { language: this.getLanguage(language) ? language : 'plaintext' });
    element.innerHTML = result.value;
    element.classList.add('hljs');
    element.dataset.highlighted = 'yes';
    plugins.forEach((plugin) => plugin['after:highlightElement']?.({ el: element, result }));
    return result;
  },
};
initLineNumbers(hljs);
if (typeof window !== 'undefined') window.hljs = hljs;

function chromeMode(block, root) {
  const value = block.dataset.chrome || root?.dataset.chrome || root?.dataset.sfHighlightChrome || 'auto';
  return CHROME_MODES.has(value) ? value : 'auto';
}

function lineNumbersEnabled(block) {
  if (block.hasAttribute('data-lines')) return block.dataset.lines !== 'false';
  return block.dataset.lineNumbers === 'true';
}

function ensureCodeId(block) {
  if (block.id) return block.id;
  do { codeId += 1; block.id = `sf-highlight-code-${codeId}`; }
  while (block.ownerDocument.getElementById(block.id) !== block);
  return block.id;
}

function localizedCopyStrings(block, root) {
  // The node the words are resolved from is `block`, not the host: a block
  // inside a region that names its own language takes that language. The host
  // is still asked first for a word it was given by hand.
  return {
    label: block.dataset.copyLabel || root?.dataset.copyLabel || pageText(HIGHLIGHT_TEXT, 'copy', block, 'sf-highlight'),
    success: block.dataset.copySuccess || root?.dataset.copySuccess || pageText(HIGHLIGHT_TEXT, 'copied', block, 'sf-highlight'),
  };
}

function ensureCopyButton(block, root, head) {
  let button = head.querySelector(':scope > .sf-highlight__copy');
  if (button) return button;
  const strings = localizedCopyStrings(block, root);
  const codeElementId = ensureCodeId(block);
  let status = head.querySelector(':scope > .sf-highlight__status');
  if (!status) {
    status = block.ownerDocument.createElement('span');
    status.id = `${codeElementId}-copy-status`;
    status.className = 'sf-highlight__status sr-only';
    head.append(status);
  }
  button = block.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'sf-highlight__copy sf-clipboard sf-icon-button sf-icon-button--size-1/2 sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface flex items-cross-center';
  button.dataset.target = `#${codeElementId}`;
  button.dataset.status = `#${status.id}`;
  button.dataset.success = strings.success;
  button.setAttribute('aria-label', strings.label);
  const icon = block.ownerDocument.createElement('span');
  icon.className = 'sf-icon';
  icon.textContent = 'content_copy';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  head.append(button);
  return button;
}

function ensureStructure(block) {
  let root = block.closest(ROOT_SELECTOR);
  const mode = chromeMode(block, root);
  const pre = block.closest('pre');
  if (!pre) return { root: null, mode };
  if (!root) {
    root = block.ownerDocument.createElement('div');
    root.className = 'sf-highlight source';
    pre.replaceWith(root);
    root.append(pre);
  } else root.classList.add('sf-highlight');
  root.classList.add('sf-code-surface');
  pre.classList.add('sf-code-surface__scroll');
  if (mode !== 'static') {
    let wrap = pre.closest('.sf-highlight__wrap, .sf--highlight-wrap');
    if (!wrap || wrap.closest(ROOT_SELECTOR) !== root) {
      wrap = block.ownerDocument.createElement('div');
      wrap.className = 'sf-highlight__wrap sf--highlight-wrap sf-scrollbar';
      wrap.dataset.sfScrollbar = 'overlay';
      wrap.dataset.sfScrollbarAxis = 'horizontal';
      pre.replaceWith(wrap);
      wrap.append(pre);
    }
    pre.classList.add('sf-scrollbar__viewport');
  }
  let head = null;
  if (mode === 'auto') {
    head = root.querySelector(':scope > .sf-highlight__head, :scope > .sf--highlight-head');
    if (!head) {
      head = block.ownerDocument.createElement('div');
      head.className = 'sf-highlight__head sf--highlight-head flex content-main-between items-center border-outline-variant bg-surface-overlay';
      root.prepend(head);
    }
  }
  return { head, mode, root };
}

function updateChrome(block, result) {
  const { head, mode, root } = ensureStructure(block);
  if (!root) return;
  root.dataset.highlightState = block.dataset.highlightState;
  root.classList.add('init');
  if (mode !== 'auto' || !head) return;
  let language = head.querySelector(':scope > .sf-highlight__language');
  if (!language) {
    language = block.ownerDocument.createElement('span');
    language.className = 'sf-highlight__language sf-text-1/2 weight-5';
    head.prepend(language);
  }
  language.textContent = block.dataset.requestedLang || result.language || 'text';
  ensureCopyButton(block, root, head);
}

hljs.addPlugin({
  'before:highlightElement': ({ el }) => ensureStructure(el),
  'after:highlightElement': ({ el, result }) => {
    updateChrome(el, result);
    if (lineNumbersEnabled(el)) hljs.lineNumbersBlock(el);
  },
});

function codeBlocksIn(root = document) {
  const blocks = [];
  if (root instanceof Element && root.matches(CODE_SELECTOR)) blocks.push(root);
  root.querySelectorAll?.(CODE_SELECTOR).forEach((block) => blocks.push(block));
  return blocks;
}

async function highlightBlock(block) {
  if (!(block instanceof HTMLElement)) return false;
  if (block.dataset.highlighted || highlightedNodes.has(block)) return true;
  block.textContent = block.textContent.trim();
  sourceText.set(block, block.textContent);
  const requested = requestedLanguage(block);
  const language = normalizeLanguage(requested || 'plaintext');
  block.dataset.requestedLang = requested;
  block.dataset.highlightState = hljs.getLanguage(language) ? 'ready' : 'unsupported';
  if (!hljs.getLanguage(language)) block.classList.add('language-plaintext');
  hljs.highlightElement(block);
  block.closest(ROOT_SELECTOR)?.setAttribute('data-highlight-state', block.dataset.highlightState);
  highlightedNodes.add(block);
  return true;
}

async function highlightAllLazy(root = document) {
  const blocks = codeBlocksIn(root);
  for (const block of blocks) await highlightBlock(block);
  return blocks;
}

async function refresh(target, nextSource) {
  const blocks = codeBlocksIn(target instanceof Element ? target : document);
  for (const block of blocks) {
    block.textContent = typeof nextSource === 'string' ? nextSource : sourceText.get(block) || block.textContent;
    delete block.dataset.highlighted;
    highlightedNodes.delete(block);
    await highlightBlock(block);
  }
  return blocks;
}

if (typeof document !== 'undefined') {
  highlightAllLazy();
  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) =>
    mutation.addedNodes.forEach((node) => { if (node instanceof Element) highlightAllLazy(node); })));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Highlight = { highlight: highlightBlock, refresh };
}
registerComponent('hljs', hljs);

export { highlightAllLazy, highlightBlock, lineNumbersEnabled, normalizeLanguage, refresh, requestedLanguage };
export default hljs;
