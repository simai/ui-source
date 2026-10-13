async page => {
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error' && !event.text().includes('Access to font')) errors.push(event.text());
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
await page.goto('http://127.0.0.1:8878/ru/components/clipboard/');
await page.waitForFunction(() => document.querySelectorAll('iframe').length === 4);
const handles = await page.locator('iframe').elementHandles();
const frames = (await Promise.all(handles.map(handle => handle.contentFrame()))).filter(Boolean);
await Promise.all(frames.map(frame => frame.waitForLoadState('domcontentloaded')));
await page.waitForTimeout(6000);
const data = await Promise.all(frames.map(frame => frame.evaluate(() => ({
  actions: document.querySelectorAll('button.sf-clipboard').length,
  canonicalSources: document.querySelectorAll('[data-copy], [data-target]').length,
  legacySources: document.querySelectorAll('[data-clipboard-target]').length,
  overlayActions: document.querySelectorAll('.sf-clipboard--overlay').length,
  statuses: document.querySelectorAll('[role="status"]').length,
  namedActions: [...document.querySelectorAll('button.sf-clipboard')]
    .every(button => Boolean(button.getAttribute('aria-label')
      || button.querySelector('.sf-button-text-container')?.textContent.trim())),
  bound: document.querySelectorAll('[data-sf-copy-bound="true"]').length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))));
const expectedActions = [1, 1, 2, 5];
const pass = frames.length === 4
  && data.every((frame, index) => frame.actions === expectedActions[index]
    && frame.canonicalSources === frame.actions
    && frame.legacySources === 0
    && frame.namedActions
    && !frame.overflow)
  && data[0].overlayActions === 1
  && data[0].statuses >= 1
  && data[2].overlayActions === 1
  && errors.length === 0;
return {
  pass,
  frames: frames.length,
  data,
  runtimeProjected: data.every(frame => frame.bound === frame.actions),
  errors,
};
}
