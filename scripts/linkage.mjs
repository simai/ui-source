#!/usr/bin/env node
// Usage:
//   node scripts/linkage.mjs passports --check [--rev <rev>] [--worktree] [--previous <inventory.json>] [--json]
//   node scripts/linkage.mjs passports --write
//   node scripts/linkage.mjs inventory --out <file> [--rev <rev>] [--release <ui-xxxxxxxxxxxx>] [--files]
//   node scripts/linkage.mjs compare <from-inventory.json> <to-inventory.json> [--out <file>]
//
// Standard simai.linkage 1.0.0 (contracts/standards/simai.linkage): every unit
// SIMAI Framework publishes has a passport -- an id, a version, its owner, the
// files that make it, one content hash over them and the units it depends on --
// and a release carries an inventory of them.
//
// The units of this repository:
//
// - every folder of src/component, src/utility and src/plugin is one unit
//   (component.<folder>, utility.<folder>, plugin.<folder>) with passport.json
//   in the folder;
// - every Smart component (a folder of src/smart with component.json) is
//   smart.<folder>: its passport is derived -- the id and version from
//   component.json, the files its folder -- so nothing is written into
//   src/smart. A former path's folder (a forward in
//   src/core/contracts/smart-rule-forwards.v1.json) belongs to the component it
//   forwards to;
// - every host port (src/core/contracts/ports/<name>) is port.<name>, derived:
//   the version is its newest edition, the files every edition;
// - the units whose files do not sit in a folder of their own -- the token sets,
//   the font, the icon sets, the shared modules and the core itself -- keep
//   their passport in src/core/passports/<id>.json and name their files through
//   `includes`.
//
// A file belongs to the unit whose claim is the longest (a folder claims every
// file under it, a file claims itself), so the icon fonts are the icon sets'
// even though they sit in the icons component's folder, and core.runtime takes
// what no token set, font or port claims under src/core. Every committed file
// under src/ belongs to exactly one unit.
//
// The hash is read from the committed tree (`--rev`, HEAD by default), never
// from the working tree: what is checked is what a release builds. `--write`
// reads the working tree, because it prepares the commit: write, commit, and
// the check reads the same bytes. It refreshes files, the hash and the
// dependencies and creates a missing passport at 1.0.0; it never moves a
// version -- that is a person's decision (patch, minor or major).
//
// `passports --check` fails when a unit has no passport, a passport does not
// match its files or hash, a dependency the code uses is not declared, or --
// with --previous -- a unit's hash moved against the previous release's
// inventory while its version did not.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const OWNER = 'simai/ui-source';
export const PASSPORT_SCHEMA = 'simai.framework.unit-passport';
export const INVENTORY_SCHEMA = 'simai.framework.unit-inventory';
export const REPORT_SCHEMA = 'simai.framework.unit-change-report';
export const CENTRAL = 'src/core/passports/';
const FOLDER_KINDS = {'src/component/': 'component', 'src/utility/': 'utility', 'src/plugin/': 'plugin'};
const FORWARDS = 'src/core/contracts/smart-rule-forwards.v1.json';
const PORTS = 'src/core/contracts/ports/';
// The kinds whose custom properties other units read: a read of --sf-x makes
// the reader depend on the unit that defines --sf-x.
const FOUNDATION_KINDS = new Set(['tokens', 'font', 'icons']);
const ID = /^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9.-]*$/u;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const RANGE = /^\^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// The tree: path -> bytes of every file under src/.

const git = (root, args, input) => execFileSync('git', ['-C', root, ...args], {input, maxBuffer: 1 << 30});

