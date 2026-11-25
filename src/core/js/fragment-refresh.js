// Block refresh (simai.interface-fragment 1.1.0, refreshable-block and
// block-refresh; Larena handoff ho-34086ca2988b, contract agreed 2026-11-23,
// room decision dec-b7452769b3b9). A block on the page -- a chart, a table, a
// counter -- refreshes itself when one of its own links or GET forms is used:
// the same address is asked for with the block header, and only the block is
// drawn again. The page, its other blocks and the shell stay. Without
// JavaScript every control is the ordinary link or form it is.
//
// The block is declared in markup; a package writes no code for it:
//
//   <section data-sf-fragment="env.load-history"
//            data-sf-fragment-keys="period scale"
//            data-sf-fragment-mode="data"
//            data-sf-fragment-contract="1">
//     <a href="?period=7d&scale=linear">Неделя</a>
//     <nav data-sf-fragment-history="replace"><a href="?period=7d&scale=log">Лог</a></nav>
//     <sf-chart-line data-sf-fragment-part="network"></sf-chart-line>
//     <script type="application/json" data-sf-fragment-data>{"parts": {...}}</script>
//   </section>
//
//   SF.FragmentRefresh.enable({scope: '/admin'});   // once, by the page shell
//
// Request: GET the control's address with X-SIMAI-Fragment: <id>,
// X-SIMAI-Fragment-Mode: data | html and X-SIMAI-Fragment-Contract: 1.
// Answer, both modes: 200, not redirected, the same X-SIMAI-Fragment and
// X-SIMAI-Fragment-Contract back. Data mode: JSON {fragment, contract, port,
// state, url, keys, parts, controls}. HTML mode: the block's outer element
// alone, one root with the same id.
//
// What the person sees when it goes wrong: a network failure, a timeout or a
// 5xx is the error state inside the block with a retry; a 4xx, a redirect or
// an answer that is not as declared loads the page in full, so the server
// shows its own sign-in, no-access or not-found page. A half-drawn block is
// never left. There is no timer refresh in contract 1.

import {SKELETON_DELAY_MS, isRunnableScript, loadAsset, noteAssets, parseMarkup} from './page-assets.js';
import {localeText} from './page-language.js';
// The words of the fragment boundary: «This block could not be shown».
import FRAGMENT_TEXT from './lang/fragment/index.mjs';

export const CONTRACT = 1;
export const HEADER = 'X-SIMAI-Fragment';
export const MODE_HEADER = 'X-SIMAI-Fragment-Mode';
export const CONTRACT_HEADER = 'X-SIMAI-Fragment-Contract';
export const TIMEOUT_MS = 10000;
export const MAX_DATA_BYTES = 262144;
export const MODES = Object.freeze(['data', 'html']);
export const STATES = Object.freeze(['populated', 'empty', 'no-access']);

const BLOCK = '[data-sf-fragment][data-sf-fragment-mode]';
const ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const URL_KEY = /^[a-z][a-z0-9_-]{0,63}$/u;
const PART = /^[a-z][a-z0-9-]{0,31}$/u;
const STANDARD = /^[a-z][a-z0-9.-]*$/u;
const VERSION = /^([0-9]+)\.[0-9]+\.[0-9]+$/u;
const ANSWER_FIELDS = ['fragment', 'contract', 'port', 'state', 'url', 'keys', 'parts', 'controls'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const words = (value) => String(value ?? '').trim().split(/\s+/u).filter(Boolean);

// ---- What can be read without a page: the declaration, the keys, the answer.

/** The block's declaration read from its attributes, with the problems found. */
export function readBlock(element) {
  const id = element.getAttribute('data-sf-fragment') ?? '';
  const keys = words(element.getAttribute('data-sf-fragment-keys'));
  const reads = words(element.getAttribute('data-sf-fragment-reads'));
  const mode = element.getAttribute('data-sf-fragment-mode') ?? '';
  const contract = Number(element.getAttribute('data-sf-fragment-contract') ?? CONTRACT);
  // The data port the page expects, optional: <standard>@<major>.
  const portMatch = /^([a-z][a-z0-9.-]*)@([0-9]+)$/u.exec(element.getAttribute('data-sf-fragment-port') ?? '');
  const port = portMatch ? {standard: portMatch[1], major: Number(portMatch[2])} : null;
  const problems = [];
  if (element.hasAttribute('data-sf-fragment-port') && !port) problems.push('port: <standard>@<major>');
  if (!ID.test(id)) problems.push('id: a dotted identity');
  if (keys.length > 16 || new Set(keys).size !== keys.length || !keys.every((key) => URL_KEY.test(key))) problems.push('keys: up to sixteen query keys');
  if (reads.length > 16 || !reads.every((key) => URL_KEY.test(key)) || reads.some((key) => keys.includes(key))) problems.push('reads: query keys the block does not own');
  if (!MODES.includes(mode)) problems.push('mode: data or html');
  if (contract !== CONTRACT) problems.push(`contract: ${CONTRACT}`);
  return {id, keys, reads, mode, contract, port, problems};
}

/**
 * The page's key map: one owner per key. A key two blocks declare makes both
 * blocks plain (their controls load the page in full); a block whose
 * declaration has problems, or whose id another block has, is plain too.
 */
export function keyMap(blocks) {
  const owners = new Map();
  const plain = new Map();
  const conflicts = [];
  const ids = new Map();
  for (const block of blocks) {
    if (block.problems.length) plain.set(block, block.problems.join('; '));
    ids.set(block.id, [...(ids.get(block.id) ?? []), block]);
  }
  for (const [id, same] of ids) {
    if (same.length < 2) continue;
    for (const block of same) plain.set(block, `id ${id} is not unique`);
    conflicts.push({kind: 'id', name: id, ids: [id]});
  }
  const claims = new Map();
  for (const block of blocks) for (const key of block.keys) claims.set(key, [...(claims.get(key) ?? []), block]);
  for (const [key, claimants] of claims) {
    if (claimants.length === 1) {
      owners.set(key, claimants[0]);
      continue;
    }
    for (const block of claimants) plain.set(block, `key ${key} has two owners`);
    conflicts.push({kind: 'key', name: key, ids: claimants.map((block) => block.id)});
  }
  for (const [key, block] of owners) if (plain.has(block)) owners.delete(key);
  return {owners, plain, conflicts};
}

const paramsOf = (url) => {
  const map = new Map();
  for (const [key, value] of url.searchParams) map.set(key, [...(map.get(key) ?? []), value]);
  return map;
};

/** The query keys whose values differ between two addresses (order of keys aside). */
export function changedKeys(from, to) {
  const left = paramsOf(new URL(from));
  const right = paramsOf(new URL(to));
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys].filter((key) => JSON.stringify(left.get(key) ?? []) !== JSON.stringify(right.get(key) ?? []));
}

