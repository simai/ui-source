import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

import {checkPackageRenderedTags, drawnTags} from '../scripts/package-rendered-tags-kit.mjs';

const root = new URL('../', import.meta.url).pathname;
const read = (name) => JSON.parse(readFileSync(join(root, 'src/core/contracts/packages', name), 'utf8'));

/* A Pro element gets the code of a Framework tag it draws only through its
   contract's requires (pro.package.json): sf-view-properties drew
   sf-input-lookup with no entry (pair ui-22690ab1c1dd). The kit reads what
   each element draws and names the tags no requirement reaches. */

test('a drawn tag is markup or createElement, never a comment or an event name', () => {
  const tags = drawnTags(`
    // <sf-ghost> in a comment
    /* document.createElement('sf-hidden') */
    const bar = doc.createElement('sf-progress-bar');
    this.addEventListener('sf-empty-state-action', run);
    return html\`<sf-icon name="x"></sf-icon><sf-button\n size="1">\`;
    const link = 'https://example.org/<sf-linked>';
  `);
  assert.deepEqual([...tags].sort(), ['sf-button', 'sf-icon', 'sf-linked', 'sf-progress-bar']);
});

test('a drawn tag no requirement reaches is a miss; one reached through another is not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-package-tags-'));
  try {
    const write = (folder, text) => {
      mkdirSync(join(dir, folder, 'js'), {recursive: true});
      writeFileSync(join(dir, folder, 'js', `${folder}.js`), text);
    };
    write('window', "const bar = document.createElement('sf-progress-bar'); html`<sf-message></sf-message><sf-icon></sf-icon>`;");
    write('message', 'html`<sf-avatar></sf-avatar>`;');
    const reference = {provides: [
      {id: 'smart.window', element: 'sf-window', folder: 'window', requires: ['smart.message']},
      {id: 'smart.message', element: 'sf-message', folder: 'message', requires: ['smart.avatar']},
    ]};
    const [window, message] = checkPackageRenderedTags({root, reference, packageRoot: dir});
    // sf-icon: sf-avatar's rule relates cl-icon, so the window reaches it.
    assert.deepEqual(window.missing, [{tag: 'sf-progress-bar', id: 'smart.progress-bar'}]);
    assert.deepEqual(message.missing, []);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

// The real package, where one is at hand: a release asset's smart/ folder in
// UI_PRO_PACKAGE_ROOT, else ui-pro's sources beside this checkout. A built
// asset is the stricter reading (its bundles hold what each element imports).
const packageRoot = process.env.UI_PRO_PACKAGE_ROOT || resolve(root, '../ui-pro/components/src/smart');
test('every Smart tag a Pro element draws is required by its pro.package.json entry', {skip: existsSync(packageRoot) ? false : `no Pro package at ${packageRoot}`}, () => {
  for (const name of ['pro.package.json', 'larena.package.json']) {
    const misses = checkPackageRenderedTags({root, reference: read(name), packageRoot})
      .flatMap((result) => result.missing.map(({tag, id}) => `${result.id} draws ${tag}, requires no ${id}`));
    assert.deepEqual(misses, [], `${name}: ${misses.join('; ')}`);
  }
});
