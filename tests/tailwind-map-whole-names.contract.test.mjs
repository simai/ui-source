// The legacy utility alias map rewrites whole utility names only. A family
// prefix followed by anything is an author's own class: DEV's prototype rows
// pr-row were rewritten to p-inline-end-row at load (dropdown-panels study
// R193, 2026-11-12), and so were mt-section, right-panel and grid-cols-wrap.
import assert from 'node:assert/strict';
import test from 'node:test';
import {convertTailwindClassToken, convertTailwindClasses} from '../src/core/js/tailwind-map.js';

const kept = [
  'pr-row', 'pr-card', 'pl-item', 'pt-head', 'pb-foot',
  'mt-section', 'mr-gap', 'mb-x', 'ml-side', 'pl-auto', 'pr-auto',
  'm-left-side', 'p-right-col',
  'right-panel', 'left-col', 'left-nav-item',
  'grid-cols-wrap', 'grid-cols-',
  'border-l-accent', 'border-r-row', 'border-left-mark',
  'hover:pr-row', 'md:mt-section', '-mt-section', '-pt-1',
  // Off the ladder: a letter past i, a bare letter, or more than one digit.
  'pt-j1', 'pt-a', 'mr-a10', 'left-z9',
];

const rewritten = {
  'pr-1': 'p-inline-end-1', 'pr-2': 'p-inline-end-2', 'pr-0': 'p-inline-end-0',
  'pr-1/2': 'p-inline-end-1/2', 'pr-0.5': 'p-inline-end-0.5', 'pr-px': 'p-inline-end-px',
  'pr-[3px]': 'p-inline-end-[3px]',
  'pt-1/4': 'p-top-1/4', 'pb-8': 'p-bottom-8', 'pl-3': 'p-inline-start-3',
  'mt-2': 'm-top-2', 'mr-auto': 'm-inline-end-auto', 'ml-auto': 'm-inline-start-auto', '-mt-1': '-m-top-1',
  'm-left-2': 'm-inline-start-2', 'p-right-1/3': 'p-inline-end-1/3', '-m-right-4': '-m-inline-end-4',
  'right-0': 'inline-end-0', 'left-1/2': 'inline-start-1/2', 'left-full': 'inline-start-full', 'right-auto': 'inline-end-auto',
  'grid-cols-3': 'grid-col-3', 'grid-cols-none': 'grid-col-none',
  'border-l-2': 'border-inline-start-2', 'border-r-0': 'border-inline-end-0', 'border-right-solid': 'border-inline-end-solid',
  'md:pr-1/2': 'md:p-inline-end-1/2', 'hover:mt-1': 'hover:m-top-1',
  // The size ladder a0..i9 (DEV, core intent acceptance 2026-11-13: 1260 legacy
  // names such as pt-a5 and the documented -left-b2 had stopped resolving).
  'pt-a5': 'p-top-a5', 'mr-f9': 'm-inline-end-f9', 'pl-i9': 'p-inline-start-i9',
  '-left-b2': '-inline-start-b2', '-left-a4': '-inline-start-a4', 'right-c0': 'inline-end-c0',
  'p-left-d3': 'p-inline-start-d3', 'm-right-e1': 'm-inline-end-e1', 'md:mt-a1': 'md:m-top-a1',
};

test('a family prefix followed by a name is not a utility and stays as written', () => {
  for (const token of kept) assert.equal(convertTailwindClassToken(token), token, token);
});

test('whole legacy utility names are still rewritten', () => {
  for (const [token, expected] of Object.entries(rewritten)) {
    assert.equal(convertTailwindClassToken(token), expected, token);
  }
});

test('a class list keeps its own names and rewrites only the utilities', () => {
  assert.equal(convertTailwindClasses('pr-row flex pr-2'), 'pr-row flex p-inline-end-2');
  const untouched = 'pr-card mt-section right-panel';
  assert.equal(convertTailwindClasses(untouched), untouched);
});