/**
 * Whether a control's target is this block's to take: the same origin and
 * path as the page, and only keys the block owns differ -- or keys other
 * blocks own (`others`), whose values in a link printed before those blocks
 * refreshed may be stale; the page's values are kept for them (withKeys). A
 * key no block owns is the page's: a change there is not a block's. The hash
 * is ignored.
 */
export function ownedChange(target, here, keys, others = []) {
  const to = new URL(target, here);
  const from = new URL(here);
  if (to.origin !== from.origin || to.pathname !== from.pathname) return false;
  return changedKeys(from.href, to.href).every((key) => keys.includes(key) || others.includes(key));
}

/** The address with the block's keys taken from `source` and every other key, and the hash, kept from `here`. */
export function withKeys(here, source, keys) {
  const out = new URL(here);
  const from = new URL(source, here);
  const kept = [...out.searchParams].filter(([key]) => !keys.includes(key));
  const taken = [...from.searchParams].filter(([key]) => keys.includes(key));
  out.search = new URLSearchParams([...kept, ...taken]).toString();
  return out.href;
}

/** The problems of the confirming headers of an answer (both modes); empty when they hold. */
export function headerProblems(response, block, mode) {
  const problems = [];
  if (response.redirected) problems.push('redirected');
  if (response.status !== 200) problems.push(`status ${response.status}`);
  const header = (name) => response.headers.get(name);
  if (header(HEADER) !== block.id) problems.push('fragment-header');
  if (header(CONTRACT_HEADER) !== String(CONTRACT)) problems.push('contract-header');
  const type = header('content-type') ?? '';
  if (mode === 'data' ? !/^application\/json\b/iu.test(type) : !/^text\/html\b/iu.test(type)) problems.push('content-type');
  return problems;
}

/**
 * The problems of a data answer against its block; empty when it holds.
 * `parts` are the part names the block holds; `known(part, field)` says
 * whether a part takes a field (a property of the element or a data-*
 * attribute). A block that declares its port (data-sf-fragment-port) refuses
 * an answer of another port or of a major it does not know.
 */
