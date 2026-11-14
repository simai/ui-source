#!/usr/bin/env node
// Source check for the role tokens (owner decision C173 point 9, 2026-11-14).
//
// RT-NAMES   the role tokens are the contract's (src/core/contracts/
//            role-tokens.v1.json): the generated SCSS is current, every name
//            has the form --sf-<area>--<role>, the count stays within the cap,
//            and no sheet declares another name of a role area. A host may
//            declare --sf-radius--inner on itself, with the one formula.
// RT-SCOPES  every step-dependent role is declared again in both density
//            regions with its root value (RT-15: a custom property resolves
//            where it is declared; a role on :root alone keeps the root's step
//            in a compact region).
// RT-ROLE-STEP a gap of a row of buttons, a toolbar or a row of tags in a
//            component or Smart sheet reads its role token (or a component
//            variable whose own default does), never a space step, an atom or
//            a length. Known departures are listed in the baseline with their
//            defect; an entry that no longer matches fails, so a fix removes
//            its entry.
// RT-SCRIM   a scrim reads --sf-scrim-color; a palette black is allowed only
//            as that variable's fallback (RT-12).
//
// Usage: node scripts/check-role-tokens.mjs [--json] [--list]
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contract, render, validate} from './generate-role-tokens.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = 'src/core/contracts/role-tokens.baseline.v1.json';
const DENSITY = 'src/core/scss/_sf_css__density.scss';
const ROLE_AREAS = /--sf-(gap|inset|radius|line|hit|layer)--([a-z][a-z-]*)\s*:\s*([^;}]+)/gu;
const INNER_FORMULA = /^max\(var\(--sf-a4\),\s*calc\(.+\s-\s.+\)\)$/u;

function files(dir, pattern, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, pattern, out);
    else if (pattern.test(name)) out.push(path);
  }
  return out;
}

const rel = (path) => relative(root, path).split('\\').join('/');

// Comments blanked, line breaks kept (line numbers stay true).
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, ' '))
    .replace(/(^|[\s;{}])\/\/[^\n]*/gu, (match, lead) => lead + ' '.repeat(match.length - lead.length));
}

// Declarations of a sheet with the chain of selectors above them and the
// other declarations of their block.
export function declarations(text) {
  const out = [];
  const stack = [];
  let buffer = '';
  let line = 1;
  for (const char of stripComments(text)) {
    if (char === '\n') line += 1;
    if (char === '{') {
      stack.push({selector: buffer.trim().replace(/\s+/gu, ' '), declarations: []});
      buffer = '';
      continue;
    }
    if (char === '}' || char === ';') {
      const match = /^\s*(--[\w\\/-]+|[a-z-]+)\s*:\s*([\s\S]+?)\s*$/u.exec(buffer);
      if (match && !/^\s*@/u.test(buffer)) {
        const block = stack.at(-1) ?? {selector: '', declarations: []};
        const entry = {line, chain: stack.map((item) => item.selector).join(' > '), prop: match[1], value: match[2].replace(/\s+/gu, ' '), block};
        block.declarations.push(entry);
        out.push(entry);
      }
      buffer = '';
      if (char === '}') stack.pop();
      continue;
    }
    buffer += char;
  }
  return out;
}

export function checkNames(data = contract()) {
  const errors = validate(data).map((message) => `RT-NAMES ${message}`);
  const scss = readFileSync(join(root, data.scss), 'utf8');
  if (scss !== render(data)) errors.push(`RT-NAMES ${data.scss} is stale: run node scripts/generate-role-tokens.mjs`);
  const known = new Set([...data.tokens.map((token) => token.name), ...data.existing.map((token) => token.name)]);
  const allowed = new Set([data.scss, DENSITY, 'src/core/scss/_sf_css__border.scss']);
  for (const path of files(join(root, 'src'), /\.(scss|css|js|mjs)$/u)) {
    const file = rel(path);
    const text = stripComments(readFileSync(path, 'utf8'));
    for (const match of text.matchAll(ROLE_AREAS)) {
      const name = `--sf-${match[1]}--${match[2]}`;
      const value = match[3].trim();
      if (!known.has(name)) {
        errors.push(`RT-NAMES ${file}: ${name} is not a role token of the contract (new role names only through ${'src/core/contracts/role-tokens.v1.json'}, within the cap)`);
        continue;
      }
      if (allowed.has(file)) continue;
      if (name === '--sf-radius--inner' && INNER_FORMULA.test(value)) continue;
      errors.push(`RT-NAMES ${file}: declares ${name}: ${value}; a role token is declared by the core only${name === '--sf-radius--inner' ? ' (a host declares --sf-radius--inner with max(var(--sf-a4), calc(<corner> - <inset>)))' : ''}`);
    }
  }
  return errors;
}

export function checkScopes(data = contract()) {
  const errors = [];
  const text = readFileSync(join(root, DENSITY), 'utf8');
  for (const region of ['compact', 'normal']) {
    const at = text.indexOf(`[data-sf-density="${region}"] {`);
    const end = text.indexOf('}', at);
    const block = at === -1 ? '' : text.slice(at, end);
    for (const token of data.tokens.filter((item) => item.density)) {
      const expected = `${token.name}: ${token.value};`;
      if (!block.includes(expected)) errors.push(`RT-SCOPES ${DENSITY}: the ${region} region does not declare ${expected} (RT-15: run node scripts/generate-density.mjs)`);
    }
  }
  return errors;
}

