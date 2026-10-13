async page => {
  const base = 'http://127.0.0.1:8949';
  const routes = [
    {key: 'component', path: '/ru/components/slider/', frames: 6},
    {key: 'smart-slider', path: '/ru/smart-components/reference/slider/', frames: 3},
    {key: 'gallery', path: '/ru/smart-components/reference/gallery/', frames: 3},
  ];
  const errors = [];
  const badLoaderWarnings = [];
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => {
    const message = event.text();
    if (event.type() === 'error') errors.push(message);
    if (message.includes('Failed to load script') || message.includes('Failed to load styles')) {
      badLoaderWarnings.push(message);
    }
  });

  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const route of routes) {
      await page.goto(`${base}${route.path}`);
      await page.waitForFunction(expected => document.querySelectorAll('iframe[title="Example"]').length === expected, route.frames);
      const bodyText = await page.locator('body').innerText();
      const frames = page.frames().slice(1);

      if (route.key === 'component') {
        await page.evaluate(() => document.documentElement.dataset.testStage = 'component-initialized');
        await frames[0].waitForFunction(() => document.querySelector('.sf-slider')?._sfSlider?.initialized);
        await frames[0].locator('.sf-slider-button-next').click();
        await frames[0].waitForFunction(() => document.querySelector('.sf-slider')._sfSlider.realIndex === 1);
      }

      if (route.key === 'smart-slider') {
        await page.evaluate(() => document.documentElement.dataset.testStage = 'smart-slider-initialized');
        for (const frame of frames) {
          await frame.waitForFunction(() => document.querySelector('sf-slider')?.getSlider?.()?.initialized);
        }
        await frames[0].locator('.sf-slider-button-next').click();
        await frames[0].waitForFunction(() => document.querySelector('sf-slider').getSlider().realIndex === 1);
      }

      if (route.key === 'gallery') {
        await page.evaluate(() => document.documentElement.dataset.testStage = 'gallery-inline-initialized');
        for (const frame of frames.slice(0, 2)) {
          await frame.waitForFunction(() => document.querySelector('sf-gallery')?.getInlineSlider?.()?.getSlider?.()?.initialized);
        }
        await page.evaluate(() => document.documentElement.dataset.testStage = 'gallery-inline-open');
        await frames[0].locator('.swiper-slide-active [data-sf-gallery-open]').click();
        await frames[0].waitForFunction(() => document.querySelector('sf-gallery').openState === true);
        await page.evaluate(() => document.documentElement.dataset.testStage = 'gallery-inline-close');
        await frames[0].evaluate(() => document.querySelector('sf-gallery').close());
        await frames[0].waitForFunction(() => document.querySelector('sf-gallery').openState === false);

        await page.evaluate(() => document.documentElement.dataset.testStage = 'gallery-delegated-open');
        await frames[2].locator('[data-sf-gallery]').first().click({noWaitAfter: true});
        await frames[2].waitForFunction(() => document.querySelector('sf-gallery[data-sf-gallery-delegated]')?.openState === true);
        await frames[2].evaluate(() => document.querySelector('sf-gallery[data-sf-gallery-delegated]').close());
      }

      const frameRows = [];
      for (const [index, frame] of frames.entries()) {
        const dimensions = await frame.evaluate(index => ({
          index,
          height: innerHeight,
          contentHeight: document.documentElement.scrollHeight,
          width: innerWidth,
          contentWidth: document.documentElement.scrollWidth,
          sliders: [...document.querySelectorAll('.sf-slider')].map(slider => !!slider._sfSlider?.initialized),
          smartSliders: [...document.querySelectorAll('sf-slider')].map(slider => !!slider.getSlider?.()?.initialized),
          galleries: [...document.querySelectorAll('sf-gallery')].map(gallery => !!gallery.getInlineSlider?.()?.getSlider?.()?.initialized || gallery.openState),
        }), index);
        frameRows.push(dimensions);
      }
      const iframeHeights = await page.locator('iframe[title="Example"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      const exactHeights = frameRows.every((row, index) => Math.abs(row.contentHeight - iframeHeights[index]) <= 1);
      const noOverflow = frameRows.every(row => row.contentWidth <= row.width + 1) &&
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      const noServiceSections = !bodyText.includes('Атрибуты и свойства') &&
        !bodyText.includes('Теги и подключение') && !bodyText.includes('Источник');
      results.push({width, key: route.key, exactHeights, noOverflow, noServiceSections, frameRows});
    }
  }

  const failures = results.filter(result => !result.exactHeights || !result.noOverflow || !result.noServiceSections);
  return {
    status: failures.length || errors.length || badLoaderWarnings.length ? 'failed' : 'passed',
    cases: results.length,
    checks: results.length * 3,
    failures,
    errors,
    badLoaderWarnings,
    results,
  };
}