export function dataAnswerProblems(answer, block, {parts = [], known = () => true, origin, path} = {}) {
  if (!isObject(answer)) return ['answer: not an object'];
  const problems = [];
  for (const key of Object.keys(answer)) if (!ANSWER_FIELDS.includes(key)) problems.push(`${key}: undeclared`);
  if (answer.fragment !== block.id) problems.push('fragment: another block');
  if (answer.contract !== CONTRACT) problems.push('contract: another version');
  if (answer.port !== undefined) {
    const match = isObject(answer.port) && STANDARD.test(answer.port.standard ?? '') && VERSION.exec(answer.port.version ?? '');
    if (!match) problems.push('port: {standard, version}');
    else if (block.port && (answer.port.standard !== block.port.standard || Number(match[1]) !== block.port.major)) problems.push('port: another standard or an unknown major');
  } else if (block.port) problems.push('port: the block expects one');
  if (!STATES.includes(answer.state)) problems.push('state: populated, empty or no-access');
  if (typeof answer.url !== 'string') problems.push('url: the applied address');
  else {
    try {
      const url = new URL(answer.url, origin ?? 'http://invalid.invalid');
      if ((origin && url.origin !== origin) || (path && url.pathname !== path)) problems.push('url: another page');
    } catch {
      problems.push('url: the applied address');
    }
  }
  if (answer.keys !== undefined && !(isObject(answer.keys) && Object.keys(answer.keys).every((key) => block.keys.includes(key)))) problems.push('keys: only the block\'s own');
  if (answer.controls !== undefined && !(isObject(answer.controls) && Object.keys(answer.controls).every((key) => block.keys.includes(key)))) problems.push('controls: only the block\'s own keys');
  if (answer.parts !== undefined) {
    if (!isObject(answer.parts)) problems.push('parts: an object');
    else {
      for (const [name, fields] of Object.entries(answer.parts)) {
        if (!PART.test(name) || !parts.includes(name)) { problems.push(`parts.${name}: not in the block`); continue; }
        if (!isObject(fields)) { problems.push(`parts.${name}: an object`); continue; }
        for (const field of Object.keys(fields)) if (!known(name, field)) problems.push(`parts.${name}.${field}: not an input of the part`);
      }
    }
  }
  return problems;
}

// ---- The runtime.

let config = null;
let lastHref = null;
let observer = null;
const live = new WeakMap();
const reported = new Set();

const document = () => globalThis.document;
const ownParts = (element) => [...element.querySelectorAll('[data-sf-fragment-part]')]
  .filter((part) => part.parentElement?.closest(BLOCK) === element);

function blocksOnPage() {
  return [...document().querySelectorAll(BLOCK)].map((element) => ({element, ...readBlock(element)}));
}

function emit(target, name, detail, cancelable = false) {
  return target.dispatchEvent(new CustomEvent(name, {bubbles: true, cancelable, detail}));
}

// The key map of the page as it stands now. A conflict is told once.
function pageMap() {
  const blocks = blocksOnPage();
  const map = keyMap(blocks);
  for (const conflict of map.conflicts) {
    const signature = `${conflict.kind}:${conflict.name}:${conflict.ids.join(',')}`;
    if (reported.has(signature)) continue;
    reported.add(signature);
    globalThis.console?.error?.(`SF.FragmentRefresh: ${conflict.kind} ${conflict.name} is declared by ${conflict.ids.join(' and ')}; ${conflict.kind === 'key' ? 'both blocks' : 'the blocks'} load the page in full`);
    emit(document(), 'sf-fragment-conflict', conflict);
  }
  // Keyed by element from here on: what a listener holds is the element.
  const plain = new Map([...map.plain].map(([block, reason]) => [block.element, reason]));
  for (const block of blocks) {
    if (plain.has(block.element)) block.element.setAttribute('data-sf-fragment-plain', '');
    else block.element.removeAttribute('data-sf-fragment-plain');
  }
  return {blocks, owners: map.owners, plain, conflicts: map.conflicts};
}

function state(element) {
  if (!live.has(element)) live.set(element, {controller: null, sequence: 0, skeleton: 0, timeout: 0, kept: null, last: null});
  return live.get(element);
}

function fullLoad(url, reason, block) {
  emit(block?.isConnected ? block : document(), 'sf-fragment-fallback', {fragment: block?.getAttribute('data-sf-fragment') ?? null, url, reason});
  if (config?.onFullLoad) {
    config.onFullLoad(url, reason);
    return;
  }
  if (url === globalThis.location.href) globalThis.location.reload();
  else globalThis.location.assign(url);
}

// Whether a part takes a field: a data-* attribute, or a property its element
// has (a Smart element's declared input), never a name it does not know.
// Markup is never set from data: innerHTML and its kin, handlers and methods
// are refused whatever the element has.
const REFUSED_FIELDS = new Set(['innerHTML', 'outerHTML', 'innerText', 'outerText', 'srcdoc']);
function knownField(part, field) {
  if (/^data-[a-z][a-z0-9-]*$/u.test(field)) return true;
  if (!part || typeof field !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/u.test(field)) return false;
  if (REFUSED_FIELDS.has(field) || /^on/u.test(field)) return false;
  return field in part && typeof part[field] !== 'function';
}

// A part that is a custom element not yet defined has no inputs to check or
// set: wait for its definition (a value set before the upgrade would shadow
// the element's own property), at most the block's time limit.
function partsReady(parts) {
  const waiting = parts
    .filter((part) => part.localName.includes('-') && !globalThis.customElements?.get(part.localName))
    .map((part) => globalThis.customElements.whenDefined(part.localName));
  if (!waiting.length) return Promise.resolve();
  return Promise.race([Promise.all(waiting), new Promise((resolve) => setTimeout(resolve, config?.timeoutMs ?? TIMEOUT_MS))]);
}

