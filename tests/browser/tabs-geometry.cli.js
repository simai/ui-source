async page => {
  const failures = [], errors = []; let cases = 0;
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const theme of ['light', 'dark']) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    for (const smart of [false, true]) for (const icons of [false, true]) for (const type of ['', 'pills', 'underline', 'full', 'vertical']) {
      cases++;
      const result = await page.evaluate(async ({theme, smart, icons, type}) => {
        document.documentElement.className = `theme-${theme}`;
        const main = document.querySelector('main'); main.replaceChildren();
        if (smart) {
          const host = document.createElement('sf-tabs'); host.setAttribute('type', type); host.setAttribute('variant', icons ? 'icons' : 'buttons'); host.setAttribute('items', 'Первый::icon=home|Второй::icon=home|Третий::icon=home'); main.append(host);
        } else {
          const cls = icons ? 'sf-icon-button' : 'sf-button';
          main.innerHTML = `<div class="sf-tabs ${type ? `sf-tabs--${type}` : ''}"><div class="sf-tabs-top-container"><div class="sf-tabs-top flex">${[0, 1, 2].map(i => `<button class="${cls} ${cls}--default ${cls}--primary ${cls}--size-1 ${icons ? 'sf-icon-button--icon' : ''}">${icons ? '<i class="sf-icon">home</i>' : '<span class="sf-button-text-container">Текст</span>'}</button>`).join('')}</div></div><div class="sf-tabs-main-container">Содержимое</div></div>`;
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const settle = async () => {await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));};
        const root = main.querySelector('.sf-tabs');
        root.style.setProperty('--sf-radius--ui', 'var(--sf-space-2)');
        root.style.setProperty('--sf-radius-default', 'var(--sf-space-4)');
        root.style.setProperty('--sf-tabs--border-width', 'var(--sf-space-1)');
        const probe = document.createElement('span'); probe.style.padding = 'var(--sf-space-2)'; probe.style.borderRadius = 'var(--sf-radius-rounded)'; root.append(probe);
        const ui = getComputedStyle(probe).paddingTop, rounded = getComputedStyle(probe).borderStartStartRadius;
        probe.style.padding = 'var(--sf-space-1)'; const border = parseFloat(getComputedStyle(probe).paddingTop); probe.remove();
        const buttons = [...root.querySelectorAll('button')], first = getComputedStyle(buttons[0]), last = getComputedStyle(buttons[2]);
        await settle();
        const radius = first.borderStartStartRadius, endRadius = last.borderStartEndRadius;
        const expectedRadius = type === 'pills' ? rounded : ui;
        const width = parseFloat(first.borderBottomWidth), headerWidth = parseFloat(getComputedStyle(root.querySelector('.sf-tabs-top-container')).borderBottomWidth);
        const expectedWidth = type === 'underline' ? border * 2 : type === 'full' ? border : 0;
        const expectedHeader = ['', 'underline'].includes(type) ? border : 0;
        buttons[0].classList.add('radius-square'); await settle(); const square = getComputedStyle(buttons[0]).borderStartStartRadius;
        buttons[0].classList.remove('radius-square'); buttons[0].classList.add('radius-rounded'); await settle(); const explicitRounded = getComputedStyle(buttons[0]).borderStartStartRadius;
        return {radius, endRadius, expectedRadius, width, expectedWidth, headerWidth, expectedHeader, square, explicitRounded, rounded};
      }, {theme, smart, icons, type});
      if (result.radius !== result.expectedRadius || result.endRadius !== result.expectedRadius || result.width !== result.expectedWidth || result.headerWidth !== result.expectedHeader || result.square !== '0px' || result.explicitRounded !== result.rounded) failures.push({theme, smart, icons, type, result});
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases, failures, errors};
}