// The role a declaration's context names: toolbar before tags before actions
// (a toolbar's footer is still a toolbar).
const ROLES = [
  ['toolbar', /toolbar/iu, '--sf-gap--toolbar'],
  ['tags', /(?:^|[^a-z])(?:tags?-container|tags|chips?|tag-group)(?:[^a-z]|$)/iu, '--sf-gap--tags'],
  ['actions', /(?:actions|buttons|footer|button-row)/iu, '--sf-gap--actions'],
];
const GAP_PROP = (prop) => /^(?:gap|column-gap)$/u.test(prop) || (prop.startsWith('--') && /(?:gap|between)/u.test(prop));
const ROLE_VALUE = /var\(--sf-gap--[a-z-]+\)/u;
// A component variable (its own default is checked where it is declared);
// a step, an atom or the pixel is not one.
const INDIRECTION = /^var\((?!--sf-space-|--sf-[a-i]\d\)|--sf-px\))--sf-[\w-]+\)$/u;

export function roleStepFindings() {
  const findings = [];
  const sheets = [...files(join(root, 'src/component'), /\.(scss|css)$/u), ...files(join(root, 'src/smart'), /\.(scss|css)$/u)];
  for (const path of sheets) findings.push(...roleStepFindingsIn(readFileSync(path, 'utf8'), rel(path)));
  return findings;
}

// The role gaps of one sheet that do not read their role token.
export function roleStepFindingsIn(text, file) {
  const findings = [];
  for (const entry of declarations(text)) {
    if (!GAP_PROP(entry.prop)) continue;
    const role = ROLES.find(([, pattern]) => pattern.test(entry.chain.split(' > ').at(-1) ?? '') || pattern.test(entry.prop));
    if (!role) continue;
    // A column of fields or rows is not a row (a form, a sheet).
    if (entry.block.declarations.some((other) => other.prop === 'flex-direction' && /column/u.test(other.value))) continue;
    if (ROLE_VALUE.test(entry.value) || INDIRECTION.test(entry.value)) continue;
    if (entry.value === '0' || /^var\(--sf-[\w-]+,\s*0\)$/u.test(entry.value)) continue;
    findings.push({file, line: entry.line, selector: entry.chain.split(' > ').at(-1), prop: entry.prop, value: entry.value, role: role[0], expected: role[2]});
  }
  return findings;
}

export function checkRoleSteps() {
  const baseline = JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8'));
  const errors = [];
  const used = new Set();
  for (const finding of roleStepFindings()) {
    const index = baseline.entries.findIndex((entry) => entry.file === finding.file && entry.selector === finding.selector && entry.prop === finding.prop && entry.value === finding.value);
    if (index !== -1) {
      used.add(index);
      continue;
    }
    errors.push(`RT-ROLE-STEP ${finding.file}:${finding.line} ${finding.selector} { ${finding.prop}: ${finding.value} } -- a ${finding.role} gap reads ${finding.expected} (or a component variable defaulting to it), not a step`);
  }
  baseline.entries.forEach((entry, index) => {
    if (!used.has(index)) errors.push(`RT-ROLE-STEP ${BASELINE_PATH}: the entry for ${entry.file} ${entry.selector} { ${entry.prop}: ${entry.value} } (${entry.defect}) no longer matches; remove it`);
  });
  return errors;
}

export function checkScrim() {
  const errors = [];
  const sheets = [...files(join(root, 'src/component'), /\.(scss|css)$/u), ...files(join(root, 'src/smart'), /\.(scss|css)$/u), ...files(join(root, 'src/core/scss'), /\.scss$/u)];
  for (const path of sheets) {
    const file = rel(path);
    for (const entry of declarations(readFileSync(path, 'utf8'))) {
      if (!/--sf-black--alfa-64/u.test(entry.value)) continue;
      if (!/(scrim|backdrop|overlay|dim)/iu.test(`${entry.chain} ${entry.prop}`) && !/100vmax/u.test(entry.value)) continue;
      const bare = entry.value.replace(/var\(--sf-scrim-color,\s*var\(--sf-black--alfa-64\)\)/gu, '');
      if (/--sf-black--alfa-64/u.test(bare) && entry.prop !== '--sf-scrim-color') errors.push(`RT-SCRIM ${file}:${entry.line} ${entry.prop}: ${entry.value} -- a scrim reads --sf-scrim-color`);
    }
  }
  return errors;
}

export function check() {
  const data = contract();
  return [...checkNames(data), ...checkScopes(data), ...checkRoleSteps(), ...checkScrim()];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.includes('--list')) {
    for (const finding of roleStepFindings()) process.stdout.write(`${finding.role}\t${finding.file}:${finding.line}\t${finding.selector}\t${finding.prop}: ${finding.value}\n`);
  } else {
    const errors = check();
    if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify({errors}, null, 2)}\n`);
    else if (errors.length) process.stderr.write(`${errors.join('\n')}\n`);
    else process.stdout.write(`role tokens: ${contract().tokens.length} names (cap ${contract().cap}), scopes, role gaps and scrim pass\n`);
    process.exitCode = errors.length ? 1 : 0;
  }
}
