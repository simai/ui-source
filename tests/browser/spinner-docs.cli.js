async page => {
const pages = [
  {path: '/ru/components/spinner/', expectedFrames: 4, smart: false},
  {path: '/ru/smart-components/reference/spinner/', expectedFrames: 3, smart: true},
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
  const frames = (await Promise.all(frameHandles.map(frame => frame.contentFrame())))
    .filter(Boolean);
  await Promise.all(frames.map(frame => frame.waitForLoadState('domcontentloaded')));
  if (!entry.smart) {
    await page.waitForTimeout(6000);
  }
  const data = await Promise.all(frames.map(frame => frame.evaluate(() => ({
    text: document.body.innerText.trim(),
    spinners: document.querySelectorAll('.sf-loader-container').length,
    svgs: document.querySelectorAll('.sf-loader-svg').length,
    smartHosts: document.querySelectorAll('sf-spinner').length,
    upgradedSmart: document.querySelectorAll('sf-spinner .sf-loader-container').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))));
  results.push({
    path: entry.path,
    frames: frames.length,
    expectedFrames: entry.expectedFrames,
    data,
    runtimeProjected: entry.smart
      ? data.every(frame => frame.upgradedSmart >= 1)
      : data.every(frame => frame.svgs >= 1),
    pass: frames.length === entry.expectedFrames
      && data.every(frame => !frame.overflow)
      && (entry.smart
        ? data.every(frame => frame.smartHosts >= 1)
        : data.every(frame => frame.text && frame.spinners >= 1 && frame.svgs >= 1)),
  });
}

return {
  results,
  errors,
  failures: results.filter(result => !result.pass),
};
}
