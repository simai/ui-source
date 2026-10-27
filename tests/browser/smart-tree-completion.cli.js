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

await page.setViewportSize({width: 1024, height: 768});
await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/smart-tree-loader-lab.html');
await page.waitForFunction(() => customElements.get('sf-tree'));
await page.waitForFunction(() => document.querySelectorAll('#tree [role="treeitem"]').length === 5);
await page.waitForFunction(() => [...document.querySelectorAll('#tree .sf-icon')].every(icon => icon.classList.contains('sf-icon-loaded')));

check('root has accessible tree semantics', await page.evaluate(() => {
  const root = document.querySelector('#tree > .sf-tree');
  return root?.getAttribute('role') === 'tree' && root?.getAttribute('aria-label') === 'Разделы документации';
}));
// sf-tree draws its entries flat (standard 1.3.8 §18.4): a level is aria-level.
check('open children say their level', await page.locator('#tree [role="treeitem"][aria-level="2"]').count() === 2);
check('tree exposes exactly one tab stop', await page.locator('#tree [role="treeitem"][tabindex="0"]').count() === 1);
check('disclosure and node icons are visible', await page.evaluate(() => [...document.querySelectorAll('#tree .sf-icon')].every(icon => getComputedStyle(icon).fontSize !== '0px')));

await page.locator('#tree [role="treeitem"][tabindex="0"]').focus();
await page.keyboard.press('ArrowDown');
check('ArrowDown moves to next visible node', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Цвет'));
await page.keyboard.press('ArrowDown');
check('second ArrowDown reaches closed branch', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Типографика'));
await page.keyboard.press('ArrowRight');
await page.waitForFunction(() => document.activeElement?.getAttribute('aria-expanded') === 'true');
check('ArrowRight opens a closed branch', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Типографика'));
check('newly open level says its level', await page.locator('#tree [role="treeitem"][aria-level="3"]').count() === 2);
await page.keyboard.press('ArrowRight');
check('ArrowRight enters first child', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Шрифт'));
await page.keyboard.press('ArrowLeft');
check('ArrowLeft returns to parent', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Типографика'));
await page.keyboard.press('End');
check('End reaches last visible node', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Закрытый раздел'));
await page.keyboard.press('Home');
check('Home returns to first visible node', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Основы'));
await page.evaluate(() => {
  document.activeElement.dispatchEvent(
    new KeyboardEvent('keydown', {key: 'К', bubbles: true, composed: true}),
  );
});
check('typeahead moves focus by label', await page.evaluate(() => document.activeElement?.querySelector(':scope > .sf-tree-item-container .sf-tree-item-name')?.textContent.trim() === 'Компоненты'));
await page.keyboard.press('Space');
await page.waitForFunction(() => document.querySelector('#events').textContent === 'components:true');
check('Space changes selection without expansion', await page.evaluate(() => {
  const item = document.activeElement;
  return item?.querySelector('.sf-tree-item-name')?.textContent.trim() === 'Компоненты' && item?.getAttribute('aria-selected') === 'true';
}));

await page.locator('#add-node').click();
await page.waitForFunction(() => [...document.querySelectorAll('#tree [role="treeitem"]')].some(item => item.textContent.trim() === 'Динамический раздел'));
check('dynamic top-level node is captured and rendered', await page.evaluate(() => [...document.querySelectorAll('#tree [role="treeitem"]')].some(item => item.textContent.trim() === 'Динамический раздел')));

await page.evaluate(() => document.documentElement.className = 'theme-dark');
check('dark theme retains semantic row paint', await page.evaluate(() => {
  const row = document.querySelector('#tree [role="treeitem"] .sf-tree-item-container');
  return getComputedStyle(row).color !== 'rgba(0, 0, 0, 0)';
}));
await page.setViewportSize({width: 390, height: 844});
check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
check('only the approved dynamic icon subset service is external', externalRequests.every(url => url.startsWith('https://icons.simai.io/ms/')), externalRequests.join('\n'));
check('no runtime errors', errors.length === 0, errors.join('\n'));

return {results, failures: results.filter(item => !item.pass), errors, externalRequests};
}
