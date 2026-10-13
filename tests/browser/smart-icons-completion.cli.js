async page => {
const results = [];
const check = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const errors = [];
const externalRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error') errors.push(event.text());
});
page.on('request', request => {
  const url = request.url();
  if (!url.startsWith('http://127.0.0.1:8766/')) externalRequests.push(url);
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
await page.route('**/subset-unavailable/**', route => {
  const requestUrl = route.request().url();
  const rounded = requestUrl.includes('type=rounded');
  const sharp = requestUrl.includes('type=sharp');
  const family = rounded ? 'Material Icons Round' : sharp ? 'Material Icons Sharp' : 'Material Symbols Outlined';
  const file = rounded ? 'MaterialIconsRound-Regular.otf' : sharp ? 'MaterialIconsSharp-Regular.otf' : 'MaterialSymbols-Outlined.woff2';
  const format = rounded || sharp ? 'opentype' : 'woff2';
  const selector = rounded
    ? '.sf-icon:is(.sf-icon--rounded, .sf-icon-rounded)'
    : sharp
      ? '.sf-icon:is(.sf-icon--sharp, .sf-icon-shape)'
      : '.sf-icon:not(.sf-icon--rounded):not(.sf-icon-rounded):not(.sf-icon--sharp):not(.sf-icon-shape)';
  const fontUrl = `http://127.0.0.1:8766/ui-source/source/output/icons-browser/component/icons/fonts/${file}`;

  return route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: `@font-face { font-family: '${family}'; src: url('${fontUrl}') format('${format}'); font-style: normal; font-weight: 100 700; font-display: block; }\n${selector} { --sf-icon--font-family: '${family}'; font-family: '${family}'; }`
  });
});

await page.setViewportSize({width: 390, height: 844});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/smart-icons-loader-lab.html');
await page.waitForFunction(() => customElements.get('sf-icon'));
await page.waitForFunction(() => [...document.querySelectorAll('.sf-icon')].every(icon => icon.classList.contains('sf-icon-loaded')));

check('all exact local family packets load', await page.locator('.sf-icon-loaded').count() === 22);
check('decorative icon is hidden from accessibility tree', await page.evaluate(() => {
  const glyph = document.querySelector('#decorative .sf-icon');
  return glyph?.getAttribute('aria-hidden') === 'true' && !glyph?.hasAttribute('role') && !glyph?.hasAttribute('aria-label');
}));
check('informative icon has image semantics and name', await page.evaluate(() => {
  const glyph = document.querySelector('#informative .sf-icon');
  return glyph?.getAttribute('role') === 'img' && glyph?.getAttribute('aria-label') === 'Проверено' && !glyph?.hasAttribute('aria-hidden');
}));
check('icon inside named button stays decorative', await page.evaluate(() => {
  const glyph = document.querySelector('#button-icon .sf-icon');
  return glyph?.getAttribute('aria-hidden') === 'true' && glyph?.closest('button')?.getAttribute('aria-label') === 'Добавить';
}));
check('rounded family and axes are rendered', await page.evaluate(() => {
  const glyph = document.querySelector('#rounded .sf-icon');
  const settings = getComputedStyle(glyph).fontVariationSettings;
  return glyph?.classList.contains('sf-icon--rounded')
    && glyph?.classList.contains('sf-icon--filled')
    && glyph?.classList.contains('sf-icon--weight-medium')
    && settings.includes('500')
    && settings.includes('-25')
    && settings.includes('40');
}));
check('sharp family is rendered', await page.evaluate(() => document.querySelector('#sharp .sf-icon')?.classList.contains('sf-icon--sharp')));
check('ordinary semantics and inherited color are preserved', await page.evaluate(() => {
  const decorative = document.querySelector('#ordinary-decorative');
  const informative = document.querySelector('#ordinary-informative');
  return decorative?.getAttribute('aria-hidden') === 'true'
    && informative?.getAttribute('role') === 'img'
    && informative?.getAttribute('aria-label') === 'Проверено'
    && getComputedStyle(decorative).color === getComputedStyle(decorative.parentElement.parentElement).color;
}));
check('ordinary defaults produce valid axes and unit line height', await page.evaluate(() => {
  const glyph = document.querySelector('#ordinary-decorative');
  const style = getComputedStyle(glyph);
  return style.fontVariationSettings !== 'normal'
    && style.fontVariationSettings.includes('24')
    && Number.parseFloat(style.lineHeight) === Number.parseFloat(style.fontSize);
}));
check('canonical and legacy modifiers resolve to the same descriptor', await page.evaluate(() => {
  const canonical = getComputedStyle(document.querySelector('#ordinary-rounded'));
  const legacy = getComputedStyle(document.querySelector('#legacy-rounded'));
  return canonical.fontFamily === legacy.fontFamily
    && canonical.fontVariationSettings === legacy.fontVariationSettings;
}));
check('the complete closed size scale has intrinsic geometry', await page.evaluate(() => {
  const sizes = [...document.querySelectorAll('#ordinary-sizes .sf-icon')].map(icon => icon.getBoundingClientRect().width);
  return sizes.length === 10 && sizes.every(size => size > 0) && sizes.every((size, index) => index === 0 || size >= sizes[index - 1]);
}));
check('rotation is visual and keeps intrinsic geometry', await page.evaluate(() => {
  const glyph = document.querySelector('#rotated');
  const style = getComputedStyle(glyph);
  const rect = glyph.getBoundingClientRect();
  return style.transform !== 'none' && Math.abs(rect.width - rect.height) < 0.5;
}));
check('token size is nonzero and stable', await page.evaluate(() => {
  const before = window.iconLab.beforeUpgrade.rounded;
  const glyph = document.querySelector('#rounded .sf-icon').getBoundingClientRect();
  return before.width > 0 && before.height > 0 && glyph.width > 0 && glyph.height > 0
    && Math.abs(before.width - glyph.width) < 0.5
    && Math.abs(before.height - glyph.height) < 0.5;
}));

await page.locator('#change-icon').click();
await page.waitForFunction(() => {
  const icon = document.querySelector('#decorative');
  return window.iconLab.changed && icon?.querySelector('.sf-icon-loaded')?.textContent.trim() === 'search';
});
check('dynamic descriptor change reloads cumulatively', await page.evaluate(() => {
  const glyph = document.querySelector('#decorative .sf-icon');
  const settings = getComputedStyle(glyph).fontVariationSettings;
  return glyph?.classList.contains('sf-icon--rounded') && settings.includes('200') && settings.includes('48');
}));
await page.waitForFunction(() => document.querySelector('#ordinary-dynamic')?.classList.contains('sf-icon-loaded'));
check('dynamic ordinary icon and changed ligature are tracked', await page.evaluate(() => {
  return document.querySelector('#ordinary-dynamic')?.textContent.trim() === 'add'
    && document.querySelector('#ordinary-sharp')?.classList.contains('sf-icon-loaded')
    && document.querySelector('#ordinary-sharp')?.textContent.trim() === 'search';
}));

await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme keeps a visible semantic color', await page.evaluate(() => {
  const color = getComputedStyle(document.querySelector('#informative .sf-icon')).color;
  return color && color !== 'rgba(0, 0, 0, 0)';
}));
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
