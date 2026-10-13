import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';

const bundle = JSON.parse(await readFile(new URL('../src/core/contracts/third-party-notices.v1.json', import.meta.url), 'utf8'));
const lock = await readFile(new URL('../yarn.lock', import.meta.url), 'utf8');

/* A notice that names a version the build did not use is worse than none: it
   states something untrue about what the reader received. */
test('notices: every version matches the dependency lock', () => {
  const wrong = [];
  for (const entry of bundle.entries) {
    for (const pkg of entry.packages) {
      const block = lock.split('\n\n').find((part) => {
        const head = part.trim().split('\n')[0] || '';
        return new RegExp(`(^|,\\s*)"?${pkg.name.replace(/[/@^$.*+?()[\]{}|\\]/g, '\\$&')}@`).test(head);
      });
      if (!block) continue; // шрифты и наборы ставятся не отсюда
      const version = (block.match(/^\s*version:?\s*"?([^"\s]+)"?/m) || [])[1];
      if (version !== pkg.version) wrong.push(`${pkg.name}: заявлено ${pkg.version}, в lock ${version}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('notices: each entry carries a copyright line and the licence text', () => {
  for (const entry of bundle.entries) {
    assert.ok(entry.spdx, `${entry.name}: нет SPDX`);
    assert.match(entry.copyright || '', /Copyright/i, `${entry.name}: нет копирайта`);
    assert.ok((entry.license_text || '').length > 200, `${entry.name}: текст лицензии не похож на лицензию`);
    assert.ok(Array.isArray(entry.ships_in) && entry.ships_in.length, `${entry.name}: не сказано, куда попадает`);
  }
});

/* Font Awesome Pro is a paid set whose licence does not allow the files to be
   redistributed, and the generated distribution is public. It was shipped for
   two months before anyone noticed, so the way back in is closed here. */
test('notices: no Font Awesome returns to the source', async () => {
  const src = new URL('../src/', import.meta.url);
  const found = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { await walk(next); continue; }
      if (/^fa-(brands|duotone|light|regular|solid)-\d+\./.test(entry.name)) { found.push(entry.name); continue; }
      if (!/\.(scss|css|js|json|md)$/.test(entry.name)) continue;
      const source = await readFile(next, 'utf8');
      if (/Font Awesome (Pro|Free|5|6)/i.test(source)) found.push(next.pathname.slice(next.pathname.indexOf('/src/') + 5));
    }
  };
  await walk(src);
  assert.deepEqual(found, []);
});

/* A distribution that states someone else's terms but not its own leaves the
   reader without the one permission they need: to use what they copied. */
test('notices: the distribution states its own licence too', async () => {
  const project = bundle.project;
  assert.ok(project, 'нет блока project');
  assert.equal(project.spdx, 'Apache-2.0');
  assert.match(project.copyright, /Copyright/);
  const own = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
  assert.equal(project.license_text.trim(), own.trim(), 'текст расходится с LICENSE источника');
});
