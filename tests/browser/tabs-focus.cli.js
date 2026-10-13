async page => {
  const failures = [], errors = []; let cases = 0;
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const theme of ['light', 'dark']) for (const forcedColors of ['none', 'active']) {
    await page.setViewportSize({width: 820, height: 700});
    await page.emulateMedia({forcedColors, reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    for (const smart of [false, true]) for (const icons of [false, true]) for (const type of ['', 'pills', 'underline', 'full', 'vertical']) {
      const context = {theme, forcedColors, smart, icons, type}; cases++;
      await page.evaluate(async ({theme, smart, icons, type}) => {
        document.documentElement.className = `theme-${theme}`;
        const main = document.querySelector('main'); main.innerHTML = '<button id="focus-start">Начало</button>';
        if (smart) {
          const host = document.createElement('sf-tabs'); host.id = 'focus-case';
          host.setAttribute('type', type); host.setAttribute('variant', icons ? 'icons' : 'buttons');
          host.setAttribute('items', 'Обзор::icon=home|История::icon=history'); main.append(host);
        } else {
          const tag = icons ? 'sf-icon-button' : 'sf-button';
          main.insertAdjacentHTML('beforeend', `<div id="focus-case" class="sf-tabs ${type ? `sf-tabs--${type}` : ''} ${type === 'vertical' ? 'flex' : ''}"><div class="sf-tabs-top-container"><div class="sf-tabs-top flex ${type === 'vertical' ? 'flex-col' : ''}">${[0, 1].map(i => `<button tabindex="${i ? '-1' : '0'}" class="${tag} ${tag}--default ${tag}--primary ${tag}--size-1 ${icons ? 'sf-icon-button--icon' : ''} ${i ? '' : 'selected'}" aria-label="${i ? 'История' : 'Обзор'}">${icons ? '<i class="sf-icon" aria-hidden="true">home</i>' : '<span class="sf-button-text-container">Обзор</span>'}</button>`).join('')}</div></div><div class="sf-tabs-main-container">Содержимое</div></div>`);
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await document.fonts.load('24px "Material Symbols Outlined"');
        main.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      }, context);
      const first = page.locator('#focus-case button').first();
      const inspect = async () => first.evaluate(async e => {
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return {shadow: s.boxShadow, outline: s.outlineStyle, outlineWidth: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset), visible: e.matches(':focus-visible'), focused: document.activeElement === e, width: r.width, height: r.height};
      });
      await first.click(); await page.mouse.move(0, 0); const pointer = await inspect();
      await page.locator('#focus-start').focus(); await page.keyboard.press('Tab'); const keyboard = await inspect();
      if (pointer.visible || !keyboard.visible || !keyboard.focused || pointer.width !== keyboard.width || pointer.height !== keyboard.height
        || (forcedColors === 'none' ? !keyboard.shadow.includes('inset') : keyboard.outline === 'none' || keyboard.outlineWidth <= 0 || keyboard.offset > 0)) failures.push({...context, pointer, keyboard});
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases, failures, errors};
}
