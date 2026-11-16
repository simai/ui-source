#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-confirm 1.3.6, owner decisions C183 (6) and C176 (DEV's answer
// msg-68999d65 on C116): the main answer of a plain question (no status) is
// filled primary -- drawn as an sf-button appearance="default" scheme="primary"
// beside it on the same page -- in the inline, card and window forms. A
// dangerous question (status="danger") keeps its filled danger answer (C25),
// and «Отмена» stays quiet, no fill and no border (C116). Measured on the
// computed style at 1440 and 390 px, light and dark, three loads each.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'smart/smart/confirm/css/confirm.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/confirm/js/confirm.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const transparent = (colour) => colour === 'transparent' || /rgba\([^)]*,\s*0\)$/u.test(colour);
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      for (let load = 1; load <= 3; load += 1) {
        const where = `${width} ${theme} load ${load}`;
        const page = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
        const errors = [];
        page.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(error.message)) errors.push(error.message); });
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await page.setContent(`<!doctype html><html class="${theme}" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px">
          <sf-button id="ref-primary" appearance="default" scheme="primary" size="1" text="Образец"></sf-button>
          <sf-button id="ref-danger" appearance="default" scheme="primary" status="danger" size="1" text="Образец"></sf-button>
          <sf-confirm id="plain-inline" question="Применить новый вид таблицы?" accept-text="Применить"></sf-confirm>
          <sf-confirm id="plain-card" appearance="card" question="Вернуть прежнюю версию?" accept-text="Вернуть"></sf-confirm>
          <sf-confirm id="plain-window" appearance="window" question="Опубликовать страницу?" accept-text="Опубликовать"></sf-confirm>
          <sf-confirm id="danger-inline" status="danger" question="Удалить файл?" accept-text="Удалить"></sf-confirm>
          <sf-confirm id="danger-card" appearance="card" status="danger" question="Удалить раздел?" accept-text="Удалить"></sf-confirm>
          <sf-confirm id="danger-window" appearance="window" status="danger" question="Удалить сайт?" accept-text="Удалить"></sf-confirm>
        </body></html>`);
        for (const style of styles) await page.addStyleTag({path: style});
        for (const module of modules) await page.addScriptTag({path: module, type: 'module'});
        await page.waitForFunction(() => document.querySelectorAll('sf-confirm button[data-action="accept"]').length === 6
          && document.querySelectorAll('sf-button[id^="ref-"] > button').length === 2);
        await page.waitForTimeout(150);
        const seen = await page.evaluate(() => {
          const look = (node) => {
            const style = getComputedStyle(node);
            const label = node.querySelector('.sf-button-text-container');
            return {background: style.backgroundColor, color: style.color, label: label ? getComputedStyle(label).color : null, border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
              appearance: node.closest('sf-button').getAttribute('appearance'), status: node.closest('sf-button').getAttribute('status')};
          };
          const result = {primary: look(document.querySelector('#ref-primary > button')), danger: look(document.querySelector('#ref-danger > button'))};
          for (const ask of document.querySelectorAll('sf-confirm')) {
            result[ask.id] = {accept: look(ask.querySelector('button[data-action="accept"]')), decline: look(ask.querySelector('button[data-action="decline"]'))};
          }
          result.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          return result;
        });
        if (transparent(seen.primary.background)) note(`${where}: the filled primary reference draws no fill`);
        for (const form of ['inline', 'card', 'window']) {
          const plain = seen[`plain-${form}`];
          const danger = seen[`danger-${form}`];
          for (const key of ['background', 'color', 'label', 'border']) {
            if (plain.accept[key] !== seen.primary[key]) note(`${where}: plain ${form} accepting answer ${key} ${plain.accept[key]}, filled primary ${seen.primary[key]}`);
            if (danger.accept[key] !== seen.danger[key]) note(`${where}: danger ${form} accepting answer ${key} ${danger.accept[key]}, filled danger ${seen.danger[key]}`);
          }
          if (plain.accept.status) note(`${where}: plain ${form} accepting answer has status ${plain.accept.status}`);
          if (danger.accept.status !== 'danger') note(`${where}: danger ${form} accepting answer lost status danger`);
          for (const [name, ask] of [['plain', plain], ['danger', danger]]) {
            if (ask.decline.appearance !== 'ghost') note(`${where}: ${name} ${form} «Отмена» is ${ask.decline.appearance}, not ghost`);
            if (!transparent(ask.decline.background)) note(`${where}: ${name} ${form} «Отмена» has a fill ${ask.decline.background}`);
            if (!/^0px|none/u.test(ask.decline.border) && !transparent(ask.decline.border.split(' ').slice(2).join(' '))) note(`${where}: ${name} ${form} «Отмена» has a border ${ask.decline.border}`);
          }
        }
        if (seen.overflow > 0) note(`${where}: page scrolls sideways by ${seen.overflow}px`);
        if (errors.length) note(`${where}: console ${errors.join(' | ')}`);
        if (load === 1) console.log(`${where}: plain ${seen['plain-inline'].accept.background} / danger ${seen['danger-inline'].accept.background} / cancel ${seen['plain-inline'].decline.background}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('CONFIRM_PRIMARY_OK');
