/* global customElements, CustomEvent, dispatchEvent, document, fetch, File, getComputedStyle, innerWidth, TextDecoder, window */
async page => {
  const workspace = 'http://127.0.0.1:8765';
  const productBase = `${workspace}/ui-source/source/output/action-focus-browser`;
  const examplesBase = `${workspace}/ui-doc/examples/components/file-upload`;
  // The Smart overview moved to smart-components/ with the Smart pages (ui-doc 5b299228).
  const exampleUrlOf = (id) => id === 'smart-overview'
    ? `${workspace}/ui-doc/examples/smart-components/file-upload/overview/index.html`
    : `${examplesBase}/${id}/index.html`;
  const siteBase = page.url().match(/^https?:\/\/[^/]+/)?.[0] || '';
  const failures = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
  });

  const loadExample = async (id, smart = false) => {
    await page.goto(workspace);
    const markup = await page.evaluate(async url => {
      const response = await fetch(url);
      return new TextDecoder('utf-8').decode(await response.arrayBuffer());
    }, exampleUrlOf(id));
    await page.setContent(`<meta charset="utf-8">${markup}`);
    await page.evaluate(base => {
      window.sfPath = `${base}/`;
      window.sfSmartPath = `${base}/smart/`;
    }, productBase);
    for (const url of [
      `${productBase}/core/css/core.css`,
      `${productBase}/core/css/utility.full.css`,
      `${productBase}/component/featured-icon/css/featured-icon.css`,
      `${productBase}/component/icon-buttons/css/icon-buttons.css`,
      `${productBase}/component/progress-bar/css/progress-bar.css`,
      `${productBase}/component/file-upload/css/file-upload.css`,
    ]) await page.addStyleTag({url});
    await page.addScriptTag({url: `${productBase}/component/progress-bar/js/progress-bar.js`});
    await page.addScriptTag({url: `${productBase}/smart/progress-bar/js/progress-bar.js`});
    await page.addScriptTag({url: `${productBase}/${smart ? 'smart' : 'component'}/file-upload/js/file-upload.js`});
    if (smart) {
      await page.waitForFunction(() => customElements.get('sf-file-upload') && [...document.querySelectorAll('sf-file-upload')].every(host => host.querySelector('.sf-file-upload')));
    } else {
      await page.waitForFunction(() => [...document.querySelectorAll('.sf-file-upload')].every(root => root.querySelector('.sf-file-upload-input')));
    }
    await page.evaluate(() => dispatchEvent(new CustomEvent('docara:example-ready')));
  };

  const checkDocumentationPage = async (route, count, screenshot, expectedSelector = null) => {
    await page.goto(`${siteBase}${route}`);
    await page.waitForFunction(expected => document.querySelectorAll('iframe[data-docara-example-frame]').length === expected, count);
    const frames = page.locator('iframe[data-docara-example-frame]');
    for (let index = 0; index < count; index += 1) {
      const frame = page.frames()[index + 1];
      await frame.waitForFunction(() => document.documentElement.dataset.docaraExampleReady === 'true');
      if (expectedSelector) await frame.locator(expectedSelector).first().waitFor();
      const content = await frame.evaluate(() => ({height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, viewportWidth: innerWidth}));
      const box = await frames.nth(index).boundingBox();
      const scrolling = await frames.nth(index).getAttribute('scrolling');
      if (!box || scrolling !== 'no' || box.height + 2 < content.height || content.width > content.viewportWidth + 1) {
        failures.push({route, reason: 'example frame does not fit content', index, content, box, scrolling});
      }
    }
    if (route === '/ru/components/file-upload/') {
      await page.frames()[4].waitForFunction(() => document.querySelectorAll('.sf-upload-progress').length === 3);
      await page.frames()[5].waitForFunction(() => document.querySelectorAll('.sf-upload-progress').length === 1);
      await page.frames()[5].locator('[data-action=retry]').click();
      await page.frames()[5].waitForFunction(() => document.querySelector('output').value === 'Приложение повторяет передачу');
    }
    await page.screenshot({path: screenshot, fullPage: true});
  };

  await page.setViewportSize({width: 1280, height: 900});
  await checkDocumentationPage('/ru/components/file-upload/', 6, 'output/playwright/file-upload-owner-docs-ordinary.png', '.sf-file-upload');
  await checkDocumentationPage('/ru/smart-components/reference/file-upload/', 6, 'output/playwright/file-upload-owner-docs-smart.png');

  await loadExample('overview');
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt']);
  await page.waitForFunction(() => document.querySelectorAll('.sf-upload-progress').length === 1);
  const ordinary = await page.locator('.sf-file-upload').evaluate(async root => ({
    retained: root.__sfFileUploadItems[0].file instanceof File,
    content: await root.__sfFileUploadItems[0].file.text(),
    inputEmpty: root.querySelector('input[type=file]').value === '',
    fontSize: getComputedStyle(root).fontSize,
  }));
  if (!ordinary.retained || ordinary.content.trim() !== 'SF5 retained file' || !ordinary.inputEmpty) failures.push({reason: 'ordinary File retention', ordinary});

  await loadExample('selection');
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt', 'tests/fixtures/file-upload/second.txt']);
  await page.waitForFunction(() => document.querySelector('output').value === 'Выбрано файлов: 2');

  await loadExample('sizes');
  if (await page.locator('.sf-file-upload').count() !== 5) failures.push({reason: 'ordinary sizes example'});
  await loadExample('progress');
  await page.waitForFunction(() => document.querySelectorAll('.sf-upload-progress').length === 3);
  const states = await page.locator('.sf-upload-progress').evaluateAll(rows => rows.map(row => [...row.classList].find(name => name.startsWith('sf-upload-progress--') && !name.startsWith('sf-upload-progress--size-'))));
  if (!states.includes('sf-upload-progress--process') || !states.includes('sf-upload-progress--done') || !states.includes('sf-upload-progress--error')) failures.push({reason: 'ordinary states example', states});
  await loadExample('actions');
  await page.locator('[data-action=retry]').click();
  await page.waitForFunction(() => document.querySelector('output').value === 'Приложение повторяет передачу');
  await loadExample('disabled');
  if (!(await page.locator('input[type=file]').isDisabled())) failures.push({reason: 'ordinary disabled example'});

  await loadExample('smart-overview', true);
  const smartDefault = await page.locator('sf-file-upload').evaluate(host => ({icon: host.icon, glyph: host.querySelector('.sf-featured-icon .sf-icon')?.textContent.trim()}));
  if (smartDefault.icon !== 'upload_file' || smartDefault.glyph !== 'upload_file') failures.push({reason: 'Smart neutral default icon', smartDefault});
  await page.screenshot({path: 'output/playwright/file-upload-owner-smart-source.png', fullPage: true});
  await loadExample('smart-selection', true);
  await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt', 'tests/fixtures/file-upload/second.txt']);
  await page.waitForFunction(() => document.querySelector('output').value === 'Выбрано файлов: 2');
  await loadExample('smart-sizes', true);
  if (await page.locator('.sf-file-upload').count() !== 5) failures.push({reason: 'Smart sizes example'});
  await loadExample('smart-states', true);
  await page.waitForFunction(() => document.querySelectorAll('.sf-upload-progress').length === 3);
  await loadExample('smart-disabled', true);
  if (!(await page.locator('input[type=file]').isDisabled())) failures.push({reason: 'Smart disabled example'});
  await loadExample('smart-customization', true);
  const customized = await page.locator('.sf-file-upload').evaluate(root => ({surface: root.classList.contains('bg-surface-container'), radius: root.classList.contains('radius-default')}));
  if (!customized.surface || !customized.radius) failures.push({reason: 'Smart utility customization', customized});

  return {
    status: failures.length || errors.length ? 'failed' : 'passed',
    cases: 14,
    checks: 32,
    projectionGap: 'The pinned ui-doc Smart asset projection does not yet include sf-file-upload; documentation structure and exact source examples were verified separately.',
    failures,
    errors,
  };
}
