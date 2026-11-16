#!/usr/bin/env node
// Role tokens (owner decision C173, 2026-11-14, refining C156): writes the
// role SCSS from src/core/contracts/role-tokens.v1.json and checks that each
// role still lands on the pixels the contract records at every view -- the
// desktop, the compact density and the phone. A role is an alias of a step;
// when a step moves, the role moves with it, and this check says so instead
// of letting a role change silently.
//
// The step-dependent roles are declared again in the density regions by
// scripts/generate-density.mjs (it reads this file's output): a custom
// property resolves where it is declared, so a role declared on :root alone
// keeps the root's step inside a compact region (RT-15).
//
// Usage: node scripts/generate-role-tokens.mjs [--check]
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT_PATH = 'src/core/contracts/role-tokens.v1.json';
export const contractText = () => readFileSync(join(root, CONTRACT_PATH), 'utf8');
export const contract = () => JSON.parse(contractText());

const esc = (name) => name.replaceAll('/', '\\/');

// The size scale (core/scss/vars/_sf_var__size.scss): a range letter starts at
// a length and climbs in its own step, ten steps a range.
const RANGES = {a: [0, 1], b: [10, 1], c: [20, 2], d: [40, 4], e: [80, 8], f: [160, 16], g: [320, 32], h: [640, 64], i: [1280, 128]};
const atomPx = (value) => {
  const match = /^var\(--sf-([a-i])(\d)\)$/u.exec(String(value).trim());
  if (!match) return null;
  const [start, step] = RANGES[match[1]];
  return start + step * Number(match[2]);
};

// The space step of a view: the phone is the root block of the space file,
// the desktop its 60rem block, the compact density the step below on the
// desktop (scripts/generate-density.mjs).
function spaceSteps() {
  const text = readFileSync(join(root, 'src/core/figma_variables/figma_space.scss'), 'utf8');
  const at = text.indexOf('@media');
  const parse = (block) => new Map([...block.matchAll(/(--sf-space-[^:\s]+)\s*:\s*([^;]+);/gu)].map((m) => [m[1].replaceAll('\\/', '/'), m[2].trim()]));
  const phone = parse(text.slice(0, at));
  const desktop = parse(text.slice(at));
  const order = ['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7', '8'];
  const compact = new Map(order.map((step, index) => [`--sf-space-${step}`, desktop.get(`--sf-space-${order[Math.max(0, index - 1)]}`)]));
  return {desktop, compact, phone};
}

// The z-index scale (utility/z-index/default/scss/_sf_var__z_index.scss): the
// numbered steps of $z-index-array and the layer stack's base, $z-index-layer.
export function zIndexScale() {
  const text = readFileSync(join(root, 'src/utility/z-index/default/scss/_sf_var__z_index.scss'), 'utf8');
  const array = /\$z-index-array:\s*\(([\s\S]*?)\);/u.exec(text)?.[1] ?? '';
  const scale = new Map([...array.matchAll(/(-?\d+)\s*:\s*(-?\d+)/gu)].map((m) => [`--sf-z-index-${m[1]}`, Number(m[2])]));
  const layer = /\$z-index-layer:\s*(\d+)\s*;/u.exec(text);
  if (layer) scale.set('--sf-z-index-layer', Number(layer[1]));
  return scale;
}

