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
await page.setViewportSize({width: 1280, height: 800});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/kbd-method-lab.html');

check('native kbd and class fallback share the visual contract', await page.evaluate(() => {
  const nativeStyle = getComputedStyle(document.querySelector('#single kbd'));
  const fallbackStyle = getComputedStyle(document.querySelector('#fallback .sf-kbd'));
  return nativeStyle.display === 'inline-flex'
    && nativeStyle.fontFamily === fallbackStyle.fontFamily
    && nativeStyle.fontSize === fallbackStyle.fontSize
    && nativeStyle.lineHeight === fallbackStyle.lineHeight
    && nativeStyle.borderRadius === fallbackStyle.borderRadius;
}));

check('keycap typography and radius resolve from semantic tokens', await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const style = getComputedStyle(document.querySelector('#single kbd'));
  const toPixels = value => value.endsWith('rem')
    ? Number.parseFloat(value) * Number.parseFloat(root.fontSize)
    : Number.parseFloat(value);
  return Number.parseFloat(style.fontSize) === toPixels(root.getPropertyValue('--sf-text-size-1/3').trim())
    && Number.parseFloat(style.lineHeight) === toPixels(root.getPropertyValue('--sf-text-height-1/3').trim())
    && Number.parseFloat(style.borderRadius) === toPixels(root.getPropertyValue('--sf-radius--ui').trim());
}));

check('a short key has a nonzero minimum square', await page.evaluate(() => {
  const rect = document.querySelector('#fallback .sf-kbd').getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.width >= rect.height - 1;
}));

check('long labels stay unwrapped and content-sized', await page.evaluate(() => {
  const key = document.querySelector('#long kbd');
  const style = getComputedStyle(key);
  const rect = key.getBoundingClientRect();
  return style.whiteSpace === 'nowrap' && rect.width > rect.height;
}));

check('explicit chord group is visually neutral and keeps nested keycaps', await page.evaluate(() => {
  const group = document.querySelector('#chord');
  const groupStyle = getComputedStyle(group);
  const keyStyle = getComputedStyle(group.querySelector('kbd'));
  return groupStyle.backgroundColor.endsWith(', 0)')
    && groupStyle.borderTopWidth === '0px'
    && groupStyle.fontFamily === getComputedStyle(group.parentElement).fontFamily
    && ['inline-flex', 'flex'].includes(keyStyle.display)
    && Number.parseFloat(keyStyle.borderTopWidth) > 0;
}));

check('native nested kbd is recognized as a neutral group', await page.evaluate(() => {
  const group = document.querySelector('#native-chord');
  const style = getComputedStyle(group);
  return style.display === 'inline-flex'
    && style.backgroundColor.endsWith(', 0)')
    && style.borderTopWidth === '0px'
    && ['inline-flex', 'flex'].includes(getComputedStyle(group.querySelector('kbd')).display);
}));

check('sequence remains separate semantic key units', await page.evaluate(() => {
  const sequence = document.querySelector('#sequence');
  return sequence.querySelectorAll(':scope > kbd').length === 2
    && sequence.textContent.includes('затем');
}));

check('Kbd never enters the tab order', await page.evaluate(() => {
  return [...document.querySelectorAll('kbd, .sf-kbd')].every(node => node.tabIndex < 0);
}));

check('instruction text remains selectable', await page.evaluate(() => {
  return [...document.querySelectorAll('kbd, .sf-kbd')].every(node => getComputedStyle(node).userSelect !== 'none');
}));

await page.evaluate(() => {
  document.documentElement.className = 'theme-dark';
  document.documentElement.dir = 'rtl';
});
await page.setViewportSize({width: 390, height: 844});
check('mobile dark RTL has visible keycaps and no page overflow', await page.evaluate(() => {
  const key = document.querySelector('#single kbd');
  const style = getComputedStyle(key);
  return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    && style.color !== style.backgroundColor
    && Number.parseFloat(style.borderTopWidth) > 0;
}));

await page.emulateMedia({forcedColors: 'active'});
check('forced colors preserves the keycap boundary', await page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('#single kbd'));
  return matchMedia('(forced-colors: active)').matches
    && style.borderTopStyle === 'solid'
    && Number.parseFloat(style.borderTopWidth) > 0;
}));

check('no external requests', externalRequests.length === 0, externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
