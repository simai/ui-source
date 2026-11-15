// What a component package's elements draw, against what their contract
// requires (src/core/contracts/packages/<package>.package.json).
//
// A Pro element that draws a Framework Smart tag -- sf-chat-window's
// sf-progress-bar, sf-view-properties's sf-input-lookup -- gets that tag's
// code only through its rule's relations, which the ui-pro build writes from
// the requires list of its entry here. A tag drawn and not required, directly
// or through what the entry requires, never upgrades on a page that loads the
// element alone. Two such misses shipped in pairs (cl-view-properties and
// smart.input-lookup, pair ui-22690ab1c1dd); this reads every element's code
// for the tags it draws instead of waiting for a page to show the next one.
//
// The code read is the package's built folder (smart/<folder>/js/<folder>.js
// and template/*.js, as a release asset ships it), else the element's source
// folder in simai/ui-pro (components/src/smart/<folder>, every .js under it).
// A drawn tag is markup -- `<sf-name` in a template or a string -- or
// document.createElement('sf-name'); comments are left out.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const DRAWN = /<(sf-[a-z0-9-]+)[\s>/]|createElement\(\s*['"`](sf-[a-z0-9-]+)['"`]/gu;

// Comments out, strings and templates kept: a URL's // inside a string stays.
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:\\'"`])\/\/[^\n]*/gu, '$1');
}

export function drawnTags(source) {
  const tags = new Set();
  for (const match of withoutComments(source).matchAll(DRAWN)) tags.add(match[1] || match[2]);
  return tags;
}

function scriptsUnder(directory, skip = new Set(['node_modules', 'docs', 'tests', 'static', 'lang'])) {
  const out = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (!skip.has(name)) out.push(...scriptsUnder(path, skip));
    } else if (/\.m?js$/u.test(name) && !name.endsWith('.min.js') && name !== 'rule.js') {
      out.push(path);
    }
  }
  return out;
}

// The scripts of one element: the built bundle and templates when the folder
// is a built one, else its whole source folder.
export function elementScripts(packageRoot, folder) {
  const directory = join(packageRoot, folder);
  if (!existsSync(directory)) return [];
  const built = join(directory, 'js', `${folder}.js`);
  if (existsSync(built)) {
    const templates = join(directory, 'template');
    return [built, ...(existsSync(templates) ? scriptsUnder(templates) : [])];
  }
  return scriptsUnder(directory);
}

// The Framework's Smart rules in this checkout: tag (and former tag) to id,
// and each id's relations as ids (lazy ones too: the Loader fetches them on
// use).
export function readFrameworkRules(root) {
  const smart = join(root, 'src/smart');
  const byTag = new Map();
  const byRule = new Map();
  const relations = new Map();
  for (const folder of readdirSync(smart)) {
    const rulePath = join(smart, folder, 'rule.js');
    const manifestPath = join(smart, folder, 'component.json');
    if (!existsSync(rulePath) || !existsSync(manifestPath)) continue;
    const id = JSON.parse(readFileSync(manifestPath, 'utf8')).id || `smart.${folder}`;
    const rule = readFileSync(rulePath, 'utf8');
    const name = rule.match(/SF\.RuleLoader\['([^']+)'\]/u)?.[1];
    if (name) byRule.set(name, id);
    const tags = rule.match(/tags:\s*\[([^\]]*)\]/u)?.[1] ?? '';
    for (const tag of tags.matchAll(/'([^']+)'/gu)) byTag.set(tag[1], id);
    const block = rule.match(/relation:\s*\[([\s\S]*?)\]/u)?.[1] ?? '';
    relations.set(id, [...block.matchAll(/name:\s*'([^']+)'/gu)].map((one) => one[1]));
  }
  // Rule names to ids once every rule is read; a class component's name
  // (progress-scale) is not a Smart element and stays out.
  for (const [id, names] of relations) {
    relations.set(id, names.map((name) => byRule.get(name)).filter(Boolean));
  }
  return {byTag, relations};
}

// Every id an entry reaches: its requires, a Pro entry's requires and a
// Framework element's relations, to the end.
export function reachable(entry, entries, framework) {
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const pro = entries.get(id);
    for (const next of pro ? pro.requires : framework.relations.get(id) ?? []) walk(next);
  };
  for (const id of entry.requires) walk(id);
  return seen;
}

/**
 * The misses of one package: for each entry, the Smart tags its code draws
 * that no rule it reaches claims. A tag no rule claims at all (an element's
 * own inner tag, sf-admin-menu-item) is not a requirement and is listed
 * apart as unclaimed.
 */
export function checkPackageRenderedTags({root, reference, packageRoot}) {
  const framework = readFrameworkRules(root);
  const entries = new Map(reference.provides.map((entry) => [entry.id, entry]));
  const proTags = new Map();
  for (const entry of reference.provides) {
    proTags.set(entry.element, entry.id);
    for (const alias of entry.element_aliases ?? []) proTags.set(alias.from, entry.id);
  }
  const results = [];
  for (const entry of reference.provides) {
    const scripts = elementScripts(packageRoot, entry.folder);
    const drawn = new Set();
    for (const file of scripts) for (const tag of drawnTags(readFileSync(file, 'utf8'))) drawn.add(tag);
    const reach = reachable(entry, entries, framework);
    const missing = [];
    const unclaimed = [];
    for (const tag of [...drawn].sort()) {
      const id = proTags.get(tag) ?? framework.byTag.get(tag);
      if (!id) {
        unclaimed.push(tag);
        continue;
      }
      if (id === entry.id || reach.has(id)) continue;
      missing.push({tag, id});
    }
    results.push({id: entry.id, element: entry.element, scripts: scripts.length, drawn: [...drawn].sort(), missing, unclaimed});
  }
  return results;
}
