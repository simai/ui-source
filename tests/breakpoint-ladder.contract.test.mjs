import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Every breakpoint threshold is a step of the size ladder, in rem, and its
// --sf-breakpoint-* variable names that same step. The media queries fired at
// 520/720/1140/1320px while the variables said 704/768/1152/1536px; only lg
// agreed (owner, 2026-10-13).
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every breakpoint threshold equals its --sf-breakpoint-* step', async () => {
  const thresholds = Object.fromEntries([...(await read('src/core/scss/vars/_sf_var__breakpoint.scss'))
    .matchAll(/^\s*(sm|md|lg|xl|xxl):\s*([\d.]+)rem\b/gmu)].map((m) => [m[1], Number(m[2])]));
  const steps = Object.fromEntries([...(await read('src/core/scss/_sf_css__breakpoint.scss'))
    .matchAll(/'(sm|md|lg|xl|xxl)'\s*:\s*'([a-z]\d)'/gu)].map((m) => [m[1], m[2]]));
  const ladder = await read('src/core/scss/vars/_sf_var__size.scss');
  // The ladder: a letter's map of digit -> rem value.
  const stepValue = (step) => {
    const letter = ladder.match(new RegExp(`\\b${step[0]}:\\s*\\(([^)]*)\\)`, 'u'))?.[1] ?? '';
    const value = letter.match(new RegExp(`\\b${step[1]}:\\s*([\\d.]+)rem`, 'u'))?.[1];
    return value === undefined ? NaN : Number(value);
  };
  assert.deepEqual(Object.keys(thresholds).sort(), ['lg', 'md', 'sm', 'xl', 'xxl']);
  assert.deepEqual(thresholds, {sm: 32, md: 44, lg: 60, xl: 72, xxl: 80});
  for (const [name, rem] of Object.entries(thresholds)) {
    assert.equal(stepValue(steps[name]), rem, `${name}: ${steps[name]} is ${stepValue(steps[name])}rem, the threshold ${rem}rem`);
  }
});

test('no media query is written at a retired pixel threshold', async () => {
  const {readdir} = await import('node:fs/promises');
  const walk = async (dir) => (await Promise.all((await readdir(new URL(`../${dir}`, import.meta.url), {withFileTypes: true}))
    .map((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name.endsWith('.scss') ? [`${dir}/${entry.name}`] : []))))
    .flat();
  const offenders = [];
  for (const file of await walk('src')) {
    const source = await read(file);
    if (/@(media|container)[^{]*\b(520|720|960|1140|1320)px/u.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
