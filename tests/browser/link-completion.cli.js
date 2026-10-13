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
await page.emulateMedia({forcedColors: 'none', colorScheme: 'light'});
await page.setViewportSize({width: 1280, height: 800});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/link-method-lab.html');

check('bare native link is a complete component', await page.evaluate(() => {
  const link = document.querySelector('#plain');
  const style = getComputedStyle(link);
  return link instanceof HTMLAnchorElement
    && link.hasAttribute('href')
    && style.display === 'inline-flex'
    && style.color !== 'rgba(0, 0, 0, 0)'
    && style.textDecorationLine.includes('underline');
}));

check('canonical and legacy content inherit the root contract', await page.evaluate(() => {
  const canonical = document.querySelector('#structured');
  const legacy = document.querySelector('#legacy');
  const canonicalContent = getComputedStyle(canonical.querySelector('.sf-link__content'));
  const legacyContent = getComputedStyle(legacy.querySelector('.sf-link-content'));
  return canonicalContent.color === getComputedStyle(canonical).color
    && canonicalContent.fontSize === legacyContent.fontSize
    && canonicalContent.lineHeight === legacyContent.lineHeight
    && canonicalContent.textDecorationLine === legacyContent.textDecorationLine;
}));

const stateColors = await page.evaluate(() => {
  const link = document.querySelector('#trailing');
  return {defaultColor: getComputedStyle(link).color};
});
await page.locator('#trailing').hover();
stateColors.hoverColor = await page.locator('#trailing').evaluate(link => getComputedStyle(link).color);
const trailingBox = await page.locator('#trailing').boundingBox();
await page.mouse.move(trailingBox.x + trailingBox.width / 2, trailingBox.y + trailingBox.height / 2);
await page.mouse.down();
stateColors.activeColor = await page.locator('#trailing').evaluate(link => getComputedStyle(link).color);
await page.mouse.up();
check('hover and active use distinct semantic states', stateColors.defaultColor !== stateColors.hoverColor
  && stateColors.hoverColor !== stateColors.activeColor, JSON.stringify(stateColors));

await page.locator('#plain').click();
check('pointer focus does not display the keyboard ring', await page.locator('#plain').evaluate(link => {
  return !link.matches(':focus-visible') && getComputedStyle(link).outlineStyle === 'none';
}));

await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Tab');
check('keyboard focus is visible around the complete link', await page.locator('#plain').evaluate(link => {
  const style = getComputedStyle(link);
  return document.activeElement === link
    && link.matches(':focus-visible')
    && style.outlineStyle === 'solid'
    && Number.parseFloat(style.outlineWidth) > 0;
}));

check('leading and trailing icons keep intrinsic boxes and stay decorative', await page.evaluate(() => {
  return ['leading', 'trailing'].every(id => {
    const icon = document.querySelector(`#${id} .sf-link__icon`);
    const rect = icon.getBoundingClientRect();
    return icon.getAttribute('aria-hidden') === 'true'
      && rect.width > 0
      && Math.abs(rect.width - rect.height) < 0.5;
  });
}));

check('long localized label wraps inside its container', await page.evaluate(() => {
  const parent = document.querySelector('#long').parentElement;
  const link = document.querySelector('#long');
  const content = link.querySelector('.sf-link__content');
  return link.getBoundingClientRect().width <= parent.getBoundingClientRect().width + 0.5
    && content.getClientRects().length >= 1
    && link.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(link).lineHeight);
}));

check('external and download links preserve native attributes', await page.evaluate(() => {
  const external = document.querySelector('#external');
  const download = document.querySelector('#download');
  return external.target === '_blank'
    && external.relList.contains('noopener')
    && external.textContent.includes('новой вкладке')
    && download.hasAttribute('download');
}));

check('disabled destination cannot navigate or enter tab order', await page.evaluate(() => {
  const disabled = document.querySelector('#disabled');
  return disabled.getAttribute('aria-disabled') === 'true'
    && !disabled.hasAttribute('href')
    && disabled.tabIndex < 0
    && getComputedStyle(disabled).cursor === 'default';
}));

await page.evaluate(() => {
  document.documentElement.className = 'theme-dark';
  document.documentElement.dir = 'rtl';
});
await page.setViewportSize({width: 390, height: 844});
check('mobile dark RTL keeps logical composition without page overflow', await page.evaluate(() => {
  const leading = document.querySelector('#leading');
  const trailing = document.querySelector('#trailing');
  return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    && leading.firstElementChild.classList.contains('sf-link__icon')
    && trailing.lastElementChild.classList.contains('sf-link__icon');
}));

await page.emulateMedia({forcedColors: 'active'});
await page.locator('h1').hover();
await page.evaluate(() => document.querySelector('#plain').focus());
check('forced colors preserves underline and keyboard focus', await page.locator('#plain').evaluate(link => {
  const style = getComputedStyle(link);
  return matchMedia('(forced-colors: active)').matches
    && style.textDecorationLine.includes('underline')
    && style.outlineStyle === 'solid';
}));

check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests, stateColors};
}
