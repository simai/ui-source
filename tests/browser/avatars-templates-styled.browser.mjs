#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-avatars draws every template -- default, user, label, group, profile --
// with classes the release sheets answer (docs report on pair ui-2d39b617a719,
// which read the retired template/*/index.html with sf-avatar-round and
// sf-avatar--image). On the built bytes:
// - every class in the rendered markup is named by a rule of a loaded sheet
//   (three shared hook classes excepted, named below);
// - every avatar is a circle of a ladder size (width = height > 0, radius 50%).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/avatars/css/avatars.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/avatars/js/avatars.js'];
const IMG = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2296%22 height=%2296%22%3E%3Crect width=%2296%22 height=%2296%22 fill=%22%233b82f6%22/%3E%3C/svg%3E';
const HOSTS = [
  `<sf-avatars data-t="default" image-url="${IMG}" round-size="2" active></sf-avatars>`,
  `<sf-avatars data-t="user" template="user" image-url="${IMG}" name="Анна Захарова" source="simai.ru" avatar-size="1"></sf-avatars>`,
  `<sf-avatars data-t="label" template="label" avatar-url="${IMG}" avatar-size="2" label-text="Команда проекта" label-second-text="5 участников"></sf-avatars>`,
  `<sf-avatars data-t="group" template="group" round-size="1" avatars-more="5"></sf-avatars>`,
  `<sf-avatars data-t="profile" template="profile" image-url="${IMG}" profile-size="big"></sf-avatars>`,
];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
let seen;
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
    ${HOSTS.map((host) => `<div style="margin-block:12px">${host}</div>`).join('')}</body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-avatars'), null, {timeout: 8000});
  await page.evaluate(() => { document.querySelector('[data-t="group"]').avatars = [{text: 'АЗ'}, {text: 'БИ'}]; });
  await page.waitForFunction(() => [...document.querySelectorAll('sf-avatars')].every((host) => host.querySelector('.sf-avatar'))
    && document.querySelectorAll('[data-t="group"] .sf-avatar').length >= 3, null, {timeout: 8000});
  await page.waitForTimeout(300);
  seen = await page.evaluate(() => {
    const selectors = [];
    const walk = (rules) => { for (const rule of rules) { if (rule.selectorText) selectors.push(rule.selectorText); if (rule.cssRules) walk(rule.cssRules); } };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
    const all = selectors.join('\n');
    // Hooks the shared avatar markup (avatar/js/templates/shared.js) writes for
    // a page's own CSS: the drawing is .sf-avatar--text, .sf-avatar-badge and
    // the online indicator element, which the sheet answers.
    const hooks = new Set(['sf-avatar-text', 'sf-avatar--status-icon-online-indicator', 'sf-avatar-badge--verified']);
    const named = (token) => hooks.has(token) || all.includes(`.${CSS.escape(token)}`);
    return [...document.querySelectorAll('sf-avatars')].map((host) => {
      const classes = new Set([...host.querySelectorAll('[class]')].flatMap((node) => [...node.classList]));
      const avatars = [...host.querySelectorAll('.sf-avatar')].map((node) => {
        const box = node.getBoundingClientRect();
        return {w: Math.round(box.width), h: Math.round(box.height), radius: getComputedStyle(node).borderTopLeftRadius};
      });
      return {template: host.dataset.t, unstyled: [...classes].filter((token) => !named(token)), avatars};
    });
  });
  for (const host of seen) {
    if (host.unstyled.length) note({template: host.template, case: 'every class is answered by a sheet', got: host.unstyled});
    for (const avatar of host.avatars) {
      if (!avatar.w || avatar.w !== avatar.h || !/^(50%|\d{3,}px)$/u.test(avatar.radius) && parseFloat(avatar.radius) < avatar.w / 2) {
        note({template: host.template, case: 'every avatar is a sized circle', got: avatar});
      }
    }
  }
  console.log(JSON.stringify(seen, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('AVATARS_TEMPLATES_STYLED_OK');