function applyFields(part, fields) {
  for (const [field, value] of Object.entries(fields)) {
    if (field.startsWith('data-')) {
      if (value === null || value === false) part.removeAttribute(field);
      else part.setAttribute(field, String(value));
    } else {
      part[field] = value;
    }
  }
}

// The keys a link of a data block sets itself: those named by
// data-sf-fragment-sets on it or its group, else those the links of its group
// (nav, role=group, fieldset, a history group) differ in. A link alone, or a
// group whose links differ in nothing, sets every key it names. Pure: takes
// the link's own keys and its group's links as addresses.
export function linkSets(keys, href, groupHrefs, named = null) {
  if (named) return named.filter((key) => keys.includes(key));
  const own = (address) => new URL(address, 'http://invalid.invalid').searchParams;
  const mine = own(href);
  const named2 = keys.filter((key) => mine.has(key));
  if (groupHrefs.length < 2) return named2;
  const varying = named2.filter((key) => new Set(groupHrefs.map((address) => own(address).get(key))).size > 1);
  return varying.length ? varying : named2;
}

/** A link's address with every own key it does not set taken from the applied values. */
export function syncedHref(href, keys, sets, applied) {
  const url = new URL(href, 'http://invalid.invalid');
  for (const key of keys) {
    if (sets.includes(key) || !url.searchParams.has(key)) continue;
    // A key the applied address does not name (a default the page did not
    // write) keeps the link's own value.
    if (applied.has(key)) url.searchParams.set(key, applied.get(key));
  }
  return `${url.search}${url.hash}` || '?';
}

const GROUP = 'nav, [role="group"], fieldset, [data-sf-fragment-history]';

// A data block's links are not drawn again by the host: after each answer
// their other own keys take the applied values, so a scale link keeps the
// period just chosen. A link of the block keeps its path; only the query moves.
function syncLinks(element, address, echoed = {}) {
  const keys = readBlock(element).keys;
  const applied = new URL(address).searchParams;
  // The keys the host says it applied stand for the ones the address leaves out.
  for (const [key, value] of Object.entries(echoed)) if (keys.includes(key) && !applied.has(key)) applied.set(key, String(value));
  const links = [...element.querySelectorAll('a[href]')].filter((link) => link.closest(BLOCK) === element);
  const plans = links.map((link) => {
    const href = link.getAttribute('href');
    const named = link.closest('[data-sf-fragment-sets]');
    const group = link.closest(GROUP);
    const inGroup = group && element.contains(group) && group !== element
      ? links.filter((other) => group.contains(other)).map((other) => other.getAttribute('href'))
      : [href];
    const sets = linkSets(keys, href, inGroup, named && element.contains(named) ? words(named.getAttribute('data-sf-fragment-sets')) : null);
    return {link, href, sets};
  });
  for (const {link, href, sets} of plans) {
    const url = new URL(href, globalThis.location.href);
    if (url.origin !== globalThis.location.origin || url.pathname !== globalThis.location.pathname) continue;
    const next = syncedHref(href.startsWith('?') || href.startsWith('#') ? href : `${url.search}${url.hash}`, keys, sets, applied);
    const kept = href.startsWith('?') || href.startsWith('#') ? next : `${url.pathname}${next === '?' ? '' : next}`;
    if (kept !== href) link.setAttribute('href', kept);
  }
}

// The data answer drawn in one step, after the whole answer was checked.
function applyData(element, answer, address = globalThis.location.href) {
  const parts = new Map(ownParts(element).map((part) => [part.getAttribute('data-sf-fragment-part'), part]));
  for (const [name, part] of parts) {
    const fields = answer.parts?.[name];
    if (fields) applyFields(part, fields);
    // The block's state reaches a part that does not say its own.
    if (fields && 'data-state' in fields) continue;
    if (answer.state !== 'populated') part.setAttribute('data-state', answer.state);
    else if (['loading', 'empty', 'no-access'].includes(part.getAttribute('data-state'))) part.removeAttribute('data-state');
  }
  if (answer.state === 'populated') element.removeAttribute('data-sf-fragment-state');
  else element.setAttribute('data-sf-fragment-state', answer.state);
  syncLinks(element, address, answer.keys ?? {});
  moveCurrent(element, {...(answer.keys ?? {}), ...(answer.controls ?? {})});
}

