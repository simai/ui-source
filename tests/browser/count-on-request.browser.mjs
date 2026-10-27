#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// On the built bytes: what the view shows when the host does not count, what it
// asks for, and what it does with the answer.
// The words here are the Framework's defaults, which are English: this page
// names no language, and from 2026-10-10 a component that is not told one says
// so in English rather than in Russian. What the probe is about -- when a count
// is offered, asked for and shown -- is unchanged.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css',
  'core/core/css/utility.full.css',
  'component/component/pagination/css/pagination.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/icon-button/js/icon-button.js',
  'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/input/js/input.js',
  'smart/smart/spinner/js/spinner.js',
  'smart/smart/pagination/js/pagination.js',
].map((p) => join(out, p));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

const open = async (attributes) => {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html class="theme-light"><body style="margin:0">
       <sf-pagination id="p" ${attributes}></sf-pagination>
     </body></html>`,
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.asked = [];
    document.getElementById('p').addEventListener('sf-count-request', (event) => window.asked.push(event.detail.reason));
    window.pages = [];
    document.getElementById('p').addEventListener('sf-page-change', (event) => window.pages.push(event.detail.current));
  });
  return page;
};

const look = (page) => page.evaluate(() => {
  const element = document.getElementById('p');
  const total = element.querySelector('.sf-pagination-total');
  return {
    text: (total?.textContent ?? '').replace(/\s+/gu, ' ').trim(),
    link: Boolean(total?.querySelector('.sf-pagination-count-request')),
    spinner: Boolean(total?.querySelector('sf-spinner')),
    // The footer stopped saying how many are marked on 2026-10-05: the band of
    // bulk controls says it, and only while something is marked.
    marked: Boolean(element.querySelector('.sf-pagination-marked')),
    field: element.querySelector('.sf-pagination-page-input input')?.value ?? null,
    places: [...element.querySelectorAll('.sf-pagination-list .sf-page-number')].length,
    next: Boolean(element.querySelector('.sf-pagination-direction--next')),
    last: Boolean(element.querySelector('.sf-pagination-direction--last')),
    showMore: Boolean(element.querySelector('.sf-pagination-more sf-button')),
    asked: [...window.asked],
  };
});

try {
  // 1. No count, and a host that can answer for it: a link in place of the
  // number, and the switcher works from has_next alone.
  const page = await open('total="0" count-known="false" can-count="true" has-next="true" current="3" page-size="10" selected-count="2" actions="archive:В архив" show-action-for-all="true"');
  let shown = await look(page);
  if (!shown.link) note({case: 'unknown count', text: shown.text, expected: 'an offer to find out'});
  if (!/Show the number/u.test(shown.text)) note({case: 'unknown count', text: shown.text, expected: 'the label of the offer'});
  if (/Total: \d/u.test(shown.text)) note({case: 'unknown count', text: shown.text, expected: 'no number invented'});
  if (shown.marked) note({case: 'unknown count', expected: 'the footer does not say how many are marked'});
  // The row of numbers was replaced by the page field, so an unknown count has
  // nothing left to invent: the field says 3 and the arrows do the rest.
  if (shown.places !== 0 || shown.field !== '3') {
    note({case: 'unknown count', got: {places: shown.places, field: shown.field}, expected: 'no numbers, the page in the field'});
  }
  if (!shown.next || !shown.last) note({case: 'unknown count', expected: 'forward and last from has_next'});
  if (!shown.showMore) note({case: 'unknown count', expected: 'Show more from has_next'});

  // 2. The link asks, and while the answer is on its way there is a short wait.
  // The hosts are display: contents, so a click goes to the real button inside.
  await page.evaluate(() => document.querySelector('.sf-pagination-count-request button').click());
  await page.waitForTimeout(200);
  shown = await look(page);
  if (String(shown.asked) !== 'total') note({case: 'asking', asked: shown.asked, expected: 'one request, reason total'});
  if (!shown.spinner) note({case: 'asking', text: shown.text, expected: 'a short wait in place of the number'});
  if (shown.link) note({case: 'asking', expected: 'the offer is gone while it is being answered'});

  // A second press while one is in flight asks nothing more.
  await page.evaluate(() => document.getElementById('p').requestCount('total'));
  await page.waitForTimeout(120);
  if ((await look(page)).asked.length !== 1) note({case: 'asking', expected: 'no second request while one is in flight'});

  // 3. The answer arrives: the number replaces the wait.
  await page.evaluate(() => {
    const element = document.getElementById('p');
    element.setAttribute('total', '450');
    element.setAttribute('count-known', 'true');
    element.removeAttribute('counting');
  });
  await page.waitForTimeout(250);
  shown = await look(page);
  if (!/Total: 450/u.test(shown.text)) note({case: 'answered', text: shown.text, expected: 'the number'});
  if (shown.spinner || shown.link) note({case: 'answered', expected: 'no wait and no offer once it is known'});
  if (shown.marked) note({case: 'answered', expected: 'still no marked count in the footer'});
  await page.close();

  // 4. Last page, with no count: it is asked for, with its reason, and no jump
  // happens on its own.
  const lastly = await open('total="0" count-known="false" can-count="true" has-next="true" current="4" page-size="10"');
  await lastly.evaluate(() => document.querySelector('.sf-pagination-direction--last button').click());
  await lastly.waitForTimeout(200);
  const jumped = await lastly.evaluate(() => ({asked: [...window.asked], pages: [...window.pages]}));
  if (String(jumped.asked) !== 'last-page') note({case: 'last page', asked: jumped.asked, expected: 'the count, with reason last-page'});
  if (jumped.pages.length) note({case: 'last page', pages: jumped.pages, expected: 'no jump before the number arrives'});
  // With the number in hand the jump lands where it should.
  await lastly.evaluate(() => {
    const element = document.getElementById('p');
    element.setAttribute('total', '450');
    element.setAttribute('count-known', 'true');
    element.removeAttribute('counting');
    element.lastPage();
  });
  await lastly.waitForTimeout(200);
  const landed = await lastly.evaluate(() => [...window.pages]);
  if (String(landed) !== '45') note({case: 'last page', pages: landed, expected: 'page 45 once the number is known'});
  await lastly.close();

  // 5. For-all asks for the number it would be applied against.
  const forAll = await open('total="0" count-known="false" can-count="true" has-next="true" current="1" page-size="10" selected-count="3" actions="archive:В архив" show-action-for-all="true"');
  const label = await forAll.evaluate(() => {
    const box = document.querySelector('.sf-pagination-actions sf-checkbox');
    return box?.getAttribute('label') ?? null;
  });
  if (label !== 'For all') note({case: 'for all', label, expected: 'no number in the label until there is one'});
  await forAll.evaluate(() => {
    const box = document.querySelector('.sf-pagination-actions sf-checkbox input[type="checkbox"]')
      ?? document.querySelector('.sf-pagination-actions sf-checkbox');
    box.click();
  });
  await forAll.waitForTimeout(250);
  const asked = await forAll.evaluate(() => [...window.asked]);
  if (String(asked) !== 'action-for-all') note({case: 'for all', asked, expected: 'the count, with reason action-for-all'});
  await forAll.close();

  // 6. A host that cannot count is offered nothing at all.
  const mute = await open('total="0" count-known="false" can-count="false" has-next="true" current="2" page-size="10"');
  const quiet = await look(mute);
  if (quiet.link || /Show the number/u.test(quiet.text) || quiet.text) {
    note({case: 'no capability', text: quiet.text, expected: 'nothing where the number would be'});
  }
  if (!quiet.next) note({case: 'no capability', expected: 'the switcher still works from has_next'});
  await mute.evaluate(() => document.getElementById('p').requestCount('total'));
  await mute.waitForTimeout(120);
  if ((await look(mute)).asked.length) note({case: 'no capability', expected: 'and nothing is ever asked'});
  await mute.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('COUNT_ON_REQUEST_OK');