export function readCommittedTree(root = repositoryRoot, rev = 'HEAD') {
  const revision = git(root, ['rev-parse', `${rev}^{commit}`]).toString().trim();
  const listing = git(root, ['ls-tree', '-r', '-z', '--full-tree', revision, '--', 'src']).toString('utf8');
  const entries = listing.split('\0').filter(Boolean).map((line) => {
    const [meta, file] = line.split('\t');
    const [, type, object] = meta.split(' ');
    return {type, object, file};
  }).filter((entry) => entry.type === 'blob');
  const batch = git(root, ['cat-file', '--batch'], entries.map((entry) => `${entry.object}\n`).join(''));
  const tree = new Map();
  let offset = 0;
  for (const entry of entries) {
    const end = batch.indexOf(0x0a, offset);
    const header = batch.subarray(offset, end).toString('utf8').split(' ');
    const size = Number(header[2]);
    tree.set(entry.file, batch.subarray(end + 1, end + 1 + size));
    offset = end + 1 + size + 1;
  }
  return {revision, tree};
}

export function readWorkingTree(root = repositoryRoot) {
  const revision = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const files = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src']).toString('utf8').split('\0').filter(Boolean);
  const tree = new Map();
  for (const file of files) {
    const absolute = path.join(root, file);
    if (existsSync(absolute)) tree.set(file, readFileSync(absolute));
  }
  return {revision, tree};
}

// ---------------------------------------------------------------------------
// The hash and versions.

const byBytes = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

export function contentHash(files, tree) {
  const hash = createHash('sha256');
  for (const file of [...files].sort(byBytes)) {
    const bytes = tree.get(file);
    if (!bytes) throw new Error(`linkage: ${file} is not in the tree`);
    hash.update(Buffer.from(file, 'utf8'));
    hash.update(Buffer.from([0]));
    hash.update(Buffer.from(String(bytes.length), 'ascii'));
    hash.update(Buffer.from([0]));
    hash.update(bytes);
  }
  return hash.digest('hex');
}

const parse = (version) => version.split('.').map(Number);

export function compareVersions(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] < y[index] ? -1 : 1;
  return 0;
}

export function satisfies(version, range) {
  if (!RANGE.test(range) || !VERSION.test(version)) return false;
  const floor = range.slice(1);
  const [major, minor] = parse(floor);
  const [vMajor, vMinor] = parse(version);
  if (vMajor !== major) return false;
  if (major === 0 && vMinor !== minor) return false;
  return compareVersions(version, floor) >= 0;
}

export function versionStep(from, to) {
  const [a, b] = [parse(from), parse(to)];
  if (a[0] !== b[0]) return 'major';
  if (a[1] !== b[1]) return 'minor';
  if (a[2] !== b[2]) return 'patch';
  return 'none';
}

// ---------------------------------------------------------------------------
// The units.

const isPassportFile = (file) => file.startsWith(CENTRAL) || Object.keys(FOLDER_KINDS).some((base) => file.startsWith(base) && file.slice(base.length).split('/').length === 2 && file.endsWith('/passport.json'));

const json = (tree, file) => JSON.parse(tree.get(file).toString('utf8'));

function topFolders(tree, base) {
  const folders = new Set();
  for (const file of tree.keys()) {
    if (!file.startsWith(base)) continue;
    const parts = file.slice(base.length).split('/');
    if (parts.length > 1) folders.add(parts[0]);
  }
  return [...folders].sort(byBytes);
}