// aria-current moves to the links whose own keys equal the applied ones.
function moveCurrent(element, values) {
  const keys = readBlock(element).keys;
  if (!Object.keys(values).length) return;
  for (const link of element.querySelectorAll('a[href]')) {
    if (link.closest(BLOCK) !== element) continue;
    const url = new URL(link.href, globalThis.location.href);
    const own = keys.filter((key) => url.searchParams.has(key) && key in values);
    if (!own.length) continue;
    if (own.every((key) => url.searchParams.get(key) === String(values[key]))) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

function readIsland(element) {
  const island = [...element.querySelectorAll('script[data-sf-fragment-data]')].find((node) => node.closest(BLOCK) === element);
  if (!island || isRunnableScript(island)) return null;
  try {
    return JSON.parse(island.textContent ?? '');
  } catch {
    return null;
  }
}

// The first data of a data block, drawn when it comes onto the page: the
// island holds the same JSON a refresh answers, without the envelope's url.
async function drawIsland(element) {
  const block = readBlock(element);
  if (block.mode !== 'data' || block.problems.length) return;
  const data = readIsland(element);
  if (!isObject(data)) return;
  const answer = {fragment: block.id, contract: CONTRACT, state: 'populated', url: globalThis.location.pathname, ...data};
  const parts = ownParts(element);
  await partsReady(parts);
  if (!element.isConnected) return;
  const names = parts.map((part) => part.getAttribute('data-sf-fragment-part'));
  // The island is the page's own markup: it need not repeat the port; one it names is checked.
  const declared = data.port === undefined ? {...block, port: null} : block;
  const problems = dataAnswerProblems(answer, declared, {parts: names, known: (name, field) => knownField(parts.find((part) => part.getAttribute('data-sf-fragment-part') === name), field)});
  if (problems.length) {
    globalThis.console?.error?.(`SF.FragmentRefresh: the first data of ${block.id} is not as declared (${problems.join('; ')})`);
    return;
  }
  applyData(element, answer);
}

function startSkeleton(element, mode, mine) {
  const own = state(element);
  clearTimeout(own.skeleton);
  own.skeleton = setTimeout(() => {
    if (mine !== own.sequence || !element.isConnected) return;
    // The block keeps its height while it waits: nothing below it moves.
    element.style.minBlockSize = `${element.getBoundingClientRect().height}px`;
    element.setAttribute('aria-busy', 'true');
    element.setAttribute('data-sf-fragment-loading', mode);
    if (mode === 'data') for (const part of ownParts(element)) if (!part.hasAttribute('data-state')) part.setAttribute('data-state', 'loading');
  }, SKELETON_DELAY_MS);
}

function stopSkeleton(element) {
  const own = state(element);
  clearTimeout(own.skeleton);
  clearTimeout(own.timeout);
  if (!element.hasAttribute('data-sf-fragment-loading')) return;
  element.style.minBlockSize = '';
  if (!element.getAttribute('style')) element.removeAttribute('style');
  element.removeAttribute('aria-busy');
  element.removeAttribute('data-sf-fragment-loading');
  for (const part of ownParts(element)) if (part.getAttribute('data-state') === 'loading') part.removeAttribute('data-state');
}

// The error state inside the block, with a retry. The block's own content is
// kept aside and comes back for the retry, so its controls stay as they were.
function showError(element, url, reason, options) {
  const own = state(element);
  if (!own.kept) {
    own.kept = document().createDocumentFragment();
    own.kept.append(...element.childNodes);
  }
  const lang = element.closest('[lang]')?.getAttribute('lang') || 'en';
  const error = document().createElement('sf-empty-state');
  error.setAttribute('kind', 'error');
  error.setAttribute('heading', localeText(FRAGMENT_TEXT, 'heading', lang, 'sf-fragment'));
  error.setAttribute('data-sf-fragment-error', '');
  const onAction = (event) => {
    if (event.detail?.id !== 'retry') return;
    event.stopPropagation();
    error.removeEventListener('sf-empty-state-action', onAction);
    restore(element);
    refresh(element, url, {...options, retry: true});
  };
  error.addEventListener('sf-empty-state-action', onAction);
  element.replaceChildren(error);
  element.setAttribute('data-sf-fragment-state', 'error');
  emit(element, 'sf-fragment-error', {fragment: element.getAttribute('data-sf-fragment'), url, reason});
}

function restore(element) {
  const own = state(element);
  if (!own.kept) return;
  element.replaceChildren(own.kept);
  own.kept = null;
  element.removeAttribute('data-sf-fragment-state');
}

function writeHistory(address, how) {
  if (address === globalThis.location.href) {
    lastHref = globalThis.location.href;
    return;
  }
  // Nothing else writes (Back, Forward, a linked block) and the host applied
  // another address than the entry's: the entry is corrected in place.
  if (how === 'none') how = 'replace';
  const current = globalThis.history.state;
  if (how === 'replace') {
    // A product's own fields in the entry are kept as they are.
    globalThis.history.replaceState({...(isObject(current) ? current : {}), sfFragment: true}, '', address);
  } else {
    // The entry left keeps the scroll, so region navigation can bring it back.
    if (isObject(current) && (current.sfRegion || current.sfFragment)) {
      globalThis.history.replaceState({...current, scroll: globalThis.scrollY}, '');
    }
    const region = isObject(current) && current.sfRegion ? {sfRegion: true, scroll: globalThis.scrollY} : {};
    globalThis.history.pushState({...region, sfFragment: true}, '', address);
  }
  lastHref = globalThis.location.href;
}

/**
 * Refresh one block from `url` (the control's address). `history`: push,
 * replace or none. Resolves true when the block was drawn again.
 */
export async function refresh(element, url, {history = 'push', linked = true, retry = false} = {}) {
  if (!config || !element?.isConnected) return false;
  const block = readBlock(element);
  const map = pageMap();
  const target = new URL(url, globalThis.location.href).href;
  if (block.problems.length || map.plain.has(element)) {
    fullLoad(target, block.problems.length ? 'declaration' : 'conflict', element);
    return false;
  }
  if (!retry) restore(element);
  const allowed = emit(element, 'sf-fragment-refresh', {fragment: block.id, url: target, mode: block.mode}, true);
  if (!allowed) return false;
  const own = state(element);
  own.controller?.abort();
  const controller = new AbortController();
  own.controller = controller;
  const mine = ++own.sequence;
  const before = globalThis.location.href;
  startSkeleton(element, block.mode, mine);
  let timedOut = false;
  own.timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const stale = () => mine !== own.sequence || !element.isConnected;
  let response;
  let body;
  try {
    response = await globalThis.fetch(target, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        [HEADER]: block.id,
        [MODE_HEADER]: block.mode,
        [CONTRACT_HEADER]: String(CONTRACT),
        Accept: block.mode === 'data' ? 'application/json' : 'text/html',
      },
      signal: controller.signal,
    });
    if (!stale() && response.status >= 500) throw Object.assign(new Error(`status ${response.status}`), {contained: true});
    body = await response.text();
  } catch (error) {
    if (stale()) return false;
    stopSkeleton(element);
    if (error?.name === 'AbortError' && !timedOut) return false;
    showError(element, target, timedOut ? 'timeout' : (error?.contained ? error.message : 'network'), {history, linked});
    return false;
  }
  if (stale()) return false;
  clearTimeout(own.timeout);
  const fail = (reason) => {
    stopSkeleton(element);
    fullLoad(target, reason, element);
    return false;
  };
  const headers = headerProblems(response, block, block.mode);
  if (headers.length) return fail(headers.join('; '));
  const here = new URL(globalThis.location.href);
  let address;
  let draw;
  let drawn = element;
  if (block.mode === 'data') {
    if (body.length > MAX_DATA_BYTES) return fail('answer too large');
    let answer;
    try {
      answer = JSON.parse(body);
    } catch {
      return fail('invalid JSON');
    }
    const parts = ownParts(element);
    await partsReady(parts);
    if (stale()) return false;
    const names = parts.map((part) => part.getAttribute('data-sf-fragment-part'));
    const problems = dataAnswerProblems(answer, block, {
      parts: names,
      known: (name, field) => knownField(parts.find((part) => part.getAttribute('data-sf-fragment-part') === name), field),
      origin: here.origin,
      path: here.pathname,
    });
    if (problems.length) return fail(problems.join('; '));
    address = withKeys(here.href, new URL(answer.url, here).href, block.keys);
    draw = () => applyData(element, answer, address);
  } else {
    const parsed = parseMarkup(body);
    const roots = [...parsed.content.childNodes].filter((node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim()));
    const next = roots.length === 1 && roots[0].nodeType === 1 ? roots[0] : null;
    if (!next) return fail('not one root');
    if (next.getAttribute('data-sf-fragment') !== block.id || next.getAttribute('data-sf-fragment-mode') !== 'html') return fail('another root');
    noteAssets(parsed.assets);
    await Promise.all(parsed.assets.filter((asset) => asset.kind === 'css').map(loadAsset));
    if (stale()) return false;
    address = withKeys(here.href, target, block.keys);
    draw = () => {
      // Replacing the block disconnects what leaves: its elements release
      // their own listeners in their own disconnect.
      element.replaceWith(next);
      drawn = next;
      return parsed.assets.filter((asset) => asset.kind === 'javascript');
    };
  }
  // The answer is whole and as declared: draw it in one step, then the address.
  stopSkeleton(element);
  const focused = element.contains(document().activeElement) ? document().activeElement : null;
  const controls = (root) => [...root.querySelectorAll('a[href], button, input, select, textarea')].filter((node) => node.closest(BLOCK) === root);
  const focusIndex = focused ? controls(element).indexOf(focused) : -1;
  const scripts = draw() ?? [];
  if (block.mode === 'html') {
    for (const asset of scripts) await loadAsset(asset);
    if (focused && !focused.isConnected) {
      // Focus stays on the control that was used: the same control (by id,
      // else by its place among the block's controls) in the new block.
      const again = (focused.id && drawn.querySelector(`#${CSS.escape(focused.id)}`)) || controls(drawn)[focusIndex];
      again?.focus({preventScroll: true});
    }
  }
  writeHistory(address, history);
  const answerState = drawn.getAttribute('data-sf-fragment-state') || 'populated';
  emit(drawn, 'sf-fragment-load', {fragment: block.id, url: address, mode: block.mode, state: answerState});
  if (linked) publishParameters(drawn, block, before, address);
  return true;
}

