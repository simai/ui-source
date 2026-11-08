// Component sets (standard simai.component-set 1.0.0): everything outside the
// free SIMAI Framework comes in sets, each served from its own base and
// describing its own components. SIMAI Framework does not know what a set
// holds; it knows how a page names one and where to look it up.
//
// A page names its sets in one line, on the script that loads Core:
//
//   <script src=".../distr/core/js/core.min.js" data-sf-sets="effects"></script>
//
// or in SF_BOOT_CONFIG.packages, before Core starts:
//
//   packages: {effects: true}                      the release the index gives
//   packages: {effects: '1.0.0'}                   that npm version, no index
//   packages: {effects: '<base>'}                  that base (a string with a /)
//   packages: {effects: {base, rule, version}}     the full form
//   packages: {effects: {index: true}}             by the index, in full form
//
// A set named without a base is looked up in the one compatibility index,
// simai.framework.set-index (contracts/schema/set-index.v1.schema.json): the
// newest release of the set whose SIMAI Framework range this Core is in. Its
// base is the set's npm package on jsDelivr,
// <npm root>/@simai-studio/<set>@<version>/dist/smart. A page that wants other
// hosts sets SF_BOOT_CONFIG.setIndex (the index address) and
// SF_BOOT_CONFIG.setNpm (the npm root): a mirror, or a local stand.
//
// This module holds the pure part -- reading a declaration, choosing a
// release, making a base -- and SF.package(name), which a page may call before
// the Loader has started. The Loader (loader.js) keeps the packages and asks
// these functions.

// The core.runtime passport version of this Core (src/core/passports/
// core.runtime.json). A set's release says the lowest version it needs, and
// the index lookup keeps the releases this Core satisfies. Moved by hand with
// the passport; tests/component-set-loader.contract.test.mjs holds them equal.
export const CORE_RUNTIME = '1.43.0';

export const SET_NAME = /^[a-z][a-z0-9-]*$/u;
export const SET_INDEX_FORMAT = 'simai.framework.set-index';
export const SET_INDEX_URL = 'https://cdn.jsdelivr.net/npm/@simai-studio/sets@1/index.json';
export const SET_NPM_ROOT = 'https://cdn.jsdelivr.net/npm';
export const SET_NPM_SCOPE = '@simai-studio';

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u;
const MINIMUM = /^>=(\d+\.\d+\.\d+)$/u;
const trimSlash = (value) => (typeof value === 'string' ? value.trim().replace(/\/+$/u, '') : '');

// -1, 0 or 1; a version with a pre-release part is below the same version
// without one. null when either is not a version.
export function compareVersions(a, b) {
  const left = VERSION.exec(String(a ?? ''));
  const right = VERSION.exec(String(b ?? ''));
  if (!left || !right) return null;
  for (let at = 1; at <= 3; at += 1) {
    const delta = Number(left[at]) - Number(right[at]);
    if (delta) return delta < 0 ? -1 : 1;
  }
  if (left[4] === right[4]) return 0;
  if (!left[4]) return 1;
  if (!right[4]) return -1;
  return left[4] < right[4] ? -1 : 1;
}

// Whether `version` meets a passport range of the form >=X.Y.Z.
export function meetsMinimum(range, version = CORE_RUNTIME) {
  const match = MINIMUM.exec(String(range ?? '').trim());
  if (!match) return false;
  const order = compareVersions(version, match[1]);
  return order !== null && order >= 0;
}

export const isVersion = (value) => typeof value === 'string' && VERSION.test(value);

// One entry of SF_BOOT_CONFIG.packages, read: {base, rule, version, byIndex,
// set} or null when it declares nothing usable. A version string is a version,
// any other string a base; true, or {index: true}, is "by the index". An
// object with none of base, version or index declares nothing (as before sets).
//
// `set` says the page named a component set, which carries a passport
// (set.json) beside its base: every set form -- true, a version, a base string,
// an object with a version or {index: true}. The component-package form,
// {base} or {base, rule} with no version, is a plain package (the Pro package,
// a product's own package): it has no passport and none is asked for.
export function readSetDeclaration(value) {
  if (value === true) return {base: '', rule: '', version: '', byIndex: true, set: true};
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (isVersion(text)) return {base: '', rule: '', version: text, byIndex: false, set: true};
    return {base: trimSlash(text), rule: '', version: '', byIndex: false, set: true};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const base = trimSlash(value.base);
  const rule = trimSlash(value.rule);
  const version = isVersion(value.version) ? value.version : '';
  const byIndex = !base && !version && value.index === true;
  if (!base && !version && !byIndex) return null;
  return {base, rule, version, byIndex, set: Boolean(version || byIndex)};
}

