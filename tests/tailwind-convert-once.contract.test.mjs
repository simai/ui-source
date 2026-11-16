// The Loader converts a Tailwind class once, into a class the pair serves,
// and never touches the pair's own names (RG-TW-1..3, Tailwind parity study
// 2026-11-16; owner decision C214: the conversion is frozen, repairs only).
//
// The Loader rewrites the class attribute and reads it again on the next
// pass, so the map must be idempotent: place-self-center became self-center,
// then self-cross-center, and the pair's own self-center and content-center
// were unreachable. A negative value with a variant is spelled with the sign
// before the variant (-md:m-top-4), the way the built sheets write it.
//
// With UI_CORE_ROOT=<ui root> (a distr/ beside) every converted name below is
// looked up in the build's rule list and core sheet; without it that test is
// skipped -- the published pair is not the candidate.
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {convertTailwindClassToken, convertTailwindClasses} from '../src/core/js/tailwind-map.js';

// Tailwind names on the pair's scales, as pages write them.
const TAILWIND = [
  'text-left', 'text-right', 'float-left', 'float-right', 'clear-left', 'clear-right',
  'font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-black',
  'font-sans', 'font-serif', 'font-mono', 'pointer-events-none', 'pointer-events-auto', 'not-italic',
  'normal-case', 'no-underline', 'text-ellipsis', 'text-clip', 'bg-no-repeat', 'whitespace-nowrap',
  'whitespace-pre', 'whitespace-pre-line', 'whitespace-pre-wrap', 'contents',
  'bg-gray-100', 'text-red-500', 'border-blue-300', 'bg-white', 'text-black',
  'mt-4', 'mr-2', 'mb-0', 'ml-auto', 'pt-4', 'pr-2', 'pb-8', 'pl-3', '-mt-4', '-ml-2', 'mt-1/2',
  'pt-a5', '-left-b2', 'right-c0', 'left-0', 'left-1/2', 'right-auto', 'left-full',
  'border-l-2', 'border-r-0', 'grid-cols-3', 'grid-cols-12', 'columns-2',
  'w-100', 'h-100', 'opacity-50', 'opacity-100', 'opacity-0', 'z-10', 'z-0', '-z-10',
  'leading-tight', 'leading-none', 'items-baseline', 'align-middle', 'align-super',
  'justify-start', 'justify-between', 'justify-items-center', 'justify-self-end', 'self-baseline',
  'place-items-center', 'place-self-center', 'place-self-auto', 'place-self-stretch',
  'place-content-center', 'place-content-between', 'place-content-evenly', 'place-content-stretch',
  'bg-left', 'bg-right-top', 'object-left', 'origin-left', 'origin-top-right',
  'md:mt-4', 'md:-mt-4', 'lg:-ml-2', 'xl:-m-left-4', 'md:-left-b2', 'md:-z-10', 'md:pr-1/2',
  'md:place-self-center', 'md:place-content-center', 'md:justify-between', 'md:text-left',
  'print:hidden', 'before:content-none',
];

// The pair's own names: both axes (utility/place-self, place-content,
// place-items; C212 (2)) and the converted spellings themselves.
const OWN = [
  'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch',
  'content-start', 'content-end', 'content-center', 'content-between', 'content-around',
  'content-evenly', 'content-stretch', 'items-start', 'items-end', 'items-center', 'items-stretch',
  'md:self-center', 'lg:content-between', 'self-cross-center', 'content-cross-center',
  'self-main-end', 'content-main-between', '-md:m-top-4', 'z--1', 'md:z--1',
];

test('RG-TW-1: the pair\'s own names stay as written', () => {
  for (const token of OWN) assert.equal(convertTailwindClassToken(token), token, token);
});

test('RG-TW-1: place-self-* and place-content-* become the pair\'s both-axes names', () => {
  assert.equal(convertTailwindClassToken('place-self-center'), 'self-center');
  assert.equal(convertTailwindClassToken('place-content-between'), 'content-between');
  assert.equal(convertTailwindClassToken('md:place-self-end'), 'md:self-end');
  assert.equal(convertTailwindClassToken('self-baseline'), 'self-cross-baseline');
});

test('RG-TW-1: converting a converted name changes nothing', () => {
  for (const token of [...TAILWIND, ...OWN]) {
    const once = convertTailwindClassToken(token);
    assert.equal(convertTailwindClassToken(once), once, `${token} -> ${once}`);
  }
  const page = TAILWIND.join(' ');
  const once = convertTailwindClasses(page);
  assert.equal(convertTailwindClasses(once), once);
});

test('RG-TW-2: a negative value with a variant carries its sign before the variant', () => {
  assert.equal(convertTailwindClassToken('md:-mt-4'), '-md:m-top-4');
  assert.equal(convertTailwindClassToken('lg:-ml-2'), '-lg:m-inline-start-2');
  assert.equal(convertTailwindClassToken('md:-left-b2'), '-md:inline-start-b2');
  assert.equal(convertTailwindClassToken('-mt-4'), '-m-top-4');
  // The pair's one layer below the page is z--1 (utility/z-index).
  assert.equal(convertTailwindClassToken('-z-10'), 'z--1');
  assert.equal(convertTailwindClassToken('md:-z-10'), 'md:z--1');
});

// --- the build -------------------------------------------------------------
const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
const sheetsUnder = (dir) => !existsSync(dir) ? [] : readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sheetsUnder(path) : name.endsWith('.css') && !name.endsWith('.min.css') ? [path] : [];
});
const skip = distribution ? false : 'UI_CORE_ROOT names no build';

test('RG-TW-1: every converted name is a class the build serves', {skip}, () => {
  const rules = JSON.parse(readFileSync(join(distribution, 'rule/rule.json'), 'utf8'))
    .filter((rule) => rule.regex && (!rule.type || rule.type === 'utility'))
    .map((rule) => {
      const [, body, flags] = rule.regex.match(/^\/(.*)\/([a-z]*)$/su);
      return new RegExp(body, flags);
    });
  const core = new Set();
  for (const file of sheetsUnder(join(distribution, 'core/css'))) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/\.((?:\\.|[\w-])+)/gu)) core.add(name.replace(/\\/gu, ''));
  }
  const served = (name) => core.has(name) || rules.some((rule) => rule.test(name));
  const unserved = TAILWIND
    .map((token) => [token, convertTailwindClassToken(token)])
    .filter(([token, name]) => name !== token && !served(name));
  assert.deepEqual(unserved, [], 'converted to a name the pair does not serve');
});

test('RG-TW-3: ring-N alone draws in currentColor, outline-N alone draws solid', {skip}, () => {
  const core = sheetsUnder(join(distribution, 'core/css')).map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(core, /--sf-ring-color:\s*;/u, 'an empty ring colour hides the currentColor fallback');
  assert.match(core, /--sf-ring-color:\s*currentColor;/u);
  const outline = readFileSync(join(distribution, 'utility/outline-width/default/css/default.css'), 'utf8');
  assert.match(outline, /:where\(\.outline-2\)\s*\{\s*outline-style:\s*solid;/u);
});
