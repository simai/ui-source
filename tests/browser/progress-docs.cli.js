async page => {
const pages = [
  {path: '/ru/components/progress-bar/', expectedFrames: 4, kind: 'bar', smart: false},
  {path: '/ru/components/progress-scale/', expectedFrames: 4, kind: 'scale', smart: false},
  {path: '/ru/smart-components/reference/progress-bar/', expectedFrames: 3, kind: 'bar', smart: true},
  {path: '/ru/smart-components/reference/progress-scale/', expectedFrames: 3, kind: 'scale', smart: true},
];
const results = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => {
  if (event.type() === 'error' && !event.text().includes('Access to font')) {
    errors.push(event.text());
  }
});
await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));

for (const entry of pages) {
  await page.goto(`http://127.0.0.1:8878${entry.path}`);
  await page.waitForFunction(expected => document.querySelectorAll('iframe').length === expected, entry.expectedFrames);
  const frameHandles = await page.locator('iframe').elementHandles();
  const frames = (await Promise.all(frameHandles.map(frame => frame.contentFrame()))).filter(Boolean);
  await Promise.all(frames.map(frame => frame.waitForLoadState('domcontentloaded')));
  await page.waitForTimeout(entry.smart ? 1000 : 6000);
  const data = await Promise.all(frames.map(frame => frame.evaluate(() => ({
    text: document.body.innerText.trim(),
    bars: document.querySelectorAll('.sf-progress-bar').length,
    barFills: document.querySelectorAll('.sf-progress-bar-progress').length,
    scales: document.querySelectorAll('.sf-progress-scale').length,
    scaleBlocks: document.querySelectorAll('.sf-progress-scale-block').length,
    progressRoles: document.querySelectorAll('[role="progressbar"]').length,
    smartBars: document.querySelectorAll('sf-progress-bar').length,
    smartScales: document.querySelectorAll('sf-progress-scale').length,
    upgradedSmartBars: document.querySelectorAll('sf-progress-bar .sf-progress-bar').length,
    upgradedSmartScales: document.querySelectorAll('sf-progress-scale .sf-progress-scale').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))));
  const hasStructuralRoot = data.every(frame => entry.kind === 'bar'
    ? (entry.smart ? frame.smartBars >= 1 : frame.bars >= 1)
    : (entry.smart ? frame.smartScales >= 1 : frame.scales >= 1));
  const runtimeProjected = data.every(frame => entry.kind === 'bar'
    ? (entry.smart ? frame.upgradedSmartBars >= 1 : frame.barFills >= 1)
    : (entry.smart ? frame.upgradedSmartScales >= 1 : frame.scaleBlocks >= 1));
  results.push({
    path: entry.path,
    frames: frames.length,
    expectedFrames: entry.expectedFrames,
    data,
    runtimeProjected,
    pass: frames.length === entry.expectedFrames
      && data.every(frame => !frame.overflow)
      && hasStructuralRoot,
  });
}

return {
  results,
  errors,
  failures: results.filter(result => !result.pass),
};
}
