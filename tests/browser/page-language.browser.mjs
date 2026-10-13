#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/smart /absolute/path/to/distr
// The Framework speaks English by default and Russian on a Russian page. Each
// component is rendered on a page with no lang and on a page with lang="ru",
// and its own words are read back.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[3]) throw new Error('Smart output root and distr root are required');
const smartRoot = resolve(process.argv[2]);
const distrRoot = resolve(process.argv[3]);
const expected = {
  '': {tag: 'Remove', phone: 'Phone number'},
  ru: {tag: 'Удалить', phone: 'Телефон'},
};
const browser = await chromium.launch();
const failures = [];
try {
  for (const [lang, words] of Object.entries(expected)) {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.evaluate((lang) => { if (lang) document.documentElement.lang = lang; }, lang);
    await page.addScriptTag({path: join(distrRoot, 'core', 'js', 'smart-base.js')});
    for (const name of ['tags', 'country-code']) await page.addScriptTag({path: join(smartRoot, name, 'js', `${name}.js`)});
    const seen = await page.evaluate(async () => {
      document.body.innerHTML = '<sf-tag kind="default" closable text="A"></sf-tag><sf-country-code></sf-country-code>';
      await new Promise((settle) => setTimeout(settle, 300));
      const tag = document.querySelector('sf-tag');
      const phone = document.querySelector('sf-country-code');
      return {
        tag: tag.closeLabel,
        tagRendered: [...document.querySelectorAll('.sf-tag [aria-label], sf-tag [aria-label]')].map((node) => node.getAttribute('aria-label')).join(' | '),
        phone: phone.locale,
      };
    });
    await page.close();
    const where = lang ? `lang="${lang}"` : 'no lang';
    if (seen.tag !== words.tag) failures.push(`${where}: sf-tag closeLabel ${seen.tag}, expected ${words.tag}`);
    if (!seen.tagRendered.includes(words.tag)) failures.push(`${where}: sf-tag renders "${seen.tagRendered}", expected ${words.tag}`);
    if (seen.phone !== (lang || 'en')) failures.push(`${where}: sf-country-code locale ${seen.phone}`);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
