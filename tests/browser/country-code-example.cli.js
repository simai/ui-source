async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const n of ['buttons','country-code']) await page.addStyleTag({url: `${base}/component/${n}/css/${n}.css`});
    await page.addScriptTag({url: `${base}/smart/country-code/js/country-code.js`});
    await page.evaluate(async ({base, theme}) => {
      document.documentElement.className = `theme-${theme}`;
      const response = await fetch(`${base}/examples/country-code-customization.html`);
      if (!response.ok) throw new Error('Missing actual draft example');
      const main = document.querySelector('main'); main.innerHTML = await response.text();
      for (const inert of [...main.querySelectorAll('script')]) {const live = document.createElement('script'); live.textContent = inert.textContent; inert.replaceWith(live);}
      await document.fonts.load('24px "Material Symbols Outlined"');
      main.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
    }, {base, theme});
    await page.locator('sf-country-code input').fill('+7 9991234567');
    const before = await page.locator('sf-country-code').evaluate(e => ({...e.state, padding:getComputedStyle(e.querySelector('.sf-country-code')).paddingTop}));
    await page.getByRole('button', {name:'Изменить отступ', exact:true}).click();
    await page.waitForFunction(padding => getComputedStyle(document.querySelector('sf-country-code .sf-country-code')).paddingTop !== padding, before.padding);
    const after = await page.locator('sf-country-code').evaluate(async e => {
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      return {...e.state,padding:getComputedStyle(e.querySelector('.sf-country-code')).paddingTop, overflow:document.documentElement.scrollWidth>innerWidth};
    });
    if (after.value !== before.value || after.iso2 !== before.iso2 || after.padding === before.padding || after.overflow) failures.push({width,theme,before,after});
    await page.locator('sf-country-code .sf-country-code-left').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    const keyboard = await page.locator('sf-country-code').evaluate(e => {
      const items=[...e.querySelectorAll('.sf-country-code-item')],wrap=e.querySelector('.sf-country-code-items');
      const focused=document.activeElement,box=wrap.getBoundingClientRect(),rect=focused.getBoundingClientRect();
      return {last:focused===items.at(-1),visible:rect.top>=box.top-1&&rect.bottom<=box.bottom+1,value:e.state.value};
    });
    await page.keyboard.press('Escape');
    if (!keyboard.last || !keyboard.visible || keyboard.value!==after.value) failures.push({width,theme,keyboard});
    await page.screenshot({path:`output/playwright/country-code-customization-${width}-${theme}.png`,fullPage:true});
    results.push({width,theme,before,after});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
