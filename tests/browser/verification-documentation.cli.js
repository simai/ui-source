async page => {
  const pageUrl = 'http://127.0.0.1:8881/ru/components/verification/';
  await page.goto(pageUrl, {waitUntil: 'domcontentloaded'});
  const candidateJs = await page.evaluate(() => fetch('/_candidate/verification.js').then(response => response.text()));
  const candidateCss = await page.evaluate(() => fetch('/_candidate/verification.css').then(response => response.text()));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.route('**/component/verification/js/verification.js?*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: candidateJs,
  }));
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto(pageUrl, {waitUntil: 'networkidle'});
  const frames = page.frames().slice(1);
  if (frames.length !== 4) throw new Error(`Expected 4 example frames, got ${frames.length}`);
  for (const frame of frames) {
    await frame.addStyleTag({content: candidateCss});
    await frame.waitForSelector('.sf-verification-cell');
  }

  const frameResults = [];
  for (const frame of frames) {
    frameResults.push(await frame.evaluate(() => ({
      nativeInputs: document.querySelectorAll('.sf-verification-input').length,
      controls: document.querySelectorAll('.sf-verification').length,
      cells: document.querySelectorAll('.sf-verification-cell').length,
      hiddenCells: [...document.querySelectorAll('.sf-verification-cells')].every(node => node.getAttribute('aria-hidden') === 'true'),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    })));
  }
  const sourceTabs = await page.locator('[data-docara-example-tab="html"]').count();
  const checks = {
    fourExecutableExamples: frames.length === 4 && sourceTabs === 4,
    oneNativeInputPerControl: frameResults.every(result => result.nativeInputs === result.controls),
    cellsAreDecorative: frameResults.every(result => result.hiddenCells && result.cells >= result.controls),
    noHorizontalOverflow: frameResults.every(result => !result.horizontalOverflow),
    noRuntimeErrors: errors.length === 0,
  };
  if (Object.values(checks).some(value => !value)) throw new Error(JSON.stringify({checks, frameResults, errors}));
  return {checks, frameResults, errors};
}