// Linked blocks (simai.interface-fragment 1.1.0, refreshable-block): a block
// that changed its keys says so with a parameters-changed value; every block
// that reads one of those keys refreshes itself with its own request. The
// address was written once, by the owner.
function publishParameters(element, block, before, after) {
  const keys = changedKeys(before, after).filter((key) => block.keys.includes(key));
  if (!keys.length) return;
  const url = new URL(after);
  const value = {keys, url: `${url.pathname}${url.search}`};
  emit(element, 'sf-fragment-parameters', {type: 'parameters-changed', value, fragment: block.id});
  for (const reader of pageMap().blocks) {
    if (reader.element === element || !reader.reads.some((key) => keys.includes(key))) continue;
    refresh(reader.element, after, {history: 'none', linked: false});
  }
}

function controlOf(event) {
  if (!config || event.defaultPrevented) return null;
  const path = event.composedPath();
  const element = path.find((node) => node instanceof globalThis.Element && node.matches(BLOCK));
  if (!element) return null;
  const block = readBlock(element);
  if (!globalThis.location.pathname.startsWith(config.scope)) return null;
  return {element, block};
}

// The keys the other blocks of the page own.
const othersKeys = (map, element) => [...map.owners].filter(([, block]) => block.element !== element).map(([key]) => key);

