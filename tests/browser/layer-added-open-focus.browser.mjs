#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build/output
//
// A drawer or a window put into the page already open gives focus back to what
// opened it -- the button that inserted it -- not to the nearest landmark. The
// "added already open" path registered the layer without remembering the opener
// (ui-view property view, 2026-11-09), while open() and the open attribute did.
// On the built bytes, for sf-drawer (modal and modeless) and sf-modal:
//   - inserted open from a button press, closed by Escape: focus is the button;
//   - inserted open, closed by its close button: focus is the button;
//   - open() and the open attribute on a drawer/window already in the page
//     still give focus back to the button;
//   - a drawer/window open in the page's own markup, with nothing focused,
//     closes to the landmark as before (no opener to return to);
//   - each page load three times, no page error and no console error.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/modal/css/modal.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'smart/smart/drawer/css/drawer.css',
];
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/drawer/js/drawer.js', 'smart/smart/modal/js/modal.js',
];
const absent = [...styles, ...modules].map((p) => join(out, p)).filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const html = (theme) => '<!doctype html><html class="theme-' + theme + '" lang="ru"><head><meta charset="utf-8">'
  + styles.map((p) => `<link rel="stylesheet" href="/${p}">`).join('')
  + '</head><body style="margin:0;padding:40px">'
  + '<main id="main"><section id="region" aria-label="Действия">'
  + '<button id="opener" type="button">Открыть</button><button id="other" type="button">Другое</button>'
  + '</section></main>'
  + '<sf-drawer id="static-drawer" title="В разметке"><p>Текст</p></sf-drawer>'
  + '<sf-modal id="static-modal" modal-id="static-modal" title="В разметке" show-footer="false"><p slot="content">Текст</p></sf-modal>'
  + modules.map((p) => `<script type="module" src="/${p}"></script>`).join('')
  + '</body></html>';

const failures = [];
const missing = new Set();
const evidence = [];
const expect = (name, got, wanted) => {
  evidence.push({case: name, got, wanted});
  if (got !== wanted) failures.push({case: name, got, expected: wanted});
};

// How a layer is opened, and how it is closed.
const kinds = [
  {tag: 'sf-drawer', attrs: 'title="Панель"', label: 'drawer modal'},
  {tag: 'sf-drawer', attrs: 'title="Панель" modal="false"', label: 'drawer modeless'},
  {tag: 'sf-modal', attrs: 'title="Окно" show-footer="false"', label: 'modal'},
];
const routes = ['inserted-open', 'open()', 'open-attribute'];
const closes = ['escape', 'close-button'];

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const origin = 'http://probe.test';
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html(theme)});
      // The loader asks for what a page needs under the distribution's base
      // (/core/<group>/...); the build lays each group at <group>/<group>/.
      const asked = decodeURIComponent(url.pathname).replace(/^\/core\/(component|utility|smart)\//u, '/$1/$1/');
      const path = join(out, asked);
      return existsSync(path)
        ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
        : (missing.add(url.pathname), route.fulfill({status: 404, body: ''}));
    });
    page.on('pageerror', (error) => failures.push({case: `${theme}: page error`, said: error.message}));
    page.on('console', (message) => { if (message.type() === 'error') failures.push({case: `${theme}: console error`, said: message.text()}); });

    for (let load = 1; load <= 3; load += 1) {
      await page.goto(`${origin}/`);
      await page.waitForFunction(() => customElements.get('sf-drawer') && customElements.get('sf-modal'));
      await page.waitForTimeout(400);
      const tag = `${theme} load ${load}`;

      // Open in the page's own markup with nothing focused: no opener, the
      // landmark takes focus as before.
      for (const id of ['static-drawer', 'static-modal']) {
        const where = await page.evaluate(async (id) => {
          const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise(requestAnimationFrame); };
          document.activeElement?.blur?.();
          const layer = document.getElementById(id);
          layer.remove();
          layer.setAttribute('open', '');
          document.body.append(layer);
          await settle();
          await new Promise((done) => setTimeout(done, 200));
          layer.close();
          await settle();
          await new Promise((done) => setTimeout(done, 300));
          return document.activeElement?.id || document.activeElement?.tagName;
        }, id);
        expect(`${tag}: ${id} open in markup, nothing focused, closes to`, where === 'opener' ? 'opener' : 'not the opener', 'not the opener');
      }

      for (const kind of kinds) for (const route of routes) for (const close of closes) {
        const name = `${tag}: ${kind.label}, ${route}, ${close}`;
        await page.evaluate(async ({kind, route}) => {
          const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise(requestAnimationFrame); };
          document.querySelectorAll('.probe-layer').forEach((node) => node.remove());
          await settle();
          const opener = document.getElementById('opener');
          const make = (open) => {
            const holder = document.createElement('div');
            holder.innerHTML = `<${kind.tag} class="probe-layer" ${kind.attrs} ${open ? 'open' : ''}><p slot="content">Текст</p><button type="button" class="inside">Внутри</button></${kind.tag}>`;
            return holder.firstElementChild;
          };
          if (route !== 'inserted-open') { document.body.append(make(false)); await settle(); }
          // A person's press: the button takes focus, then its click opens the layer.
          opener.onclick = () => {
            if (route === 'inserted-open') document.body.append(make(true));
            else if (route === 'open()') document.querySelector('.probe-layer').open();
            else document.querySelector('.probe-layer').setAttribute('open', '');
          };
          opener.focus();
          opener.click();
          opener.onclick = null;
          await settle();
          await new Promise((done) => setTimeout(done, 300));
        }, {kind, route});
        const opened = await page.evaluate(() => {
          const layer = document.querySelector('.probe-layer');
          return Boolean(layer?.openState) && document.activeElement?.id !== 'opener';
        });
        const modeless = kind.label === 'drawer modeless';
        // A modal layer takes focus; a modeless drawer leaves it on the page,
        // so focus is moved into it as a person would before closing.
        if (!opened && !modeless) failures.push({case: `${name}: opened and took focus`, got: false});
        if (close === 'escape') {
          await page.evaluate(() => {
            const layer = document.querySelector('.probe-layer');
            const root = layer.getDrawerRoot?.() || layer.modalRoot || layer;
            const inside = root.querySelector('button.inside') || root.querySelector('[data-sf-drawer-panel], [role="dialog"]');
            inside?.focus?.();
          });
          await page.keyboard.press('Escape');
        } else {
          await page.evaluate(() => {
            const layer = document.querySelector('.probe-layer');
            const root = layer.getDrawerRoot?.() || layer.modalRoot || layer;
            const button = root.querySelector('[data-sf-drawer-close], [data-sf-modal-close]');
            button.focus();
            button.click();
          });
        }
        await page.waitForTimeout(500);
        const result = await page.evaluate(() => ({
          open: Boolean(document.querySelector('.probe-layer')?.openState),
          focus: document.activeElement?.id || document.activeElement?.tagName,
        }));
        expect(`${name}: closed`, result.open, false);
        expect(`${name}: focus back on`, result.focus, 'opener');
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const summary = {checked: evidence.length, failures: failures.length, missing: [...missing]};
console.log(JSON.stringify({summary, failures, evidence: process.env.SF_PROBE_VERBOSE ? evidence : undefined}, null, 2));
if (failures.length) process.exit(1);
