async page => {
  const base = 'http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const results = [], failures = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
  for (const width of [390, 1280]) for (const layout of ['block', 'grid', 'flex']) for (const kind of ['ordinary', 'slider', 'gallery']) {
    await page.setViewportSize({width, height: 700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['swiper', 'slider', 'modal']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url: `${base}/smart/gallery/css/gallery.css`});
    for (const path of ['component/swiper', 'component/slider', 'smart/icons', 'smart/icon-buttons', 'smart/slider', 'smart/modal', 'smart/gallery']) {
      await page.addScriptTag({url: `${base}/${path}/js/${path.split('/').pop()}.js`});
    }
    await page.evaluate(({base, layout, kind}) => {
      const main = document.querySelector('main');
      main.className = layout === 'block' ? '' : layout;
      const figure = `<figure class="m-0"><img src="${base}/examples/assets/color-study.jpg" alt="Цветовая композиция"><figcaption>Изображение и описание в ограниченной ширине контейнера.</figcaption></figure>`;
      main.innerHTML = kind === 'ordinary'
        ? `<div class="sf-slider" id="subject"><div class="sf-slider-main swiper"><div class="swiper-wrapper"><div class="swiper-slide"><div class="sf-slider-slide">${figure}</div></div></div></div></div>`
        : `<sf-${kind} id="subject" thumbs="false" arrows="false" speed="0">${figure.replace('<figure ', '<figure slot="slide" ')}</sf-${kind}>`;
    }, {base, layout, kind});
    await page.waitForFunction(kind => {
      const host = document.getElementById('subject');
      return (kind === 'gallery' ? host.getInlineSlider()?.getSlider() : kind === 'slider' ? host.getSlider() : host._sfSlider)?.initialized;
    }, kind);
    const measure = async phase => {
      const state = await page.evaluate(async kind => {
        const host = document.getElementById('subject');
        await Promise.all([...host.querySelectorAll('img')].map(image => image.decode()));
        for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
        const main = document.querySelector('main').getBoundingClientRect();
        const root = kind === 'gallery' ? host.querySelector('.sf-gallery') : kind === 'slider' ? host.querySelector('.sf-slider') : host;
        const box = root.getBoundingClientRect();
        return {viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, main: {left: main.left, right: main.right}, root: {left: box.left, right: box.right}, boundaries: [root, ...root.querySelectorAll('.sf-gallery-inline,.sf-slider,.sf-slider-main,img')].map(element => ({class: element.className || element.tagName, width: element.getBoundingClientRect().width, minWidth: getComputedStyle(element).minWidth, position: getComputedStyle(element).position}))};
      }, kind);
      const row = {width, layout, kind, phase, ...state};
      results.push(row);
      if (state.scrollWidth > state.viewport || state.root.left < state.main.left - 1 || state.root.right > state.main.right + 1) failures.push(row);
    };
    await measure('ready');
    if (kind === 'gallery') {
      await page.evaluate(() => document.getElementById('subject').open(1));
      await page.waitForFunction(() => document.getElementById('subject').getLightboxSlider()?.getSlider()?.initialized);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('subject').getModal().getModalRoot()?.getAttribute('aria-hidden') === 'true');
      await measure('closed');
    }
    await page.setViewportSize({width: width === 390 ? 1280 : 390, height: 700});
    await measure('resized');
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, errors, failures, results};
}
