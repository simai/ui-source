// The naming gate of SIMAI Framework (owner decision C174, 2026-11-14, point 6;
// gate 30 of the Smart component standard made real). Pure: it takes the
// shared name registry (contracts/registry/names.json), the Framework's own
// components and the tags of every other package
// (contracts/registry/package-tags.json), and returns one line per problem.
//
// The grammar is «family first» (decision 2026-11-02, C174 point 1):
// sf-<family>[-<variant or part>], at most three words after the prefix, the
// family the noun a person searches for (sf-header-page, not sf-page-header).
// A tag lives in one package: the one allowed copy is the pro bundle of a set,
// until the bundle ends (owner decision 2026-11-03, pro ends 2027-03-01).
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export const TAG = /^sf(-[a-z0-9]+){1,3}$/u;

// BEM marks belong to classes, never to tag names (C174 point 4): an element
// part is `__`, a modifier `--`; a tag carries neither.
export const BEM_MARK = /__|--/u;

export const familyOf = (tag) => String(tag).split('-')[1] ?? '';

// The Framework's components as the gate reads them: folder, tag, and the
// family its passport (component.json) names.
export function readFrameworkComponents(root) {
  const smart = join(root, 'src', 'smart');
  return readdirSync(smart, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(join(smart, entry.name, 'component.json')))
    .map((entry) => {
      const passport = JSON.parse(readFileSync(join(smart, entry.name, 'component.json'), 'utf8'));
      return {folder: entry.name, tag: passport.tag, family: passport.family};
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function checkComponentNames({registry, framework, packages, tagAliases = [], today = new Date().toISOString().slice(0, 10)}) {
  const problems = [];
  const owners = new Map(registry.owners.map((owner) => [owner.id, owner]));
  const familyOwner = new Map(registry.owners.flatMap((owner) => owner.families.map((family) => [family, owner.id])));
  const registeredTo = new Map(registry.owners.flatMap((owner) => owner.names.map(({element}) => [element, owner.id])));
  const exception = new Map(registry.exceptions.map((row) => [row.element, row]));
  const list = packages.packages ?? packages;

  // Where each tag is shipped, Framework included.
  const homes = new Map();
  const ship = (tag, home) => homes.set(tag, [...(homes.get(tag) ?? []), home]);
  framework.forEach(({tag}) => ship(tag, 'framework'));
  list.forEach((pkg) => pkg.tags.forEach((tag) => ship(tag, pkg.id)));

  const startsWithOwnFamily = (tag, ownerId) => {
    const family = familyOf(tag);
    if (owners.get(ownerId)?.families.includes(family)) return true;
    const allowed = exception.get(tag);
    return Boolean(allowed && allowed.owner === ownerId && allowed.family_owner === familyOwner.get(family));
  };

  // Every name a page may write: current tags, alias elements and former tags.
  const named = [
    ...framework.map(({tag}) => ({home: 'framework', name: tag})),
    ...tagAliases.flatMap((row) => [{home: 'framework alias', name: row.from}, {home: 'framework alias', name: row.to}]),
    ...list.flatMap((pkg) => [
      ...pkg.tags.map((name) => ({home: pkg.id, name})),
      ...(pkg.former_tags ?? []).flatMap((row) => [{home: `${pkg.id} former tag`, name: row.from}, {home: `${pkg.id} former tag`, name: row.to}]),
      ...(pkg.alias_elements ?? []).map((row) => ({home: `${pkg.id} alias element`, name: row.element})),
    ]),
  ];
  const marked = new Set();
  for (const {home, name} of named) {
    const key = `${home} ${name}`;
    if (!BEM_MARK.test(String(name ?? '')) || marked.has(key)) continue;
    marked.add(key);
    problems.push(`${key}: a tag never carries the BEM marks __ or -- (C174 point 4)`);
  }

  for (const {folder, tag, family} of framework) {
    if (BEM_MARK.test(tag ?? '')) continue;
    if (!TAG.test(tag ?? '')) {
      problems.push(`framework ${tag}: not sf-<family>[-<word>] with at most three words`);
      continue;
    }
    if (folder !== tag.slice(registry.prefix.length)) problems.push(`framework ${tag}: folder ${folder} is not the tag without ${registry.prefix}`);
    if (family !== familyOf(tag)) problems.push(`framework ${tag}: its passport names family "${family}", the first word of the tag is "${familyOf(tag)}" (family first, C174)`);
    if (!startsWithOwnFamily(tag, 'framework')) {
      problems.push(`framework ${tag}: "${familyOf(tag)}" is not a family of SIMAI Framework in the name registry`
        + (familyOwner.has(familyOf(tag)) ? ` (it belongs to ${familyOwner.get(familyOf(tag))})` : ' (head noun last? the family comes first)'));
    }
    const holder = registeredTo.get(tag);
    if (holder && holder !== 'framework') problems.push(`framework ${tag}: the name is registered to ${holder}`);
  }

  for (const pkg of list) {
    // The passport family of a package tag is its first word as well (NM-5),
    // when the family was read from the package (`families`).
    if (pkg.families) {
      for (const tag of pkg.tags) {
        if (!(tag in pkg.families)) problems.push(`${pkg.id} ${tag}: no passport family read for it`);
        else if (pkg.families[tag] !== familyOf(tag)) problems.push(`${pkg.id} ${tag}: its passport names family "${pkg.families[tag]}", the first word of the tag is "${familyOf(tag)}" (family first, C174)`);
      }
    }
    for (const tag of pkg.tags) {
      if (BEM_MARK.test(tag)) continue;
      if (!TAG.test(tag)) {
        problems.push(`${pkg.id} ${tag}: not sf-<family>[-<word>] with at most three words`);
        continue;
      }
      if (pkg.kind === 'bundle') {
        const owner = familyOwner.get(familyOf(tag));
        if (!pkg.bundles?.includes(owner)) problems.push(`${pkg.id} ${tag}: the bundle carries no set that owns family "${familyOf(tag)}"`);
      } else if (!startsWithOwnFamily(tag, pkg.id)) {
        problems.push(`${pkg.id} ${tag}: "${familyOf(tag)}" is not a family of ${pkg.id} in the name registry`
          + (familyOwner.has(familyOf(tag)) ? ` (it belongs to ${familyOwner.get(familyOf(tag))})` : ''));
      }
    }
    for (const row of pkg.alias_elements ?? []) {
      if (!homes.get(row.of)?.includes(row.owner)) problems.push(`${pkg.id} ${row.element}: alias element of ${row.of}, which ${row.owner} does not ship`);
      if (!(row.remove_after >= today)) problems.push(`${pkg.id} ${row.element}: the alias element ended on ${row.remove_after}`);
    }
  }

  // One home per tag; the pro bundle may copy the set that owns the family
  // until the bundle ends.
  const bundles = new Map(list.filter((pkg) => pkg.kind === 'bundle').map((pkg) => [pkg.id, pkg]));
  for (const [tag, where] of homes) {
    if (where.length < 2) continue;
    const owner = familyOwner.get(familyOf(tag));
    const copies = where.filter((home) => home !== owner);
    const allowed = copies.every((home) => bundles.has(home) && bundles.get(home).bundles?.includes(owner) && where.includes(owner)
      && bundles.get(home).bundle_until >= today);
    if (!allowed) problems.push(`${tag}: shipped by ${where.join(' and ')}; a tag lives in one package`);
  }

  // A former tag is never a current one anywhere.
  const formers = [
    ...tagAliases.map((row) => ({...row, home: 'framework'})),
    ...list.flatMap((pkg) => (pkg.former_tags ?? []).map((row) => ({...row, home: pkg.id}))),
  ];
  for (const row of formers) {
    if (homes.has(row.from)) problems.push(`${row.home} former tag ${row.from}: it is a current tag of ${homes.get(row.from).join(' and ')}`);
  }

  // A former tag is a declared alias: it names a tag that is shipped, and one
  // old name never points to two tags.
  const target = new Map();
  for (const row of formers) {
    if (!homes.has(row.to)) problems.push(`${row.home} former tag ${row.from}: it names ${row.to}, which no package ships`);
    const seen = target.get(row.from);
    if (seen && seen.to !== row.to) problems.push(`former tag ${row.from}: ${seen.home} names ${seen.to}, ${row.home} names ${row.to}`);
    else if (!seen) target.set(row.from, row);
  }
  for (const pkg of list) {
    for (const row of pkg.alias_elements ?? []) {
      const seen = target.get(row.element);
      if (seen && seen.to !== row.of) problems.push(`${pkg.id} alias element ${row.element}: of ${row.of}, but ${seen.home} names ${seen.to}`);
    }
  }

  return problems;
}

// The gate's answer against the listed open problems (package-tags.json
// `open`): a problem nobody listed fails. A listed one that is gone -- its
// package fixed it before this list was refreshed -- is reported for its row
// to be taken out, and does not fail before OPEN_UNTIL: a package (ui-pro,
// ui-view...) may fix its passports first without reddening this gate
// (defects-d12, Pro products batch). From OPEN_UNTIL, when the pro bundle
// ends, the list must be empty: a listed problem still there fails, and so
// does a row left for one that is gone.
export const OPEN_UNTIL = '2027-03-01';

export function splitOpen(problems, open = []) {
  const listed = new Set(open.map((row) => row.problem));
  return {
    fresh: problems.filter((line) => !listed.has(line)),
    listed: problems.filter((line) => listed.has(line)),
    gone: [...listed].filter((line) => !problems.includes(line)),
  };
}

// What fails the gate on `today` (YYYY-MM-DD): a new problem always; from
// OPEN_UNTIL a listed one and a row left for a gone one too.
export function openFailures({fresh, listed, gone}, today = new Date().toISOString().slice(0, 10)) {
  const due = today >= OPEN_UNTIL;
  return [
    ...fresh.map((line) => `NEW: ${line}`),
    ...(due ? listed.map((line) => `OPEN AFTER ${OPEN_UNTIL}: ${line}`) : []),
    ...(due ? gone.map((line) => `GONE (remove it from package-tags.json open): ${line}`) : []),
  ];
}