// The layer roles (C173 point 7, names and order C181 (3)): each reads one
// step of the z-index scale, the contract records its number, and they keep
// their order -- base under sticky under popover under window; a message not
// under a window (above the page the layer stack orders windows and messages
// by opening, core/js/layer-stack.js).
const LAYER_ORDER = ['--sf-layer--base', '--sf-layer--sticky', '--sf-layer--popover', '--sf-layer--window', '--sf-layer--message'];
const STRICT_BELOW = new Set(['--sf-layer--base', '--sf-layer--sticky', '--sf-layer--popover']);
export function validateLayers(data = contract()) {
  const errors = [];
  const layers = data.tokens.filter((token) => token.layer);
  const names = layers.map((token) => token.name);
  if (JSON.stringify(names) !== JSON.stringify(LAYER_ORDER) || JSON.stringify(data.layer_order ?? []) !== JSON.stringify(LAYER_ORDER)) {
    errors.push(`layers: ${names.join(', ') || 'none'}; C181 (3) gives ${LAYER_ORDER.join(' < ')}`);
  }
  const scale = zIndexScale();
  layers.forEach((token, index) => {
    const step = /^var\((--sf-z-index-(?:\d|layer))\)$/u.exec(token.value)?.[1];
    if (!step || !scale.has(step)) {
      errors.push(`${token.name}: ${token.value} is not a step of the z-index scale`);
      return;
    }
    if (scale.get(step) !== token.z) errors.push(`${token.name}: ${step} is ${scale.get(step)}, the contract records ${token.z}`);
    const next = layers[index + 1];
    if (!next) return;
    if (STRICT_BELOW.has(token.name) ? !(token.z < next.z) : !(token.z <= next.z)) {
      errors.push(`${token.name} (${token.z}) is not ${STRICT_BELOW.has(token.name) ? 'under' : 'at most'} ${next.name} (${next.z})`);
    }
  });
  return errors;
}

export function validate(data = contract()) {
  const errors = [];
  const naming = new RegExp(data.naming, 'u');
  const names = new Set();
  for (const token of data.tokens) {
    if (!naming.test(token.name)) errors.push(`${token.name}: not --sf-<area>--<role>`);
    if (names.has(token.name)) errors.push(`${token.name}: declared twice`);
    names.add(token.name);
    if (/\d(px|rem|em)\b/u.test(token.value)) errors.push(`${token.name}: a length in the value (${token.value}); a role is a reference to a step`);
  }
  if (data.tokens.length > data.cap) errors.push(`${data.tokens.length} role tokens, over the cap of ${data.cap} (C173 point 8)`);
  errors.push(...validateLayers(data));
  const steps = spaceSteps();
  for (const token of data.tokens.filter((item) => !item.layer)) {
    for (const view of ['desktop', 'compact', 'phone']) {
      let px = null;
      if (token.step) px = atomPx(steps[view].get(token.step));
      else if (token.value === 'var(--sf-px)') px = 1;
      else if (token.value === 'calc(2 * var(--sf-px))') px = 2;
      else px = atomPx(token.value) ?? token.px[view];
      if (px !== token.px[view]) errors.push(`${token.name}: ${view} resolves to ${px}, the contract records ${token.px[view]}`);
    }
  }
  return errors;
}

export function render(data = contract()) {
  const digest = createHash('sha256').update(contractText()).digest('hex');
  const lines = data.tokens.map((token) => `    ${esc(token.name)}: ${token.value};`);
  return `/*
 * Generated by scripts/generate-role-tokens.mjs from ${CONTRACT_PATH}.
 * contract-sha256: ${digest}
 * Do not edit by hand.
 *
 * Role tokens (owner decision C173): --sf-<area>--<role>, each an alias of an
 * existing step. Declared on :root, where the width ladder redefines the
 * steps too; the density regions declare the step-dependent ones again
 * (core/scss/_sf_css__density.scss), or a compact region would read the
 * root's step (RT-15). The five layer roles read the z-index scale in their
 * order (C173 point 7, C181 (3)). A host whose corner or inset differs declares
 * --sf-radius--inner on itself with the same formula:
 * max(var(--sf-a4), calc(<host corner> - <inset>)).
 */
@layer sf.base {
  :root {
${lines.join('\n')}
  }
}
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const data = contract();
  const errors = validate(data);
  if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exit(1);
  }
  const target = join(root, data.scss);
  const expected = render(data);
  if (process.argv.includes('--check')) {
    const actual = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (actual !== expected) {
      process.stderr.write(`role tokens are stale: ${data.scss}\nrun node scripts/generate-role-tokens.mjs\n`);
      process.exitCode = 1;
    }
  } else {
    writeFileSync(target, expected);
  }
}