// Rule keys -> the folder of src/smart that defines them, for the forwards.
function ruleKeys(tree, file) {
  const text = tree.get(file).toString('utf8');
  const keys = [];
  for (const match of text.matchAll(/SF\.RuleLoader(?:\[\s*["'`]([^"'`]+)["'`]\s*\]|\.([A-Za-z_$][A-Za-z0-9_$]*))\s*=/gu)) keys.push(match[1] ?? match[2]);
  return keys;
}

/**
 * Every unit of the tree with its passport: written ones (per folder and
 * central) and derived ones (Smart components, host ports). Problems found on
 * the way are returned with them, never thrown, so a check reports them all.
 */
export function collectUnits(tree) {
  const units = [];
  const problems = [];

  for (const [base, kind] of Object.entries(FOLDER_KINDS)) {
    for (const folder of topFolders(tree, base)) {
      const passportFile = `${base}${folder}/passport.json`;
      // A folder's name in camelCase (contentDivider) becomes kebab-case in the id.
      const id = `${kind}.${folder.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
      const includes = [`${base}${folder}/`];
      if (!tree.has(passportFile)) {
        problems.push({id, code: 'no-passport', message: `${base}${folder} has no passport.json`});
        units.push({id, kind, includes, passportFile, passport: null, written: true});
        continue;
      }
      units.push({id, kind, includes, passportFile, passport: json(tree, passportFile), written: true});
    }
  }

  for (const file of [...tree.keys()].filter((entry) => entry.startsWith(CENTRAL)).sort(byBytes)) {
    if (!file.endsWith('.json')) { problems.push({id: file, code: 'stray-file', message: `${file} is not a passport`}); continue; }
    const passport = json(tree, file);
    const id = path.posix.basename(file, '.json');
    units.push({id, kind: id.split('.')[0], includes: passport.includes ?? [], passportFile: file, passport, written: true});
  }

  // Smart components: derived from component.json, never written into src/smart.
  const forwards = tree.has(FORWARDS) ? json(tree, FORWARDS).forwards ?? {} : {};
  const ruleFolder = new Map();
  for (const folder of topFolders(tree, 'src/smart/')) {
    const rule = `src/smart/${folder}/rule.js`;
    if (tree.has(rule)) for (const key of ruleKeys(tree, rule)) ruleFolder.set(key, folder);
  }
  const smart = new Map();
  for (const folder of topFolders(tree, 'src/smart/')) {
    const manifest = `src/smart/${folder}/component.json`;
    if (!tree.has(manifest)) continue;
    const component = json(tree, manifest);
    const id = component.id || `smart.${folder}`;
    const unit = {id, kind: 'smart', includes: [`src/smart/${folder}/`], passportFile: manifest, written: false,
      passport: {id, kind: 'smart', version: component.version, owner: OWNER}};
    smart.set(folder, unit);
    units.push(unit);
  }
  for (const folder of topFolders(tree, 'src/smart/')) {
    if (smart.has(folder)) continue;
    const forward = forwards[`cl-${folder}`];
    const target = forward && smart.get(ruleFolder.get(forward.to));
    if (target) {
      target.includes.push(`src/smart/${folder}/`);
      (target.passport.former_ids ??= []).push({id: `smart.${folder}`, journal: forward.journal});
    }
    // Otherwise a helper folder: a central passport has to claim it (checked
    // with every other unclaimed file).
  }

  // Host ports: one unit per port, every edition; the version is the newest.
  const ports = new Map();
  for (const file of tree.keys()) {
    if (!file.startsWith(PORTS)) continue;
    const [name, edition] = file.slice(PORTS.length).split('/');
    if (!VERSION.test(edition ?? '')) continue;
    const newest = ports.get(name);
    if (!newest || compareVersions(edition, newest) > 0) ports.set(name, edition);
  }
  for (const [name, version] of [...ports].sort(([a], [b]) => byBytes(a, b))) {
    const id = `port.${name}`;
    units.push({id, kind: 'port', includes: [`${PORTS}${name}/`], passportFile: `${PORTS}${name}/${version}/port.json`, written: false,
      passport: {id, kind: 'port', version, owner: OWNER}});
  }

  const seen = new Map();
  for (const unit of units) {
    if (seen.has(unit.id)) problems.push({id: unit.id, code: 'duplicate-id', message: `${unit.id} is claimed by ${seen.get(unit.id)} and ${unit.passportFile}`});
    seen.set(unit.id, unit.passportFile);
  }

  // Every file to the unit with the longest claim.
  const claims = [];
  for (const unit of units) for (const include of unit.includes) claims.push({include, unit});
  claims.sort((a, b) => b.include.length - a.include.length);
  const owners = new Map();
  for (const unit of units) unit.files = [];
  const unclaimed = [];
  for (const file of [...tree.keys()].sort(byBytes)) {
    if (isPassportFile(file)) continue;
    const matches = claims.filter(({include}) => (include.endsWith('/') ? file.startsWith(include) : file === include));
    if (!matches.length) { unclaimed.push(file); continue; }
    const best = matches.filter(({include}) => include.length === matches[0].include.length);
    const distinct = [...new Set(best.map(({unit}) => unit.id))];
    if (distinct.length > 1) problems.push({id: distinct.join(', '), code: 'claimed-twice', message: `${file} is claimed equally by ${distinct.join(' and ')}`});
    best[0].unit.files.push(file);
    owners.set(file, best[0].unit);
  }
  for (const file of unclaimed) problems.push({id: file, code: 'no-unit', message: `${file} belongs to no unit`});
  for (const unit of units) {
    for (const include of unit.includes) {
      const found = include.endsWith('/') ? unit.files.some((file) => file.startsWith(include)) : unit.files.includes(include);
      if (!found && unit.passport) problems.push({id: unit.id, code: 'empty-include', message: `${unit.id}: ${include} claims no file`});
    }
    unit.content_sha256 = contentHash(unit.files, tree);
  }

  const dependencies = detectDependencies(units, owners, tree, {forwards, ruleFolder});
  for (const unit of units) unit.detected = dependencies.get(unit.id);
  return {units, owners, problems};
}

// ---------------------------------------------------------------------------
// Dependencies, determined mechanically.

const SCSS_LOAD = /@(?:use|forward|import)\s+["']([^"']+)["']/gu;
const JS_IMPORT = /(?:\bimport\s*(?:[^'"`()]*?\bfrom\s*)?|\bexport\s+[^'"`;]*?\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/gu;
const TOKEN_DEFINITION = /(--sf-[A-Za-z0-9_\\/-]+)\s*:/gu;
const TOKEN_READ = /var\(\s*(--sf-[A-Za-z0-9_\\/-]+)/gu;
const CSS_URL = /url\(\s*["']?([^"')?#]+)/gu;
// The bundle entries: they import every utility's sheet and every rule to
// build one file, so the core carries those units; it does not use them.
const BUNDLE_ENTRIES = new Set(['src/core/utility-full.js', 'src/core/js/rule.src.js']);
const RELATION_NAME = /\bname\s*:\s*["'`]([^"'`]+)["'`]/gu;

function resolveScss(from, request, tree) {
  if (request.startsWith('sass:') || /^(https?:)?\/\//u.test(request)) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), request));
  const directory = path.posix.dirname(base);
  const name = path.posix.basename(base);
  const candidates = [];
  for (const stem of [name, `_${name}`]) {
    candidates.push(`${directory}/${stem}`);
    if (!/\.(s?css)$/u.test(stem)) candidates.push(`${directory}/${stem}.scss`, `${directory}/${stem}.css`);
  }
  candidates.push(`${base}/index.scss`, `${base}/_index.scss`);
  return candidates.find((candidate) => tree.has(candidate)) ?? null;
}

function resolveUrl(from, request, tree) {
  if (!request.startsWith('.')) return null;
  const file = path.posix.normalize(path.posix.join(path.posix.dirname(from), request.trim()));
  return tree.has(file) ? file : null;
}

function resolveScript(from, request, tree) {
  if (!request.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), request));
  return [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`, `${base}/index.mjs`].find((candidate) => tree.has(candidate)) ?? null;
}

function detectDependencies(units, owners, tree, {forwards, ruleFolder}) {
  // Rule key -> unit, through the forwards of former names.
  const ruleOwner = new Map();
  for (const [file, unit] of owners) {
    if (path.posix.basename(file) !== 'rule.js') continue;
    for (const key of ruleKeys(tree, file)) ruleOwner.set(key, unit);
  }
  for (const [former, {to}] of Object.entries(forwards)) {
    const target = ruleOwner.get(to) ?? (ruleFolder.has(to) ? owners.get(`src/smart/${ruleFolder.get(to)}/rule.js`) : null);
    if (target && !ruleOwner.has(former)) ruleOwner.set(former, target);
  }
  // Custom property -> the foundation units defining it.
  const definers = new Map();
  for (const unit of units) {
    if (!FOUNDATION_KINDS.has(unit.kind)) continue;
    for (const file of unit.files) {
      if (!/\.(s?css)$/u.test(file)) continue;
      for (const [, token] of tree.get(file).toString('utf8').matchAll(TOKEN_DEFINITION)) {
        if (!definers.has(token)) definers.set(token, new Set());
        definers.get(token).add(unit);
      }
    }
  }

  const result = new Map();
  for (const unit of units) {
    const found = new Set();
    const add = (other) => { if (other && other.id !== unit.id) found.add(other.id); };
    for (const file of unit.files) {
      const extension = path.posix.extname(file);
      if (!['.scss', '.css', '.js', '.mjs'].includes(extension) || BUNDLE_ENTRIES.has(file)) continue;
      const text = tree.get(file).toString('utf8');
      if (extension === '.scss' || extension === '.css') {
        for (const [, request] of text.matchAll(SCSS_LOAD)) add(owners.get(resolveScss(file, request, tree)));
        for (const [, request] of text.matchAll(CSS_URL)) add(owners.get(resolveUrl(file, request, tree)));
      } else {
        for (const [, request] of text.matchAll(JS_IMPORT)) add(owners.get(resolveScript(file, request, tree)));
      }
      if (path.posix.basename(file) === 'rule.js') {
        for (const block of text.matchAll(/\brelations?\s*:\s*\[([\s\S]*?)\]/gu)) {
          for (const [, name] of block[1].matchAll(RELATION_NAME)) add(ruleOwner.get(name));
        }
      }
      for (const [, token] of text.matchAll(TOKEN_READ)) for (const definer of definers.get(token) ?? []) add(definer);
    }
    result.set(unit.id, [...found].sort(byBytes));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Checking and writing.

const KINDS = ['component', 'utility', 'plugin', 'smart', 'port', 'tokens', 'font', 'icons', 'module', 'core'];
const PASSPORT_KEYS = ['schema', 'schema_version', 'id', 'kind', 'version', 'owner', 'summary', 'includes', 'files', 'content_sha256', 'dependencies', 'former_ids'];

function checkPassportShape(unit, problems) {
  const passport = unit.passport;
  const say = (code, message) => problems.push({id: unit.id, code, message: `${unit.passportFile}: ${message}`});
  if (passport.schema !== PASSPORT_SCHEMA || passport.schema_version !== 1) say('passport-form', `schema must be ${PASSPORT_SCHEMA} with schema_version 1`);
  for (const key of Object.keys(passport)) if (!PASSPORT_KEYS.includes(key)) say('passport-form', `unknown field ${key}`);
  if (passport.id !== unit.id) say('passport-id', `id ${passport.id} should be ${unit.id}`);
  if (!ID.test(passport.id ?? '')) say('passport-form', `id ${passport.id} is not <kind>.<name>`);
  if (!KINDS.includes(passport.kind) || passport.kind !== String(passport.id).split('.')[0]) say('passport-form', `kind ${passport.kind} must be the id's first part and one of ${KINDS.join(', ')}`);
  if (!VERSION.test(passport.version ?? '')) say('passport-form', `version ${passport.version} is not major.minor.patch`);
  if (typeof passport.owner !== 'string' || !passport.owner) say('passport-form', 'owner is missing');
  if (unit.passportFile.startsWith(CENTRAL) && !(Array.isArray(passport.includes) && passport.includes.length)) say('passport-form', 'a central passport names its files through includes');
  if (!Array.isArray(passport.dependencies)) say('passport-form', 'dependencies must be a list');
}

/** Checks every written passport against its files; returns problems. */
export function checkPassports(collected) {
  const {units} = collected;
  const problems = [...collected.problems];
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  for (const unit of units) {
    if (!unit.passport) continue;
    if (!unit.written) {
      if (!VERSION.test(unit.passport.version ?? '')) problems.push({id: unit.id, code: 'passport-form', message: `${unit.passportFile}: version ${unit.passport.version} is not major.minor.patch`});
      continue;
    }
    checkPassportShape(unit, problems);
    const passport = unit.passport;
    if (JSON.stringify(passport.files) !== JSON.stringify(unit.files)) {
      const listed = new Set(passport.files ?? []);
      const actual = new Set(unit.files);
      const missing = unit.files.filter((file) => !listed.has(file));
      const extra = (passport.files ?? []).filter((file) => !actual.has(file));
      problems.push({id: unit.id, code: 'files-differ', message: `${unit.passportFile}: files differ (not listed: ${missing.slice(0, 3).join(', ') || 'none'}${missing.length > 3 ? ', …' : ''}; gone: ${extra.slice(0, 3).join(', ') || 'none'}${extra.length > 3 ? ', …' : ''}; or out of order)`});
    }
    if (passport.content_sha256 !== unit.content_sha256) problems.push({id: unit.id, code: 'hash-differs', message: `${unit.passportFile}: content_sha256 ${passport.content_sha256} but the files hash to ${unit.content_sha256}`});
    const declared = new Map((passport.dependencies ?? []).map((dependency) => [dependency.id, dependency.range]));
    for (const id of unit.detected) {
      if (!declared.has(id)) problems.push({id: unit.id, code: 'dependency-undeclared', message: `${unit.passportFile}: uses ${id} but does not declare it`});
    }
    for (const [id, range] of declared) {
      const target = byId.get(id);
      if (!target) problems.push({id: unit.id, code: 'dependency-unknown', message: `${unit.passportFile}: depends on ${id}, which is no unit`});
      else if (!satisfies(target.passport?.version ?? '', range)) problems.push({id: unit.id, code: 'dependency-range', message: `${unit.passportFile}: ${id} ${range} is not met by ${target.passport?.version}`});
    }
  }
  return problems;
}

const rangeOf = (version) => `^${version}`;

// The detected dependencies, plus the ones a person declared by hand
// (`manual: true`), which --write keeps although no reading finds them. A range
// already written stays while the dependency's version still meets it.
function dependencyList(unit, byId, previous = []) {
  const written = new Map(previous.map((dependency) => [dependency.id, dependency]));
  const manual = previous.filter((dependency) => dependency.manual === true && byId.has(dependency.id)).map((dependency) => dependency.id);
  const ids = new Set([...unit.detected, ...manual]);
  return [...ids].sort(byBytes).map((id) => {
    const version = byId.get(id).passport?.version ?? '1.0.0';
    const range = written.get(id)?.range;
    const entry = {id, range: range && satisfies(version, range) ? range : rangeOf(version)};
    if (manual.includes(id)) entry.manual = true;
    return entry;
  });
}

/** The passport a written unit should carry now. */
export function passportFor(unit, byId) {
  const previous = unit.passport ?? {};
  const passport = {
    schema: PASSPORT_SCHEMA,
    schema_version: 1,
    id: unit.id,
    kind: unit.kind,
    version: VERSION.test(previous.version ?? '') ? previous.version : '1.0.0',
    owner: previous.owner || OWNER,
  };
  if (previous.summary) passport.summary = previous.summary;
  if (unit.passportFile.startsWith(CENTRAL)) passport.includes = previous.includes;
  passport.files = unit.files;
  passport.content_sha256 = unit.content_sha256;
  passport.dependencies = dependencyList(unit, byId, previous.dependencies ?? []);
  if (previous.former_ids?.length) passport.former_ids = previous.former_ids;
  return passport;
}

export function writePassports(root = repositoryRoot) {
  // Twice: a new passport's version is what the next round's ranges read.
  const written = new Set();
  for (let round = 0; round < 2; round += 1) {
    const {tree} = readWorkingTree(root);
    const {units} = collectUnits(tree);
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    let changed = 0;
    for (const unit of units) {
      if (!unit.written) continue;
      const text = `${JSON.stringify(passportFor(unit, byId), null, 2)}\n`;
      const file = path.join(root, unit.passportFile);
      if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, text);
      written.add(unit.passportFile);
      changed += 1;
    }
    if (!changed) break;
  }
  return [...written].sort(byBytes);
}

// ---------------------------------------------------------------------------
// Inventories and their comparison.

export function inventoryOf(collected, {revision, release = null, files = false}) {
  return {
    schema: INVENTORY_SCHEMA,
    schema_version: 1,
    source: OWNER,
    revision,
    release,
    units: [...collected.units].sort((a, b) => byBytes(a.id, b.id)).map((unit) => {
      const byId = new Map(collected.units.map((entry) => [entry.id, entry]));
      const entry = {
        id: unit.id,
        kind: unit.kind,
        version: unit.passport?.version ?? '0.0.0',
        content_sha256: unit.content_sha256,
      };
      if (files) entry.files = unit.files.length;
      entry.dependencies = unit.written && unit.passport ? unit.passport.dependencies ?? [] : dependencyList(unit, byId);
      return entry;
    }),
  };
}

/** The change report between two inventories of one source. */
export function compareInventories(from, to) {
  const before = new Map(from.units.map((unit) => [unit.id, unit]));
  const after = new Map(to.units.map((unit) => [unit.id, unit]));
  const report = {
    schema: REPORT_SCHEMA,
    schema_version: 1,
    source: to.source,
    from: {revision: from.revision, release: from.release ?? null},
    to: {revision: to.revision, release: to.release ?? null},
    added: [],
    removed: [],
    changed: [],
    dependencies_changed: [],
    violations: [],
  };
  if (from.source !== to.source) report.violations.push({id: to.source, code: 'source-differs', message: `the inventories come from ${from.source} and ${to.source}`});
  for (const [id, unit] of after) if (!before.has(id)) report.added.push({id, version: unit.version});
  for (const [id, unit] of before) if (!after.has(id)) report.removed.push({id, version: unit.version});
  for (const [id, unit] of after) {
    const old = before.get(id);
    if (!old) continue;
    const order = compareVersions(unit.version, old.version);
    if (order < 0) report.violations.push({id, code: 'version-went-back', message: `${id} went from ${old.version} back to ${unit.version}`});
    if (unit.content_sha256 !== old.content_sha256 && order === 0) {
      report.violations.push({id, code: 'hash-moved-without-version', message: `${id} ${unit.version}: its files changed (${old.content_sha256.slice(0, 12)} -> ${unit.content_sha256.slice(0, 12)}) but its version did not`});
    }
    if (unit.content_sha256 !== old.content_sha256 || order !== 0) {
      report.changed.push({id, from_version: old.version, to_version: unit.version, step: versionStep(old.version, unit.version)});
    }
    const oldDependencies = new Map((old.dependencies ?? []).map((dependency) => [dependency.id, dependency]));
    const newDependencies = new Map((unit.dependencies ?? []).map((dependency) => [dependency.id, dependency]));
    const added = [...newDependencies.keys()].filter((key) => !oldDependencies.has(key));
    const removed = [...oldDependencies.keys()].filter((key) => !newDependencies.has(key));
    const moved = [...newDependencies.keys()].filter((key) => oldDependencies.has(key) && before.get(key) && after.get(key) && before.get(key).version !== after.get(key).version);
    if (added.length || removed.length || moved.length) report.dependencies_changed.push({id, added, removed, moved});
  }
  for (const list of ['added', 'removed', 'changed', 'dependencies_changed', 'violations']) report[list].sort((a, b) => byBytes(a.id, b.id));
  return report;
}

// ---------------------------------------------------------------------------
// The command line.

function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => rest.includes(name);
  const option = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : null);
  const usage = 'Usage: node scripts/linkage.mjs passports --check [--rev <rev>] [--worktree] [--previous <inventory.json>] [--json]\n'
    + '       node scripts/linkage.mjs passports --write\n'
    + '       node scripts/linkage.mjs inventory --out <file> [--rev <rev>] [--release <id>] [--files]\n'
    + '       node scripts/linkage.mjs compare <from-inventory.json> <to-inventory.json> [--out <file>]';
  const read = () => (flag('--worktree') ? readWorkingTree() : readCommittedTree(repositoryRoot, option('--rev') || 'HEAD'));

  if (command === 'passports' && flag('--write')) {
    const written = writePassports();
    console.log(written.length ? `linkage: wrote ${written.length} passport(s)\n${written.map((file) => `  ${file}`).join('\n')}` : 'linkage: every passport is current');
    return 0;
  }
  if (command === 'passports' && flag('--check')) {
    const {revision, tree} = read();
    const collected = collectUnits(tree);
    const problems = checkPassports(collected);
    let report = null;
    if (option('--previous')) {
      const previous = JSON.parse(readFileSync(option('--previous'), 'utf8'));
      report = compareInventories(previous, inventoryOf(collected, {revision}));
      for (const violation of report.violations) problems.push(violation);
    }
    if (flag('--json')) console.log(JSON.stringify({revision, units: collected.units.length, problems, report}, null, 2));
    else {
      const counts = {};
      for (const unit of collected.units) counts[unit.kind] = (counts[unit.kind] ?? 0) + 1;
      console.log(`linkage: ${collected.units.length} units at ${revision.slice(0, 12)} (${Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(', ')})`);
      for (const problem of problems) console.log(`  ${problem.code}: ${problem.message}`);
      console.log(problems.length ? `linkage: ${problems.length} problem(s); \`node scripts/linkage.mjs passports --write\` refreshes files, hashes and dependencies, a version is moved by hand` : 'linkage: every passport matches its files');
    }
    return problems.length ? 1 : 0;
  }
  if (command === 'inventory' && option('--out')) {
    const {revision, tree} = read();
    const collected = collectUnits(tree);
    const problems = checkPassports(collected);
    if (problems.length) {
      for (const problem of problems) console.error(`  ${problem.code}: ${problem.message}`);
      console.error('linkage: no inventory while passports are not current');
      return 1;
    }
    const inventory = inventoryOf(collected, {revision, release: option('--release'), files: flag('--files')});
    writeFileSync(option('--out'), `${JSON.stringify(inventory, null, 2)}\n`);
    console.log(`linkage: ${inventory.units.length} units at ${revision.slice(0, 12)} -> ${option('--out')}`);
    return 0;
  }
  if (command === 'compare' && rest.filter((arg) => !arg.startsWith('--')).length >= 2) {
    const [from, to] = rest.filter((arg, index) => !arg.startsWith('--') && rest[index - 1] !== '--out');
    const report = compareInventories(JSON.parse(readFileSync(from, 'utf8')), JSON.parse(readFileSync(to, 'utf8')));
    const text = `${JSON.stringify(report, null, 2)}\n`;
    if (option('--out')) writeFileSync(option('--out'), text); else process.stdout.write(text);
    if (report.violations.length) {
      for (const violation of report.violations) console.error(`  ${violation.code}: ${violation.message}`);
      return 1;
    }
    return 0;
  }
  console.error(usage);
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
