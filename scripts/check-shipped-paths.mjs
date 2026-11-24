#!/usr/bin/env node
// Usage: node scripts/check-shipped-paths.mjs [<build output root or a pair's distr/>]
//
// Every file a Smart component's manifest names for a server -- its
// templates (`templates.<name>.file`) and its examples (`examples`) -- is in
// the distribution at that path, relative to the component's folder. A
// server (Docara) reads the manifest of the distribution, so a path that is
// right only in ui-source sends it nowhere: the seven components Docara
// prints named js/templates/default.js, which the build ships as
// template/default.js, and sf-switch named a template.html that never
// existed (group build 19).
//
// The build ships a component's template folder -- template/ or js/templates/
// in ui-source -- as template/ (ui-builder buildPlan templateLayouts).
//
// Without a root the check reads ui-source alone and applies that rule; with
// one it reads the built files. Paths not shipped yet are migration debt,
// listed by component in contracts/shipped-template-paths.v1.json: the check
// fails on a path that is not shipped and not listed, and on a listed path
// that ships now (take it off the list). It also reports, without failing,
// each shipped template's relative imports that the distribution does not
// hold: a template is the component's Lit source and is read, not run, from
// the distribution (docs/developer/first-paint-render.md).
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, posix, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEBT_FILE = join(repo, 'contracts', 'shipped-template-paths.v1.json');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const isFile = (file) => existsSync(file) && statSync(file).isFile();
const IMPORT = /(?:^|[;\s])(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/gu;

/** Where a component's shipped files are: a build's smart folder, or ui-source's src/smart. */
export function smartFolders(root = null) {
  if (!root) return {mode: 'source', smart: join(repo, 'src', 'smart')};
  const out = resolve(root);
  const distr = existsSync(join(out, 'core', 'js', 'core.js')) && existsSync(join(out, 'smart'));
  return {mode: 'build', smart: distr ? join(out, 'smart') : join(out, 'smart', 'smart'), out: distr ? out : null};
}

// In ui-source: the file the build ships at template/<rest> (either layout).
const shippedFromSource = (dir, path) => {
  if (!path.startsWith('template/')) return false;
  const rest = path.slice('template/'.length);
  return isFile(join(dir, 'template', rest)) || isFile(join(dir, 'js', 'templates', rest));
};

/** The paths each component names, and which of them ship. */
export function declaredPaths(root = null) {
  const {mode, smart} = smartFolders(root);
  const found = [];
  for (const folder of readdirSync(smart).sort()) {
    const dir = join(smart, folder);
    const file = join(dir, 'component.json');
    if (!isFile(file)) continue;
    const manifest = readJson(file);
    const named = [];
    for (const [name, entry] of Object.entries(manifest.templates ?? {})) {
      const path = typeof entry === 'string' ? entry : entry?.file;
      if (typeof path === 'string') named.push({field: `templates.${name}.file`, path});
    }
    if (typeof manifest.examples === 'string') named.push({field: 'examples', path: manifest.examples});
    for (const one of named) {
      const normal = posix.normalize(one.path);
      const inside = !normal.startsWith('../') && !posix.isAbsolute(normal);
      let shipped;
      if (!inside) shipped = false;
      else if (mode === 'build') shipped = isFile(join(dir, normal));
      else shipped = one.field === 'examples' ? isFile(join(dir, normal)) : shippedFromSource(dir, normal);
      found.push({id: manifest.id, folder, ...one, shipped});
    }
  }
  return found;
}

/** A build's shipped templates whose relative imports it does not hold. */
export function templateImports(root) {
  const {smart} = smartFolders(root);
  const report = [];
  for (const folder of readdirSync(smart).sort()) {
    const dir = join(smart, folder, 'template');
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((one) => /\.m?js$/u.test(one)).sort()) {
      const text = readFileSync(join(dir, name), 'utf8');
      const missing = [...text.matchAll(IMPORT)].map((match) => match[1] || match[2])
        .filter((specifier) => !isFile(resolve(dir, specifier)));
      const bare = [...text.matchAll(/(?:^|[;\s])import\s+(?:[^'";]*?\sfrom\s+)?["']([^./"'][^"']*)["']/gu)].map((match) => match[1]);
      report.push({file: `smart/${folder}/template/${name}`, missing, bare: [...new Set(bare)].sort()});
    }
  }
  return report;
}

/** The check: {failures, debt, fixed, stale, imports}. */
export function checkShippedPaths(root = null, debt = readJson(DEBT_FILE).debt) {
  const paths = declaredPaths(root);
  const failures = [];
  const listed = new Set(Object.entries(debt).flatMap(([id, list]) => list.map((path) => `${id}\0${path}`)));
  const seen = new Set();
  for (const one of paths) {
    const key = `${one.id}\0${one.path}`;
    seen.add(key);
    if (one.shipped && listed.has(key)) failures.push(`${one.id} ${one.field} "${one.path}" ships now: take it off ${posix.basename(DEBT_FILE)}`);
    if (!one.shipped && !listed.has(key)) failures.push(`${one.id} ${one.field} "${one.path}" is not in the distribution (the build ships a template folder as template/)`);
  }
  for (const key of listed) if (!seen.has(key)) failures.push(`${key.replace('\0', ' "')}" is listed as debt but no manifest names it`);
  return {
    paths: paths.length,
    shipped: paths.filter((one) => one.shipped).length,
    debt: paths.filter((one) => !one.shipped && listed.has(`${one.id}\0${one.path}`)).length,
    failures,
    imports: root ? templateImports(root) : null,
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const root = process.argv[2] ?? null;
  const result = checkShippedPaths(root);
  const imports = result.imports;
  console.log(JSON.stringify({
    mode: root ? 'build' : 'source',
    paths: result.paths,
    shipped: result.shipped,
    debt: result.debt,
    failures: result.failures,
    ...(imports ? {templates: imports.length, templatesImportingUnshipped: imports.filter((one) => one.missing.length).length, templatesWithBareImports: imports.filter((one) => one.bare.length).length} : {}),
  }, null, 2));
  if (result.failures.length) process.exit(1);
}
