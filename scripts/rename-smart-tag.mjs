#!/usr/bin/env node
// Renames a Smart component's tag and keeps the old tag as a dated alias
// (rename plan R0, ui-control control/RENAME-PLAN-2026-11-03.md; change
// lifecycle docs/developer/change-lifecycle.md).
//
// Usage:
//   node scripts/rename-smart-tag.mjs <old-tag> <new-tag> [--date YYYY-MM-DD] [--previous <inventory.json>] [--dry-run]
//   node scripts/rename-smart-tag.mjs --sweep <old-tag> [--date YYYY-MM-DD]
//
// A rename does, in this order:
//
//  1. The folder. src/smart/<old> moves to src/smart/<new> (git mv: the
//     folder takes the tag's name, standard simai.smart-component §3, §21), and
//     src/smart/<old>/index.js becomes a forwarding script for the old
//     distribution path, smart/<old>/js/<old>.js; the Loader forwards the old
//     bundle name cl-<old> to cl-<new> (src/core/contracts/smart-rule-forwards.v1.json).
//  2. component.json. tag, id (smart.<new>: the id follows the folder, as the
//     ui registry derives it from the rule name), a minor version, and the
//     dated alias rows: kind "tag" for the element, kind "event" for every
//     event whose DOM name carries the tag (<old>-<verb> -> <new>-<verb>).
//  3. Every other component whose relations name cl-<old> names cl-<new>.
//  4. The text of src/ and tests/:
//     - markup: <old ...> and </old> become the new tag everywhere;
//     - sheets (.css, .scss): a type selector naming the old tag becomes
//       :is(<new>, <old>) for the alias period; a comment names the new tag;
//     - prose (Markdown, JSON strings that are not code, script comments): the
//       tag as a word, never a class (.sf-x, class="sf-x"), a custom property
//       (--sf-x-*) or a longer name (sf-x-icon);
//     - paths and ids: src/smart/<old>/, smart/<old>/js/<old>.js, cl-<old>,
//       smart.<old>;
//     - a script's string literals are not rewritten (a class and a tag can be
//       spelled alike): each place that still names the old tag is listed, to
//       move to tagSelector()/isTag() from the Smart base by hand.
//  5. The journal: a record kind "tag" (rewrite rename-tag) and a record of the
//     path, the bundle name and the registry id (kind component, manual), both
//     dated by the policy (contracts/lifecycle-policy.json).
//  6. The generated files: the component files (scripts/generate-component-files.mjs
//     --write), the tag alias table (scripts/tag-alias-table.mjs --write), the
//     template utilities, the contract registry (sf-contract build) and the
//     passports (linkage.mjs passports --write).
//  7. Versions: with --previous (the last released inventory, e.g.
//     ../ui/contracts/releases/ui-<12>.inventory.json) every unit whose files
//     moved while its version did not gets a patch; the renamed component gets
//     a minor in any case.
//
// What is left for a person is printed at the end: the script places that name
// the old tag, and the checks to run (npm run component-files:check, the
// contract tests, the browser test tests/browser/tag-aliases.browser.mjs on a
// build).
//
// --sweep <old-tag> takes an alias out on its sweep day: the alias rows, the
// :is(<new>, <old>) groups, the forward and the forwarding folder go; the
// journal records are set removed. Consumers are scanned first
// (scripts/sf-upgrade.mjs), as the lifecycle says.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const flag = (name) => args.includes(name);
const positional = args.filter((arg, index) => !arg.startsWith('--') && !['--date', '--previous', '--sweep'].includes(args[index - 1]));
const sweepTag = option('--sweep');
const dryRun = flag('--dry-run');
const today = option('--date') || new Date().toISOString().slice(0, 10);
const TAG = /^sf-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const rel = (file) => path.relative(root, file);
const abs = (file) => path.join(root, file);
const readJson = (file) => JSON.parse(readFileSync(abs(file), 'utf8'));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const short = (tag) => tag.replace(/^sf-/u, '');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const run = (command, commandArgs) => execFileSync(command, commandArgs, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28});
const written = new Set();
function write(file, text) {
  const target = abs(file);
  if (existsSync(target) && readFileSync(target, 'utf8') === text) return;
  written.add(file);
  if (dryRun) return;
  mkdirSync(path.dirname(target), {recursive: true});
  writeFileSync(target, text);
}

