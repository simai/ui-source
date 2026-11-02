import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) out.push(...await walk(next));
    else out.push(next);
  }
  return out;
}

const files = await walk(SRC);
const read = async (url) => [url.pathname.slice(url.pathname.indexOf('/src/') + 5), await readFile(url, 'utf8')];

/* The old name said nothing about where it belongs, and the two roles that
   replaced it do. The name was removed on the sweep of 2026-11-01 (journal
   token-radius-default, token-radius-round): nothing declares or reads
   --sf-radius-default or --sf-radius-round. The component modifier
   .sf-button.radius-default (Smart radius="default") stays and reads the
   control role. */
test('radius: components read a role, not the removed names', async () => {
  const offenders = [];
  for (const url of files.filter((u) => u.pathname.endsWith('.scss'))) {
    const [name, source] = await read(url);
    const code = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
    if (/--sf-radius-(?:default|round)(?![-\w])/u.test(code)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'these still declare or read a removed radius name');
});

test('radius: nothing ships the deprecated utility class in its own markup', async () => {
  const offenders = [];
  for (const url of files.filter((u) => /\.(js|html)$/.test(u.pathname))) {
    const [name, source] = await read(url);
    if (/(?<![-\w])radius-default(?![-\w])/.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'these write radius-default into markup');
});

/* A role that resolves to the same step as the other one is a second name, not
   a role -- which is what the old token was. */
test('radius: the control role and the surface role stand on different steps', async () => {
  const border = await readFile(new URL('core/scss/_sf_css__border.scss', SRC), 'utf8');
  const ui = border.match(/--sf-radius--ui:\s*var\((--sf-radius[^)]*)\)/);
  const surface = border.match(/--sf-radius--surface:\s*var\((--sf-radius[^)]*)\)/);
  assert.ok(ui && surface, 'both roles must be declared there');
  assert.notEqual(ui[1], surface[1], 'the roles resolve to one step');
});