// The sets a data-sf-sets attribute names: "effects admin@1.2.0" ->
// {effects: true, admin: '1.2.0'}. Names that are not set names are left out
// and returned in `refused`.
export function readSetsAttribute(text) {
  const sets = {};
  const refused = [];
  for (const word of String(text ?? '').split(/[\s,]+/u).filter(Boolean)) {
    const at = word.indexOf('@');
    const name = at > 0 ? word.slice(0, at) : word;
    const version = at > 0 ? word.slice(at + 1) : '';
    if (!SET_NAME.test(name) || (at > 0 && !isVersion(version))) {
      refused.push(word);
      continue;
    }
    sets[name] = version || true;
  }
  return {sets, refused};
}

// Every data-sf-sets on the page's scripts, merged; the first script that
// names a set wins.
export function setsFromScripts(document = globalThis.document) {
  const sets = {};
  const refused = [];
  const scripts = document?.querySelectorAll?.('script[data-sf-sets]') ?? [];
  for (const script of scripts) {
    const read = readSetsAttribute(script.getAttribute('data-sf-sets'));
    for (const [name, value] of Object.entries(read.sets)) if (!(name in sets)) sets[name] = value;
    refused.push(...read.refused);
  }
  return {sets, refused};
}

// Where a released set is served: its npm package on the npm root.
export function npmBase(id, version, root = SET_NPM_ROOT) {
  return `${trimSlash(root) || SET_NPM_ROOT}/${SET_NPM_SCOPE}/${id}@${version}/dist/smart`;
}

// The problems of an index, empty when it holds. Only what the Loader relies
// on is checked here; the schema says the rest.
export function checkSetIndex(index) {
  if (!index || typeof index !== 'object') return ['index: not an object'];
  const problems = [];
  if (index.schema !== SET_INDEX_FORMAT || index.schema_version !== 1) problems.push(`schema: not ${SET_INDEX_FORMAT}, schema_version 1`);
  if (!Array.isArray(index.releases)) problems.push('releases: not a list');
  for (const [at, row] of (Array.isArray(index.releases) ? index.releases : []).entries()) {
    const where = `releases[${at}]`;
    if (!row || typeof row !== 'object') { problems.push(`${where}: not an object`); continue; }
    if (!SET_NAME.test(String(row.set ?? ''))) problems.push(`${where}.set`);
    if (!isVersion(row.version)) problems.push(`${where}.version`);
    if (!new RegExp(`^${row.set}-[0-9a-f]{12}$`, 'u').test(String(row.release ?? ''))) problems.push(`${where}.release`);
    if (!MINIMUM.test(String(row.framework?.core_runtime ?? ''))) problems.push(`${where}.framework.core_runtime`);
  }
  return problems;
}

// The release of set `id` this Core should load: the one with `version` when
// a version is asked for, else the newest whose framework range this Core
// meets. Answers {row} or {reason} -- 'unknown-set', 'no-compatible-release',
// 'version-not-indexed'.
export function selectSetRelease(index, id, {version = '', coreRuntime = CORE_RUNTIME} = {}) {
  const rows = (Array.isArray(index?.releases) ? index.releases : []).filter((row) => row?.set === id && isVersion(row.version));
  if (!rows.length) return {reason: 'unknown-set'};
  if (version) {
    const row = rows.find((candidate) => candidate.version === version);
    return row ? {row} : {reason: 'version-not-indexed'};
  }
  const fitting = rows.filter((row) => meetsMinimum(row.framework?.core_runtime, coreRuntime));
  if (!fitting.length) return {reason: 'no-compatible-release'};
  fitting.sort((a, b) => compareVersions(b.version, a.version));
  return {row: fitting[0]};
}

// The line a page adds to declare a set it has not.
export const declarationLine = (id) => `data-sf-sets="${id}" on the core script, or SF_BOOT_CONFIG.packages.${id} = true`;

// SF.package(name): a Promise of the set's exports -- what its bundle gave
// SF.RuleLoader.registerPackage(name, {exports}). Callable before the Loader
// has started; it waits for it. Rejects when the page has not declared the set.
function whenLoader() {
  const loader = globalThis.SF?.Loader;
  if (loader?.packageExports) return Promise.resolve(loader);
  return new Promise((resolve) => {
    globalThis.addEventListener?.('sf-loader-init', () => resolve(globalThis.SF.Loader), {once: true});
  });
}

export function packageExports(name) {
  return whenLoader().then((loader) => loader.packageExports(name));
}

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (typeof globalThis.SF.package !== 'function') {
    Object.defineProperty(globalThis.SF, 'package', {
      configurable: true,
      enumerable: true,
      writable: false,
      value: packageExports,
    });
  }
}