function historyRule(control, element) {
  const marked = control.closest('[data-sf-fragment-history]');
  if (!marked || !element.contains(marked)) return 'push';
  return marked.getAttribute('data-sf-fragment-history') === 'replace' ? 'replace' : 'push';
}

function onClick(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const found = controlOf(event);
  if (!found) return;
  const link = event.composedPath().find((node) => node instanceof globalThis.Element && node.matches('a[href]'));
  if (!link || link.closest(BLOCK) !== found.element) return;
  if (link.closest('[data-full-load]') || link.hasAttribute('download')) return;
  const target = link.getAttribute('target');
  if (target && target !== '_self') return;
  const map = pageMap();
  if (map.plain.has(found.element)) {
    // A plain block (a key or an id declared twice): its controls load the
    // page in full, never region navigation's partial swap.
    if (!ownedChange(link.href, globalThis.location.href, found.block.keys)) return;
    event.preventDefault();
    fullLoad(link.href, 'conflict', found.element);
    return;
  }
  if (!ownedChange(link.href, globalThis.location.href, found.block.keys, othersKeys(map, found.element))) return;
  event.preventDefault();
  lastHref = globalThis.location.href;
  refresh(found.element, withKeys(globalThis.location.href, link.href, found.block.keys), {history: historyRule(link, found.element)});
}

function onSubmit(event) {
  const found = controlOf(event);
  if (!found) return;
  const form = event.target;
  if (!(form instanceof globalThis.HTMLFormElement) || form.closest(BLOCK) !== found.element) return;
  const submitter = event.submitter ?? null;
  const method = (submitter?.getAttribute('formmethod') || form.getAttribute('method') || 'get').toLowerCase();
  if (method !== 'get' || form.closest('[data-full-load]') || submitter?.closest('[data-full-load]')) return;
  const formTarget = submitter?.getAttribute('formtarget') || form.getAttribute('target');
  if (formTarget && formTarget !== '_self') return;
  const action = new URL(submitter?.getAttribute('formaction') || form.getAttribute('action') || globalThis.location.href, globalThis.location.href);
  action.search = new URLSearchParams(new FormData(form, submitter)).toString();
  action.hash = '';
  const map = pageMap();
  if (map.plain.has(found.element)) {
    if (!ownedChange(action.href, globalThis.location.href, found.block.keys)) return;
    event.preventDefault();
    fullLoad(action.href, 'conflict', found.element);
    return;
  }
  if (!ownedChange(action.href, globalThis.location.href, found.block.keys, othersKeys(map, found.element))) return;
  event.preventDefault();
  lastHref = globalThis.location.href;
  refresh(found.element, withKeys(globalThis.location.href, action.href, found.block.keys), {history: historyRule(submitter ?? form, found.element)});
}

// Back and Forward: only entries this runtime marked (sfFragment). Another
// marker's entries -- region navigation's sfRegion alone, a product's own --
// are left to their owners. When only block keys differ between the entry
// left and the entry reached, the blocks whose keys changed are drawn again
// without a history write, and region navigation is told the entry is taken.
const withoutHash = (href) => href.split('#')[0];

