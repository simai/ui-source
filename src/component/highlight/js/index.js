import { initLineNumbers } from './line_numbers';
import { AVAILABLE_LANGUAGES, LANGUAGE_ALIASES } from './languages';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';
// Every word this part says. A product adds a language with
// SF.language.register('sf-highlight', code, words); a ternary on «ru» allowed two
// and no more.
const HIGHLIGHT_TEXT = LANG_WORDS;


const CODE_SELECTOR = 'pre code';
const ROOT_SELECTOR = '.sf-highlight, .source';
const CHROME_MODES = new Set(['auto', 'none', 'static']);
const highlightedNodes = new WeakSet();
// The text a block was given (its markers included), for refresh, and the
// text it shows, for telling an edit from its own drawing.
const sourceText = new WeakMap();
const drawnText = new WeakMap();
// Each line's marks (diff, marked, focus, terminal prompt and output).
const lineMarks = new WeakMap();
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

// ---- Line marks (owner decisions C255-C258) ----
// An author marks lines two ways (C258): attributes of the block, for ranges
// and for code that cannot be edited (data-mark, data-focus, data-add,
// data-remove, each a list such as "2,4-5"; data-frame="terminal"), and
// Shiki's markers at the end of a line, as Docara and VitePress write them:
// a comment holding [!code ++], [!code --], [!code highlight] or
// [!code focus], with an optional :N for N lines from this one
// ([!code highlight:3]). The marker
// and its comment leave the text before it is coloured, shown or copied;
// [!!code ...] shows a marker as text.
const LINE_MARKER = /[ \t]*(?:\/\/|\/\*|#|<!--|--|;|%|')[ \t]*\[!code[ \t]+(\+\+|--|highlight|hl|focus)(?::(\d+))?\][ \t]*(?:\*\/|-->)?[ \t]*$/u;
// Languages whose text shows Markdown: a marker there is text to show.
const LITERAL_LANGUAGES = new Set(['markdown', 'md']);

function blockOption(block, name) {
  const holders = [block, block.closest('pre'), block.closest(ROOT_SELECTOR)];
  for (const holder of holders) {
    const value = holder?.getAttribute(name);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

// "2,4-6" (commas or spaces) as line indexes from 0; a part that is not a
// number or a range, or a line the block does not have, is left out.
function lineRanges(value, count) {
  const indexes = new Set();
  String(value || '').split(/[\s,]+/u).forEach((part) => {
    const match = /^(\d+)(?:-(\d+))?$/u.exec(part);
    if (!match) return;
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    for (let line = Math.max(1, from); line <= Math.min(to, count); line++) indexes.add(line - 1);
  });
  return indexes;
}

function terminalFrame(block) {
  return blockOption(block, 'data-frame') === 'terminal';
}

// The text to colour and each line's marks.
function readLineMarks(block, source, language) {
  const texts = String(source).split(/\r?\n/u);
  const lines = texts.map(() => ({diff: '', mark: false, focus: false, prompt: false, output: false, skip: false}));
  const apply = (index, kind, count = 1) => {
    for (let line = index; line < Math.min(index + Math.max(1, count), lines.length); line++) {
      if (kind === '++') lines[line].diff = 'add';
      else if (kind === '--') lines[line].diff = 'remove';
      else if (kind === 'focus') lines[line].focus = true;
      else lines[line].mark = true;
    }
  };
  if (!LITERAL_LANGUAGES.has(language)) {
    texts.forEach((text, index) => {
      const match = LINE_MARKER.exec(text);
      if (match) {
        texts[index] = text.slice(0, match.index);
        apply(index, match[1], match[2] ? Number(match[2]) : 1);
      }
      texts[index] = texts[index].replaceAll('[!!code ', '[!code ');
    });
  }
  lineRanges(blockOption(block, 'data-mark'), lines.length).forEach((index) => apply(index, 'highlight'));
  lineRanges(blockOption(block, 'data-focus'), lines.length).forEach((index) => apply(index, 'focus'));
  lineRanges(blockOption(block, 'data-add'), lines.length).forEach((index) => apply(index, '++'));
  lineRanges(blockOption(block, 'data-remove'), lines.length).forEach((index) => apply(index, '--'));
  // A terminal (C257): a line that starts with "$ " is a command, the prompt
  // drawn by the stylesheet; the others are its output, which copy leaves
  // behind. A terminal without a prompt is all commands.
  const terminal = terminalFrame(block);
  if (terminal && texts.some((text) => /^\$(?: |$)/u.test(text))) {
    texts.forEach((text, index) => {
      if (/^\$(?: |$)/u.test(text)) {
        lines[index].prompt = true;
        texts[index] = text.slice(2);
      } else lines[index].output = true;
    });
  }
  lines.forEach((line) => { line.skip = line.diff === 'remove' || line.output; });
  const marked = lines.some((line) => line.diff || line.mark || line.focus || line.prompt || line.output);
  return {text: texts.join('\n'), lines, marked, terminal};
}

function chromeMode(block, root) {
  const value = block.dataset.chrome || root?.dataset.chrome || root?.dataset.sfHighlightChrome || 'auto';
  return CHROME_MODES.has(value) ? value : 'auto';
}

// data-lines on the code, its pre or the root turns the numbers on;
// "false" turns them off, and a number is the first line's number
// (data-lines="40": a file region from line 40, 1.10.0). The historical
// data-line-numbers="true" still turns them on.
function lineNumbersEnabled(block) {
  const lines = blockOption(block, 'data-lines');
  if (lines !== null) return lines !== 'false';
  return blockOption(block, 'data-line-numbers') === 'true';
}

// The first line's number: data-start, else a number in data-lines, else the
// historical data-ln-start-from, else 1; read from the code, its pre or the
// root.
function lineStart(block) {
  for (const value of [blockOption(block, 'data-start'), blockOption(block, 'data-lines'), blockOption(block, 'data-ln-start-from')]) {
    if (/^\s*\d+\s*$/u.test(value ?? '')) return Number.parseInt(value, 10);
  }
  return 1;
}

// An id no other element holds: not in the document, and not in the tree the
// block stands in when it is not placed yet. The block may be highlighted
// before its markup is placed (sf-chat-message enhances an answer's code
// before it puts the answer on the page): the loop asked the document for the
// block itself, which a detached block never is, and never ended (100 % CPU,
// ui-control evidence 2026-11-18-pro-over-1ed6). It now asks whether the id is
// free, which ends for a detached block as for a placed one.
function idTaken(block, id) {
  const placed = block.ownerDocument?.getElementById?.(id);
  if (placed && placed !== block) return true;
  const root = block.getRootNode?.();
  if (!root || root === block.ownerDocument) return false;
  const local = typeof root.getElementById === 'function'
    ? root.getElementById(id)
    : (root.id === id ? root : root.querySelector?.(`[id="${id}"]`));
  return Boolean(local && local !== block);
}

function ensureCodeId(block) {
  if (block.id) return block.id;
  let id;
  do { codeId += 1; id = `sf-highlight-code-${codeId}`; }
  while (idTaken(block, id));
  block.id = id;
  return id;
}

// A head button's name, shown as the Framework tooltip on hover and keyboard
// focus (C48, C217: an icon without words says what it does). The class
// markup of the tooltip component, as the clipboard component writes it for
// an icon-only copy; a button that already names a tooltip keeps it, and the
// clipboard sees this one and adds none.
function nameTooltip(button, text, base) {
  if (!text || button.hasAttribute('data-tooltip')) return;
  const doc = button.ownerDocument;
  const surface = doc.createElement('span');
  surface.className = 'sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-highlight__name';
  surface.hidden = true;
  let id = `${base}-${button.classList.contains('sf-highlight__copy') ? 'copy' : 'wrap'}-name`;
  for (let index = 2; doc.getElementById(id); index++) id = id.replace(/(?:-\d+)?$/u, `-${index}`);
  surface.id = id;
  const content = doc.createElement('span');
  content.className = 'sf-tooltip-content';
  const words = doc.createElement('span');
  words.className = 'sf-tooltip-text';
  words.textContent = text;
  content.append(words);
  surface.append(content);
  button.after(surface);
  button.setAttribute('data-tooltip', id);
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
  // The plain look (owner decision C201): copy is an icon inside the block,
  // so it has no plate in any state; only its ink moves.
  button.className = 'sf-highlight__copy sf-icon-button sf-icon-button--size-1/2 sf-icon-button--icon sf-icon-button--plain sf-icon-button--on-surface flex items-cross-center';
  // The clipboard component's attribute route (decision C48): the block's
  // code is copied whole, without its line numbers; the class sf-clipboard
  // and data-target it used are deprecated until 2027-01-01.
  button.dataset.sfCopyTarget = `#${codeElementId}`;
  button.dataset.status = `#${status.id}`;
  button.dataset.success = strings.success;
  button.setAttribute('aria-label', strings.label);
  const icon = block.ownerDocument.createElement('span');
  icon.className = 'sf-icon';
  icon.textContent = 'content_copy';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  head.append(button);
  nameTooltip(button, strings.label, codeElementId);
  return button;
}

// Line wrapping, beside copy: a toggle that wraps long lines instead of
// scrolling them sideways (owner request through the effects catalogue,
// 2026-10-29; projects put a switch over their code blocks for it). The page
// sets the starting state with data-wrap="true" on the block's root, or
// data-wrap-control="none" to leave the button out; the button says its state
// with aria-pressed.
function ensureWrapButton(block, root, head) {
  if (root.dataset.wrapControl === 'none') return null;
  let button = head.querySelector(':scope > .sf-highlight__wrap-toggle');
  if (button) return button;
  const wrapped = root.dataset.wrap === 'true';
  root.classList.toggle('sf-highlight--wrap', wrapped);
  button = block.ownerDocument.createElement('button');
  button.type = 'button';
  // Plain as copy beside it (owner decision C232): no plate in any state;
  // pressed, its glyph is primary and filled -- two cues, not colour alone
  // (C12; the icon buttons fill a pressed toggle's glyph).
  button.className = 'sf-highlight__wrap-toggle sf-icon-button sf-icon-button--size-1/2 sf-icon-button--icon sf-icon-button--plain sf-icon-button--on-surface flex items-cross-center';
  const wrapLabel = root.dataset.wrapLabel || pageText(HIGHLIGHT_TEXT, 'wrap', block, 'sf-highlight');
  button.setAttribute('aria-label', wrapLabel);
  button.setAttribute('aria-pressed', String(wrapped));
  button.setAttribute('aria-controls', ensureCodeId(block));
  const icon = block.ownerDocument.createElement('span');
  icon.className = 'sf-icon';
  icon.textContent = 'wrap_text';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  button.addEventListener('click', () => {
    const next = !root.classList.contains('sf-highlight--wrap');
    root.classList.toggle('sf-highlight--wrap', next);
    root.dataset.wrap = String(next);
    button.setAttribute('aria-pressed', String(next));
  });
  const copy = head.querySelector(':scope > .sf-highlight__copy');
  head.insertBefore(button, copy);
  nameTooltip(button, wrapLabel, button.getAttribute('aria-controls'));
  return button;
}

function ensureStructure(block) {
  let root = block.closest(ROOT_SELECTOR);
  const mode = chromeMode(block, root);
  const pre = block.closest('pre');
  if (!pre) return { root: null, mode };
  if (!root) {
    root = block.ownerDocument.createElement('div');
    // Only the canonical class. The generated root carried the compatibility
    // alias `source` too, and that word is also the Doc component's source
    // block: the Loader fetched component/doc for it, and the Doc rule painted
    // the code surface an inverse colour, so in the dark theme plain code was
    // invisible (ui-chat). An authored `.source` root is still read as a root.
    root.className = 'sf-highlight';
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
      // No fill of its own: the head stands on the code surface the root
      // already paints (.sf-code-surface, --sf-surface-container), so it reads
      // as the block's surface. It once carried bg-surface-overlay, whose
      // backdrop-filter (blur 64px) blurred nothing here but gave every code
      // head a compositing layer, and sticky page headers blanked for a frame
      // while scrolling past code blocks (Docara, 2026-11-07). A second
      // bg-surface-container would double the translucent fill.
      // No layout utilities either: the head's own rule lays it out (the
      // language at the start, the controls at the end, one axis), so a page
      // without the utility sheet draws the same head (simai/ui-source#31).
      head.className = 'sf-highlight__head sf--highlight-head';
      root.prepend(head);
    }
  }
  return { head, mode, root };
}

// A name cut with an ellipsis (a long data-title, C285) has its whole text as
// the label's title, as a cut crumb of sf-breadcrumbs; a name that fits again
// loses it. A title the page wrote on the label itself is left alone.
const watchedNames = new WeakSet();

function markCutName(language) {
  if (language.hasAttribute('title') && !('sfHighlightCut' in language.dataset)) return;
  const text = language.querySelector(':scope > .sf-highlight__language-text') || language;
  const cut = text.scrollWidth > text.clientWidth + 1;
  if (cut) {
    language.setAttribute('title', text.textContent.trim());
    language.dataset.sfHighlightCut = '';
  } else if ('sfHighlightCut' in language.dataset) {
    language.removeAttribute('title');
    delete language.dataset.sfHighlightCut;
  }
}

function watchName(language) {
  const View = language.ownerDocument.defaultView;
  if (!View?.ResizeObserver || watchedNames.has(language)) return;
  watchedNames.add(language);
  new View.ResizeObserver(() => markCutName(language)).observe(language);
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
  // A terminal (C257) names itself in the head: its icon and the word, in
  // the language of the block; the frame follows the site theme.
  const terminal = lineMarks.get(block)?.terminal === true;
  root.classList.toggle('sf-highlight--terminal', terminal);
  // A file name (owner decision C285): data-title on the code, its pre or the
  // root stands where the language name is, in the same head text; the
  // language is not shown then. A terminal keeps its icon and shows the name
  // in place of its word.
  const title = String(blockOption(block, 'data-title') ?? '').trim();
  if (terminal) {
    const icon = block.ownerDocument.createElement('span');
    // Icon step 2: 20 on a desktop, 16 on a phone, the code's line height.
    icon.className = 'sf-icon sf-icon--size-2';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'terminal';
    const name = block.ownerDocument.createElement('span');
    name.className = 'sf-highlight__language-text';
    name.textContent = title || pageText(HIGHLIGHT_TEXT, 'terminal', block, 'sf-highlight');
    language.replaceChildren(icon, name);
  } else language.textContent = title || block.dataset.requestedLang || result.language || 'text';
  markCutName(language);
  watchName(language);
  ensureCopyButton(block, root, head);
  ensureWrapButton(block, root, head);
}

hljs.addPlugin({
  'before:highlightElement': ({ el }) => ensureStructure(el),
  'after:highlightElement': ({ el, result }) => {
    updateChrome(el, result);
    const marks = lineMarks.get(el);
    const numbers = lineNumbersEnabled(el);
    if (numbers || marks?.marked) {
      hljs.lineNumbersBlock(el, {
        numbers,
        start: lineStart(el),
        lines: marks?.lines,
        words: {
          add: pageText(HIGHLIGHT_TEXT, 'added', el, 'sf-highlight'),
          remove: pageText(HIGHLIGHT_TEXT, 'removed', el, 'sf-highlight'),
        },
      });
    }
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
  // An empty block waits for its text: marked now, it was skipped for good
  // when a page filled it later (ui-effects site, a code block in a tab).
  if (block.textContent.trim() === '') return false;
  const source = block.textContent.trim();
  sourceText.set(block, source);
  const requested = requestedLanguage(block);
  const language = normalizeLanguage(requested || 'plaintext');
  const marks = readLineMarks(block, source, language);
  lineMarks.set(block, marks);
  drawnText.set(block, marks.text);
  block.textContent = marks.text;
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
  // A block is read when it arrives and again when its text changes: text
  // written into a block (textContent, a text node, characterData) adds no
  // element, so an observer of elements alone never saw it. A highlighted
  // block whose text is no longer the source it was drawn from is drawn
  // again; drawing writes that same text, so it does not come back here.
  const blockOf = (node) => (node instanceof Element ? node : node?.parentElement)?.closest?.(CODE_SELECTOR) ?? null;
  const textChanged = (block) => {
    if (!block) return;
    if (!block.dataset.highlighted && !highlightedNodes.has(block)) highlightBlock(block);
    else if (block.textContent.trim() !== (drawnText.get(block) ?? sourceText.get(block) ?? '').trim()) refresh(block, block.textContent.trim());
  };
  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
    if (mutation.type === 'characterData') return textChanged(blockOf(mutation.target));
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) highlightAllLazy(node);
      else if (node.nodeType === Node.TEXT_NODE) textChanged(blockOf(node));
    });
  }));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Highlight = { highlight: highlightBlock, refresh };
}
registerComponent('hljs', hljs);

export { highlightAllLazy, highlightBlock, lineNumbersEnabled, lineRanges, lineStart, normalizeLanguage, readLineMarks, refresh, requestedLanguage };
export default hljs;