// The policy's sweep day: the first 1st on or after deprecated_on + compat_days.
export function removeAfter(deprecatedOn, policy = readJson('contracts/lifecycle-policy.json')) {
  const date = new Date(`${deprecatedOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + policy.compat_days);
  if (date.getUTCDate() !== policy.sweep_day_of_month) date.setUTCMonth(date.getUTCMonth() + 1, policy.sweep_day_of_month);
  return date.toISOString().slice(0, 10);
}

const bump = (version, step) => {
  const [major, minor, patch] = version.split('.').map(Number);
  return step === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
};

function smartFolders() {
  return readdirSync(abs('src/smart')).filter((name) => existsSync(abs(`src/smart/${name}/component.json`))).sort();
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'output', '.artifacts'].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- text rules

// A tag as a word: not part of a longer name, not a class (.sf-x), an id
// (#sf-x), a custom property (--sf-x) or a Sass variable.
const word = (tag) => new RegExp(`(?<![\\w.#$@%/-])${escape(tag)}(?![\\w-])`, 'gu');
// In prose a former event name of the tag (sf-x:verb) is a name of its own,
// not the tag; in a selector sf-x:hover is the tag.
const proseWord = (tag) => new RegExp(`(?<![\\w.#$@%/-])${escape(tag)}(?![\\w-]|:\\w)`, 'gu');
const markup = (tag) => new RegExp(`<(/?)${escape(tag)}(?![\\w-])`, 'gu');

// Markup everywhere; the word only outside class="..." values.
export function renameProse(text, from, to) {
  let out = text.replace(markup(from), (match, slash) => `<${slash}${to}`);
  const parts = out.split(/(class=(?:\\?"[^"\\]*\\?"|'[^']*'))/u);
  out = parts.map((part, index) => (index % 2 ? part : part.replace(proseWord(from), to))).join('');
  return out;
}

export const CONTAINER_NAME = /((?:container(?:-name)?\s*:|@container)\s*[\w-]+)/u;

// Sheets: comments name the new tag; a selector names both while the alias
// lives. Strings (url(), content) are left.
export function renameSheet(text, from, to) {
  const pieces = text.split(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/u);
  return pieces.map((piece, index) => {
    // A container's name (container: <name> / ..., @container <name>) is an
    // identifier spelled like the tag, not a selector: it stays.
    if (!(index % 2)) return piece.split(CONTAINER_NAME).map((part, at) => (at % 2 ? part : part.replace(word(from), `:is(${to}, ${from})`))).join('');
    if (piece.startsWith('/*') || piece.startsWith('//')) return piece.replace(word(from), to);
    return piece;
  }).join('');
}

// Scripts: markup in templates and define('<old>'); with `comments`, a line
// that is a comment (it starts with //, /* or *) names the new tag too. String
// literals are reported, not rewritten.
export function renameScript(text, from, to, {comments = false} = {}) {
  return text.split('\n').map((line) => {
    if (comments && /^\s*(?:\/\/|\/\*|\*)/u.test(line)) return line.replace(markup(from), (match, slash) => `<${slash}${to}`).replace(proseWord(from), to);
    return line
      .replace(markup(from), (match, slash) => `<${slash}${to}`)
      .replace(new RegExp(`(\\.define\\(\\s*['"\`])${escape(from)}(['"\`])`, 'gu'), `$1${to}$2`);
  }).join('\n');
}

// A selector passed to querySelector(All), closest or matches names the new
// tag: in tests and in the checks of examples, where the markup is the
// Framework's own and draws the new tag. The Framework's code asks
// tagSelector() instead, so its places are reported, not rewritten.
export function renameSelectorCalls(text, from, to) {
  return text.replace(/((?:querySelector(?:All)?|closest|matches)\(\s*)(['"`])((?:(?!\2)[^\\\n]|\\.)*)\2/gu,
    (whole, head, quote, selector) => `${head}${quote}${selector.replace(word(from), to)}${quote}`);
}

// JSON: a string that is the tag becomes the new tag; a string of code (a
// check, a script) takes markup only; the rest is prose.
export function renameJson(value, from, to, key = '') {
  if (Array.isArray(value)) return value.map((item) => renameJson(item, from, to, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, renameJson(item, from, to, name)]));
  if (typeof value !== 'string') return value;
  if (value === from) return to;
  if (key === '$comment') return renameProse(value, from, to);
  if (/\(|=>|;\s/u.test(value) && !/^\s*</u.test(value)) return renameSelectorCalls(value.replace(markup(from), (match, slash) => `<${slash}${to}`), from, to);
  return renameProse(value, from, to);
}

// Another component's JSON: markup anywhere, selectors in code strings.
export function renameJsonCode(value, from, to, key = '') {
  if (Array.isArray(value)) return value.map((item) => renameJsonCode(item, from, to, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, renameJsonCode(item, from, to, name)]));
  if (typeof value !== 'string') return value;
  // An assembly's part names the element it places. Elsewhere a string that
  // is the tag may be a record of the past (an alias table's tag), so it stays.
  if (value === from && key === 'part') return to;
  return renameSelectorCalls(value.replace(markup(from), (match, slash) => `<${slash}${to}`), from, to);
}

// Paths and ids of the folder.
export function renamePaths(text, oldFolder, newFolder) {
  return text
    .replace(new RegExp(`smart/${escape(oldFolder)}/(js|css)/${escape(oldFolder)}((?:\\.min)?\\.(?:js|css))`, 'gu'), `smart/${newFolder}/$1/${newFolder}$2`)
    .replace(new RegExp(`smart/${escape(oldFolder)}/`, 'gu'), `smart/${newFolder}/`)
    // A sibling folder's import: '../<old>/js/x.mjs' from src/smart/<other>/.
    .replace(new RegExp(`(['"])\\.\\./${escape(oldFolder)}/`, 'gu'), `$1../${newFolder}/`)
    .replace(new RegExp(`(?<![\\w-])cl-${escape(oldFolder)}(?![\\w-])`, 'gu'), `cl-${newFolder}`)
    .replace(new RegExp(`(?<![\\w-])smart\\.${escape(oldFolder)}(?![\\w-])`, 'gu'), `smart.${newFolder}`);
}

// What a script still says with the old tag in a string: a selector, a
// createElement, a comparison -- or a class of the same spelling.
export function scriptLeftovers(text, from) {
  const found = [];
  const pattern = new RegExp(`(['"\`])(?:[^'"\`\\n]*[\\s>+~,(])?${escape(from)}(?![\\w-])`, 'gu');
  for (const match of text.matchAll(pattern)) found.push(text.slice(0, match.index).split('\n').length);
  return found;
}

// ------------------------------------------------------------- the stub

function forwardingStub({oldTag, newTag, oldFolder, newFolder, since, until, journalId, sheet}) {
  return `// The distribution path of ${newTag} (formerly ${oldTag}) until ${until} (change
// journal ${journalId}). The folder took the new tag's name: ${newTag} is
// served from smart/${newFolder}/ (js/${newFolder}.js). A page or a doc that still names
// smart/${oldFolder}/js/${oldFolder}.js keeps loading a working element, under either tag:
//
// - this bundle carries no element of its own (every bundle carries its own
//   copy of the modules it imports, so a second class here would be a second
//   class for one tag); it notes the old path in SF.deprecations and adds the
//   script of smart/${newFolder}/ beside its own, unless ${newTag} is defined or that
//   script is already on the page;
// - the Loader forwards the old bundle name, cl-${oldFolder}, to cl-${newFolder}
//   (src/core/contracts/smart-rule-forwards.v1.json) and never fetches this file.
// Written by scripts/rename-smart-tag.mjs.
import {noteDeprecated} from '../../core/js/deprecations.js';
${sheet ? `import '../${newFolder}/${sheet}';\n` : ''}
const FROM = 'smart/${oldFolder}/';
const TO = 'smart/${newFolder}/';
const OWN = /\\/${escape(oldFolder)}\\/js\\/${escape(oldFolder)}(\\.min)?\\.js(?=$|[?#])/u;

function forward() {
  const doc = globalThis.document;
  if (!doc || !globalThis.customElements) return;
  noteDeprecated({
    component: '${newTag}',
    kind: 'path',
    from: FROM,
    to: TO,
    tag: '${newTag}',
    since: '${since}',
    remove_after: '${until}',
  });
  if (customElements.get('${newTag}')) return;
  // The old path this file was loaded by: document.currentScript while a
  // classic script runs, else the page's script element that names it (a
  // module script has no currentScript).
  const own = [doc.currentScript?.src || '', ...[...doc.querySelectorAll('script[src]')].map((script) => script.src)]
    .find((src) => OWN.test(src)) || '';
  let src = '';
  if (OWN.test(own)) {
    src = own.replace(OWN, '/${newFolder}/js/${newFolder}$1.js');
  } else {
    // Loaded as a module or by a script of the page: the smart root the
    // Loader uses (sfSmartPath, else sfPath), as it composes <root>/smart/.
    const root = String(globalThis.sfSmartPath || globalThis.sfPath || '').trim().replace(/\\/+$/u, '');
    if (!root) return;
    src = \`\${root}/smart/${newFolder}/js/${newFolder}.js\`;
  }
  const loaded = [...doc.querySelectorAll('script[src]')].some((script) => /\\/${escape(newFolder)}\\/js\\/${escape(newFolder)}(\\.min)?\\.js(?=$|[?#])/u.test(script.src));
  if (loaded) return;
  const script = doc.createElement('script');
  script.src = src;
  script.dataset.sfForwardedFrom = FROM;
  (doc.currentScript?.parentNode || doc.head || doc.documentElement).appendChild(script);
}

forward();
`;
}

// ------------------------------------------------------------- the journal

function appendRecords(records) {
  const file = 'contracts/changes/journal.json';
  const journal = readJson(file);
  const ids = new Set(journal.records.map((record) => record.id));
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`${record.id}: already in the journal`);
    journal.records.push(record);
  }
  write(file, json(journal));
}

// --------------------------------------------------------------- rename

function rename(oldTag, newTag) {
  if (!TAG.test(oldTag) || !TAG.test(newTag)) throw new Error('tags are sf-<words>');
  const folders = smartFolders();
  const oldFolder = folders.find((name) => readJson(`src/smart/${name}/component.json`).tag === oldTag);
  if (!oldFolder) throw new Error(`${oldTag}: no src/smart/*/component.json has this tag`);
  if (folders.some((name) => readJson(`src/smart/${name}/component.json`).tag === newTag)) throw new Error(`${newTag}: already a component`);
  const newFolder = short(newTag);
  if (existsSync(abs(`src/smart/${newFolder}`))) throw new Error(`src/smart/${newFolder}: already there`);
  const forwardsFile = 'src/core/contracts/smart-rule-forwards.v1.json';
  const forwards = readJson(forwardsFile);
  if (forwards.forwards[`cl-${oldFolder}`]) throw new Error(`cl-${oldFolder}: already a forward`);
  const until = removeAfter(today);
  const tagRecord = `tag-${oldTag}-to-${newTag}`;
  const pathRecord = `path-smart-${oldFolder}-to-${newFolder}`;

  // 1. The folder.
  const component = readJson(`src/smart/${oldFolder}/component.json`);
  if (dryRun) console.log(`would move src/smart/${oldFolder} -> src/smart/${newFolder}`);
  else run('git', ['mv', `src/smart/${oldFolder}`, `src/smart/${newFolder}`]);
  const at = (file) => `src/smart/${dryRun ? oldFolder : newFolder}/${file}`;
  const sheets = existsSync(abs(at('js/templates'))) ? readdirSync(abs(at('js/templates'))).filter((name) => /\.s?css$/u.test(name)) : [];
  write(`src/smart/${oldFolder}/index.js`, forwardingStub({oldTag, newTag, oldFolder, newFolder, since: today, until, journalId: pathRecord,
    sheet: sheets.length ? `js/templates/${sheets[0]}` : null}));
  forwards.forwards[`cl-${oldFolder}`] = {to: `cl-${newFolder}`, since: today, remove_after: until, journal: pathRecord};
  write(forwardsFile, json(forwards));

  // 2. component.json.
  const version = bump(component.version, 'minor');
  // The events whose DOM name is <tag>-<verb> (generate-component-files.mjs
  // domEvent): not native, not a trait's, not change/input unless x-native false.
  const events = Object.entries(component.events ?? {})
    .filter(([verb, spec]) => spec?.carries !== 'native' && !spec?.shared && !(['change', 'input'].includes(verb) && spec?.['x-native'] !== false))
    .map(([verb]) => verb);
  const next = renameJson({...component, aliases: undefined, 'x-source': undefined, 'x-decisions': undefined}, oldTag, newTag);
  next.tag = newTag;
  next.id = `smart.${newFolder}`;
  next.version = version;
  next.aliases = component.aliases ?? {since: today, 'remove-after': until, rows: []};
  if (next.aliases.$comment) next.aliases.$comment = renameProse(next.aliases.$comment, oldTag, newTag);
  // The component's earlier event aliases point at the names it sends: a row
  // to <old>-<verb> now points at <new>-<verb> (the shim sends an old name
  // only beside the name actually dispatched), and a row naming its component
  // names the new tag. A row from <old>-<verb> is replaced by the dated alias
  // written below (a manifest-only row said the DOM name did not change; now
  // it does).
  const renamedEvents = new Set(events.map((verb) => `${oldTag}-${verb}`));
  const earlier = (next.aliases.rows ?? []).filter((row) => {
    if (row.kind === 'event' && renamedEvents.has(row.from)) {
      console.log(`${row.from} -> ${row.to}: replaced by the dated alias ${row.from} -> ${newTag}-${row.from.slice(oldTag.length + 1)}`);
      return false;
    }
    return true;
  }).map((row) => {
    const out = {...row};
    if (out.kind === 'event' && typeof out.to === 'string' && out.to.startsWith(`${oldTag}-`)) out.to = `${newTag}-${out.to.slice(oldTag.length + 1)}`;
    if (out.component === oldTag) out.component = newTag;
    return out;
  });
  next.aliases.rows = [
    ...earlier,
    {from: oldTag, to: newTag, kind: 'tag', since: today, remove_after: until, 'since-version': version,
      section: 'rename plan R0 (ui-control RENAME-PLAN-2026-11-03), naming decision 2026-11-02', note: `the element is ${newTag}; ${oldTag} is a subclass defined beside it until the date`},
    ...events.map((verb) => ({from: `${oldTag}-${verb}`, to: `${newTag}-${verb}`, kind: 'event', since: today, remove_after: until, mode: 'same-detail',
      section: '§8', note: 'the event name carries the tag'})),
  ];
  if (component['x-source']) next['x-source'] = component['x-source'];
  next['x-decisions'] = [...(component['x-decisions'] ?? []),
    `version ${version}: the tag is ${newTag} (naming decision 2026-11-02: sf-[set]-<block>[-<variant>]); the folder, the id smart.${newFolder} and the bundle cl-${newFolder} follow it. ${oldTag} stays a dated alias until ${until}: a subclass the Smart base defines beside the new tag, listed in the rule, in sheets as :is(${newTag}, ${oldTag}) (change journal ${tagRecord}, ${pathRecord}).`];
  // Keep the key order of the file.
  const ordered = {};
  for (const key of Object.keys(component)) if (next[key] !== undefined) ordered[key] = next[key];
  for (const key of Object.keys(next)) if (!(key in ordered) && next[key] !== undefined) ordered[key] = next[key];
  write(at('component.json'), json(ordered));

  // 3. Relations of the other components.
  const touched = new Set([newFolder]);
  for (const name of smartFolders().filter((name) => ![oldFolder, newFolder].includes(name))) {
    const file = `src/smart/${name}/component.json`;
    const text = readFileSync(abs(file), 'utf8');
    const changed = renamePaths(text, oldFolder, newFolder);
    if (changed !== text) { write(file, changed); touched.add(name); }
  }

  // 4. The text of src/ and tests/.
  const leftovers = [];
  // The alias machinery names an old tag as its example; it is not a use.
  const skip = new Set(['contracts/changes/journal.json', forwardsFile, `src/smart/${oldFolder}/index.js`,
    'src/core/js/tag-aliases.generated.js', 'src/core/js/tag-aliases.js', 'src/core/js/alias-table.js', 'tests/tag-aliases.contract.test.mjs', 'tests/browser/tag-aliases.browser.mjs']);
  const files = [...walk(abs('src')), ...walk(abs('tests'))].map(rel)
    .filter((file) => !skip.has(file) && !file.endsWith('/aliases.json') && !(file.startsWith(`src/smart/${dryRun ? oldFolder : newFolder}/`) && file.endsWith('component.json')));
  for (const file of files) {
    const extension = path.extname(file);
    if (!['.js', '.mjs', '.cjs', '.css', '.scss', '.md', '.html', '.json'].includes(extension)) continue;
    const text = readFileSync(abs(file), 'utf8');
    if (!text.includes(oldTag) && !text.includes(oldFolder)) continue;
    // Prose is the renamed component's own: elsewhere the same word may be
    // something else (sf-gallery's former event sf-close), so outside its
    // folder only markup, sheets, define() and paths change.
    const own = file.startsWith(`src/smart/${dryRun ? oldFolder : newFolder}/`);
    const markupOnly = (value) => value.replace(markup(oldTag), (match, slash) => `<${slash}${newTag}`);
    let out = text;
    if (extension === '.css' || extension === '.scss') out = renameSheet(out, oldTag, newTag);
    else if (extension === '.json' && own) {
      try { out = json(renameJson(JSON.parse(out), oldTag, newTag)); if (!text.endsWith('\n')) out = out.slice(0, -1); } catch { out = renameProse(out, oldTag, newTag); }
      if (out === json(JSON.parse(text)) || out === JSON.stringify(JSON.parse(text), null, 2)) out = text;
    } else if ((extension === '.md' || extension === '.html') && own) out = renameProse(out, oldTag, newTag);
    else if (extension === '.json') {
      // Another component's JSON: markup, and the selectors of its checks.
      try {
        out = json(renameJsonCode(JSON.parse(out), oldTag, newTag));
        if (out === json(JSON.parse(text))) out = text;
      } catch { out = markupOnly(out); }
    } else if (extension === '.md' || extension === '.html') out = markupOnly(out);
    else {
      out = renameScript(out, oldTag, newTag, {comments: own});
      if (file.startsWith('tests/')) out = renameSelectorCalls(out, oldTag, newTag);
    }
    out = renamePaths(out, oldFolder, newFolder);
    if (out !== text) write(file, out);
    if (['.js', '.mjs', '.cjs'].includes(extension)) for (const line of scriptLeftovers(out, oldTag)) leftovers.push(`${file}:${line}`);
    // A test or a script that lists Smart folders by name ('close' in a list
    // of folders) is a person's to read: the word may be something else.
    if (/^(tests|scripts)\//u.test(file) && ['.js', '.mjs', '.cjs'].includes(extension) && new RegExp(`['"]${escape(oldFolder)}['"]`, 'u').test(out)) leftovers.push(`${file}: names '${oldFolder}' (a folder list?)`);
    const folder = /^src\/smart\/([^/]+)\//u.exec(file)?.[1];
    // A folder of shared helpers (src/smart/field-renderers) is no component.
    if (folder && out !== text && existsSync(abs(`src/smart/${folder}/component.json`))) touched.add(folder);
  }
  // The former folders are service directories of the Studio scripts.
  for (const file of ['scripts/generate-smart-studio-artifacts.mjs', 'scripts/refresh-smart-studio-provenance.mjs']) {
    const text = readFileSync(abs(file), 'utf8');
    const out = text.replace(/(const serviceDirectories = new Set\(\[)([^\]]*)(\]\))/u, (whole, head, list, tail) => (list.includes(`'${oldFolder}'`) ? whole : `${head}${list}, '${oldFolder}'${tail}`));
    if (out === text && !text.includes(`'${oldFolder}'`)) throw new Error(`${file}: no serviceDirectories list to extend`);
    write(file, out);
  }

  // 5. The journal.
  const eventItems = events.map((verb) => ({component: newTag, from: `${oldTag}-${verb}`, to: `${newTag}-${verb}`}));
  // The component's earlier event aliases are now the new tag's: recorded
  // under it, so the journal still holds every alias the manifest declares.
  const earlierItems = earlier.filter((row) => row.kind === 'event' && row.to).map((row) => ({component: newTag, from: row.from, to: row.to}));
  appendRecords([
    {
      id: tagRecord,
      recorded_on: today,
      stage: 'compat',
      kind: 'tag',
      summary: `${oldTag} is ${newTag} (Smart component naming, 2026-11-02: sf-[set]-<block>[-<variant>]). The old tag works until remove_after: the Smart base defines it as a subclass of ${newTag}'s class, the Loader's rule lists it, the Framework's sheets match :is(${newTag}, ${oldTag}), and the first old-tag element of a page is noted in SF.deprecations and once on the console.${events.length ? ` The events named after the tag are renamed with it and the old names are dated aliases (${events.map((verb) => `${oldTag}-${verb}`).join(', ')}).` : ''}`,
      items: [{component: newTag, from: oldTag, to: newTag}, ...eventItems, ...earlierItems],
      deprecated_on: today,
      remove_after: until,
      rewrite: 'rename-tag',
      examples: {before: `<${oldTag}></${oldTag}>`, after: `<${newTag}></${newTag}>`},
      manual: `Write <${newTag}> for <${oldTag}> in markup and ${newTag} for ${oldTag} in a sheet's type selector (sf-upgrade --apply does both). A script that finds the element by name (querySelector, closest, matches, createElement, a localName comparison) names ${newTag}, or both names through SF.tags.selector('${newTag}') while the alias lives; a class or a custom property spelled like the old tag (.${oldTag}, --${oldTag}-*) is not the tag and stays.`,
      owner: 'ui-source',
      source: `src/smart/${newFolder}/aliases.json, src/core/js/tag-aliases.js; ui-control control/RENAME-PLAN-2026-11-03.md (R0)`,
    },
    {
      id: pathRecord,
      recorded_on: today,
      stage: 'compat',
      kind: 'component',
      summary: `${newTag} is served from smart/${newFolder}/ since its folder took the new tag's name: js/${newFolder}.js, loader bundle cl-${newFolder}. The old path keeps working until remove_after: smart/${oldFolder}/js/${oldFolder}.js is a forwarding script that notes the path in SF.deprecations and loads smart/${newFolder}/js/${newFolder}.js, the Loader forwards the bundle name cl-${oldFolder} to cl-${newFolder} (src/core/contracts/smart-rule-forwards.v1.json), and the registry id smart.${oldFolder} is a dated alias of smart.${newFolder}, the id that follows the folder and the tag.`,
      items: [
        {component: newTag, from: `smart/${oldFolder}/js/${oldFolder}.js`, to: `smart/${newFolder}/js/${newFolder}.js`, match: `smart/${oldFolder}/js/${oldFolder}(?:\\.min)?\\.js`},
        ...(sheets.length ? [{component: newTag, from: `smart/${oldFolder}/css/${oldFolder}.css`, to: `smart/${newFolder}/css/${newFolder}.css`, match: `smart/${oldFolder}/css/${oldFolder}(?:\\.min)?\\.css`}] : []),
        {component: 'loader', from: `cl-${oldFolder}`, to: `cl-${newFolder}`, match: `['"]cl-${oldFolder}['"]`},
        {component: 'registry', from: `smart.${oldFolder}`, to: `smart.${newFolder}`, match: `['"]smart\\.${oldFolder}['"]`},
      ],
      deprecated_on: today,
      remove_after: until,
      rewrite: 'manual',
      manual: `Write smart/${newFolder}/ for smart/${oldFolder}/ and ${newFolder} for ${oldFolder} in the file names (js/${newFolder}.js, js/${newFolder}.min.js${sheets.length ? `, css/${newFolder}.css` : ''}); in a product rule's relation write cl-${newFolder} for cl-${oldFolder}, and in a manifest or a package contract smart.${newFolder} for smart.${oldFolder}. A page that lets the Loader fetch the element needs no change.`,
      examples: {before: `<script src="/distr/smart/${oldFolder}/js/${oldFolder}.js"></script>`, after: `<script src="/distr/smart/${newFolder}/js/${newFolder}.js"></script>`},
      owner: 'ui-source',
      source: `src/smart/${oldFolder}/index.js, ${forwardsFile}, src/smart/${newFolder}/component.json`,
    },
  ]);

  if (dryRun) {
    console.log([...written].sort().join('\n'));
    return;
  }

  // 6. The generated files.
  const components = [...touched].flatMap((name) => ['--component', name]);
  run(process.execPath, ['scripts/generate-component-files.mjs', '--write', ...components]);
  run(process.execPath, ['scripts/tag-alias-table.mjs', '--write']);
  run(process.execPath, ['scripts/generate-template-utilities.mjs']);

  // 7. Versions, then the registry and the passports that carry them. The
  // provenance is refreshed first, so a component whose manifest names a
  // shared file the rename edited moves its version too; the generator then
  // runs over every folder, as a bump may land outside the touched ones.
  refreshSourceArtifacts();
  bumpVersions(touched, newFolder);
  run(process.execPath, ['scripts/generate-component-files.mjs', '--write']);
  refreshSourceArtifacts();
  run(process.execPath, ['scripts/sf-contract.mjs', 'build']);
  run(process.execPath, ['scripts/linkage.mjs', 'passports', '--write']);

  console.log(`${oldTag} -> ${newTag}: src/smart/${oldFolder} -> src/smart/${newFolder}, alias until ${until} (journal ${tagRecord}, ${pathRecord}).`);
  console.log(`Components regenerated: ${[...touched].sort().join(', ')}.`);
  if (leftovers.length) {
    console.log(`\nScripts that still name ${oldTag} in a string (a class of that name is fine; a tag lookup moves to tagSelector()/isTag() from the Smart base):`);
    for (const place of leftovers) console.log(`  ${place}`);
  }
  console.log('\nNext: npm run component-files:check; node --test tests/tag-aliases.contract.test.mjs; npm test; on a build: node tests/browser/tag-aliases.browser.mjs <output>.');
}

// The manifest's provenance names the source files it was made from by hash
// (sf-contract build refuses a drift): the moved and edited index.js, and a
// shared sheet such as helpers/inherited-value.css that another component's
// manifest names. The generated runtime it names is the last build's and is
// restamped by the next.
function refreshSourceArtifacts() {
  for (const name of smartFolders()) {
    const file = `src/smart/${name}/smart.manifest.json`;
    if (!existsSync(abs(file))) continue;
    const manifest = readJson(file);
    let changed = false;
    for (const artifact of manifest.provenance?.source_artifacts ?? []) {
      if (!existsSync(abs(artifact.path))) continue;
      const sha256 = createHash('sha256').update(readFileSync(abs(artifact.path))).digest('hex');
      if (artifact.sha256 !== sha256) { artifact.sha256 = sha256; changed = true; }
    }
    if (changed) write(file, json(manifest));
  }
}

// A patch for every unit whose files moved since the previous release while
// its version did not; a minor for the renamed component.
function bumpVersions(touched, renamed) {
  const previous = option('--previous');
  const smartVersion = (name, step) => {
    const file = `src/smart/${name}/component.json`;
    const text = readFileSync(abs(file), 'utf8');
    const component = JSON.parse(text);
    write(file, text.replace(`"version": "${component.version}"`, `"version": "${bump(component.version, step)}"`));
  };
  if (!previous) {
    for (const name of touched) if (name !== renamed) smartVersion(name, 'patch');
    console.log('No --previous inventory: the touched components took a patch; check the other units with linkage-gate.sh.');
    return;
  }
  run(process.execPath, ['scripts/linkage.mjs', 'passports', '--write']);
  let report;
  try {
    report = JSON.parse(run(process.execPath, ['scripts/linkage.mjs', 'passports', '--check', '--worktree', '--previous', previous, '--json']));
  } catch (error) {
    report = JSON.parse(error.stdout);
  }
  const moved = new Set(report.problems.filter((problem) => problem.code === 'hash-moved-without-version').map((problem) => problem.id));
  for (const id of moved) {
    const [kind, name] = [id.slice(0, id.indexOf('.')), id.slice(id.indexOf('.') + 1)];
    if (kind === 'smart') { if (name !== renamed) smartVersion(name, 'patch'); continue; }
    const passport = [`src/core/passports/${id}.json`, `src/${kind}/${name}/passport.json`].find((file) => existsSync(abs(file)));
    if (!passport) { console.log(`${id}: moved without a version and no passport file found; bump it by hand`); continue; }
    const text = readFileSync(abs(passport), 'utf8');
    const {version} = JSON.parse(text);
    write(passport, text.replace(`"version": "${version}"`, `"version": "${bump(version, 'patch')}"`));
    console.log(`${id} ${version} -> ${bump(version, 'patch')}`);
  }
}

// --------------------------------------------------------------- sweep

function sweep(oldTag) {
  const forwardsFile = 'src/core/contracts/smart-rule-forwards.v1.json';
  const owner = smartFolders().find((name) => (readJson(`src/smart/${name}/component.json`).aliases?.rows ?? []).some((row) => row.kind === 'tag' && row.from === oldTag));
  if (!owner) throw new Error(`${oldTag}: no component keeps it as a tag alias`);
  const file = `src/smart/${owner}/component.json`;
  const component = readJson(file);
  const newTag = component.tag;
  component.aliases.rows = component.aliases.rows.filter((row) => !(row.kind === 'tag' && row.from === oldTag) && !(row.kind === 'event' && row.from.startsWith(`${oldTag}-`) && row.to.startsWith(`${newTag}-`)));
  write(file, json(component));
  const group = new RegExp(`:is\\(${escape(newTag)}, ${escape(oldTag)}\\)`, 'gu');
  for (const sheet of walk(abs('src')).filter((name) => /\.s?css$/u.test(name))) {
    const text = readFileSync(sheet, 'utf8');
    const out = text.replace(group, newTag);
    if (out !== text) write(rel(sheet), out);
  }
  const forwards = readJson(forwardsFile);
  const removed = Object.entries(forwards.forwards).filter(([, forward]) => forward.to === `cl-${owner}`).map(([name]) => name);
  for (const name of removed) delete forwards.forwards[name];
  write(forwardsFile, json(forwards));
  const journal = readJson('contracts/changes/journal.json');
  for (const record of journal.records) {
    if (record.stage !== 'compat') continue;
    if (record.id === `tag-${oldTag}-to-${newTag}` || removed.some((name) => record.id === `path-smart-${name.slice(3)}-to-${owner}`)) {
      record.stage = 'removed';
      record.removed_on = today;
    }
  }
  write('contracts/changes/journal.json', json(journal));
  if (!dryRun) {
    for (const name of removed) run('git', ['rm', '-r', '-q', `src/smart/${name.slice(3)}`]);
    run(process.execPath, ['scripts/generate-component-files.mjs', '--write', '--component', owner]);
    run(process.execPath, ['scripts/tag-alias-table.mjs', '--write']);
  }
  console.log(`${oldTag} swept from ${newTag}; remove the folders from the Studio scripts' serviceDirectories, set removed_in_pair on the records when the pair is cut, bump ${owner}, then linkage:write and contract:build.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (sweepTag) sweep(sweepTag);
    else if (positional.length === 2) rename(positional[0], positional[1]);
    else {
      console.error('Usage: node scripts/rename-smart-tag.mjs <old-tag> <new-tag> [--date YYYY-MM-DD] [--previous <inventory.json>] [--dry-run]\n       node scripts/rename-smart-tag.mjs --sweep <old-tag> [--date YYYY-MM-DD]');
      process.exit(2);
    }
  } catch (error) {
    console.error(`rename-smart-tag: ${error.message}`);
    if (error.stderr) console.error(String(error.stderr));
    process.exit(1);
  }
}