// Whether this Back or Forward is block refresh's (or nobody's) rather than
// region navigation's. Region navigation asks through the shared global
// before it acts, so the answer does not depend on the order of listeners.
// It is:
//  - 'blocks' when only keys blocks own differ between the entry left and the
//    entry reached (the blocks are drawn again);
//  - 'none' when the address reached is the one this runtime last knew: the
//    entry left was not written by the Framework (a product's own entry, a
//    hash jump), and leaving it is the product's to handle;
//  - null otherwise.
// One answer per popstate, whichever listener asks first.
let popMemo = null;
function popClaim(state) {
  if (popMemo && popMemo.state === state && popMemo.href === globalThis.location.href) return popMemo.claim;
  const claim = freshClaim(state);
  popMemo = {state, href: globalThis.location.href, claim, from: lastHref};
  setTimeout(() => { popMemo = null; }, 0);
  return claim;
}

function freshClaim(state) {
  if (!config || !lastHref || !isObject(state) || !(state.sfFragment || state.sfRegion)) return null;
  const from = new URL(lastHref);
  const to = new URL(globalThis.location.href);
  if (from.origin !== to.origin || from.pathname !== to.pathname) return null;
  if (withoutHash(from.href) === withoutHash(to.href)) return 'none';
  if (!state.sfFragment) return null;
  const changed = changedKeys(from.href, to.href);
  const map = pageMap();
  return changed.every((key) => map.owners.has(key)) ? 'blocks' : null;
}

/** For region navigation: whether the popstate now being handled is not its to take. */
export function claimsPop(state) {
  return popClaim(state) !== null;
}

function onPopState(event) {
  const claim = popClaim(event.state);
  const left = popMemo?.from ?? lastHref;
  lastHref = globalThis.location.href;
  if (!claim) return;
  event.sfFragment = true;
  if (claim === 'none') return;
  const from = new URL(left);
  const to = new URL(globalThis.location.href);
  const changed = changedKeys(from.href, to.href);
  const map = pageMap();
  const touched = new Set();
  for (const key of changed) touched.add(map.owners.get(key).element);
  for (const block of map.blocks) if (!map.plain.has(block.element) && block.reads.some((key) => changed.includes(key))) touched.add(block.element);
  for (const element of touched) refresh(element, to.href, {history: 'none', linked: false});
}

// Blocks that come onto the page (a region swap, an html answer) draw their
// first data; blocks that leave have their request dropped.
function onMutations(records) {
  let changed = false;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof globalThis.Element)) continue;
      const added = node.matches(BLOCK) ? [node, ...node.querySelectorAll(BLOCK)] : [...node.querySelectorAll(BLOCK)];
      for (const element of added) {
        changed = true;
        drawIsland(element);
      }
    }
    for (const node of record.removedNodes) {
      if (!(node instanceof globalThis.Element)) continue;
      const removed = node.matches(BLOCK) ? [node, ...node.querySelectorAll(BLOCK)] : [...node.querySelectorAll(BLOCK)];
      for (const element of removed) {
        if (element.isConnected) continue;
        changed = true;
        const own = live.get(element);
        if (!own) continue;
        own.sequence += 1;
        own.controller?.abort();
        clearTimeout(own.skeleton);
        clearTimeout(own.timeout);
      }
    }
  }
  if (changed) pageMap();
}

function onRegionLoad() {
  lastHref = globalThis.location.href;
}

export function enable(options = {}) {
  if (config) disable();
  config = {
    scope: typeof options.scope === 'string' ? options.scope : '/',
    onFullLoad: typeof options.onFullLoad === 'function' ? options.onFullLoad : null,
    timeoutMs: Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : TIMEOUT_MS,
  };
  lastHref = globalThis.location.href;
  // Capture: a block's control is taken before region navigation sees it,
  // and its Back before region navigation's own listener runs.
  document().addEventListener('click', onClick, true);
  document().addEventListener('submit', onSubmit, true);
  globalThis.addEventListener('popstate', onPopState, true);
  document().addEventListener('sf-region-load', onRegionLoad);
  // The entry the page opened on is this runtime's too; a product's own
  // fields in it are kept.
  const current = globalThis.history.state;
  globalThis.history.replaceState({...(isObject(current) ? current : {}), sfFragment: true}, '');
  pageMap();
  for (const element of document().querySelectorAll(BLOCK)) drawIsland(element);
  if (typeof globalThis.MutationObserver === 'function') {
    observer = new globalThis.MutationObserver(onMutations);
    observer.observe(document().documentElement, {childList: true, subtree: true});
  }
  return true;
}

export function disable() {
  if (!config) return;
  document().removeEventListener('click', onClick, true);
  document().removeEventListener('submit', onSubmit, true);
  globalThis.removeEventListener('popstate', onPopState, true);
  document().removeEventListener('sf-region-load', onRegionLoad);
  observer?.disconnect();
  observer = null;
  for (const element of document().querySelectorAll(BLOCK)) {
    const own = live.get(element);
    if (!own) continue;
    own.sequence += 1;
    own.controller?.abort();
    stopSkeleton(element);
  }
  config = null;
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.FragmentRefresh = Object.freeze({
    enable,
    disable,
    refresh,
    claimsPop,
    contract: CONTRACT,
    get enabled() {
      return Boolean(config);
    },
  });
}
