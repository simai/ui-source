async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  await page.setViewportSize({width: 920, height: 700});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
  for (const name of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
  for (const name of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
  for (const theme of ['light', 'dark']) for (const smart of [false, true]) for (const icons of [false, true])
    for (const type of ['', 'pills', 'underline', 'full', 'vertical']) for (const scheme of ['default', 'outline', 'link']) {
      const context = {theme, smart, icons, type, scheme};
      await page.evaluate(async ({theme, smart, icons, type, scheme}) => {
        document.documentElement.className = `theme-${theme}`;
        const main = document.querySelector('main'); main.innerHTML = '<button id="contrast-start">Начало</button>';
        if (smart) {
          const host = document.createElement('sf-tabs'); host.id = 'contrast-tabs';
          host.setAttribute('type', type); host.setAttribute('scheme', scheme);
          host.setAttribute('variant', icons ? 'icons' : 'buttons');
          host.setAttribute('items', 'Обзор::icon=home|История::icon=history'); main.append(host);
        } else {
          const tag = icons ? 'sf-icon-button' : 'sf-button';
          main.insertAdjacentHTML('beforeend', `<div id="contrast-tabs" class="sf-tabs ${type ? `sf-tabs--${type}` : ''} ${type === 'vertical' ? 'flex' : ''}"><div class="sf-tabs-top-container"><div class="sf-tabs-top flex ${type === 'vertical' ? 'flex-col' : ''}">${[0, 1].map(i => `<button type="button" tabindex="${i ? '-1' : '0'}" class="${tag} ${tag}--${scheme} ${tag}--primary ${tag}--size-1 ${icons ? 'sf-icon-button--icon' : ''} ${i ? '' : 'selected'}" aria-label="${i ? 'История' : 'Обзор'}">${icons ? '<i class="sf-icon" aria-hidden="true">home</i>' : '<span class="sf-button-text-container">Обзор</span>'}</button>`).join('')}</div></div><div class="sf-tabs-main-container">Содержимое</div></div>`);
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await document.fonts.load('24px "Material Symbols Outlined"');
        main.querySelectorAll('.sf-icon').forEach(e => e.classList.add('sf-icon-loaded'));
      }, context);
      await page.mouse.move(0, 0);
      await page.locator('#contrast-start').focus(); await page.keyboard.press('Tab');
      for (const selected of [true, false]) {
        const tab = page.locator('#contrast-tabs button').nth(selected ? 0 : 1);
        // Focus alone does not select: cover both selected and unselected paint.
        await tab.focus();
        const paint = await tab.evaluate(async node => {
          await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
          const parse = value => {const n = value.match(/[\d.]+/g)?.map(Number); if (!/^rgba?\(/.test(value) || !n || n.length < 3) throw new Error(`Unsupported color ${value}`); return [...n.slice(0, 3), n[3] ?? 1];};
          const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3])).concat(1);
          const luminance = rgb => rgb.slice(0, 3).map(v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;}).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
          const ratio = (a, b) => {const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);};
          const chain = []; for (let e = node; e; e = e.parentElement) chain.unshift(e);
          const bg = chain.reduce((b, e) => {const s = getComputedStyle(e); if (s.backgroundImage !== 'none' || Number(s.opacity) !== 1) throw new Error('Complex paint not covered'); return over(parse(s.backgroundColor), b);}, [255, 255, 255, 1]);
          const s = getComputedStyle(node);
          const inks = [...node.querySelectorAll('.sf-button-text-container, .sf-icon')].map(e => {
            const color = getComputedStyle(e).color, icon = e.classList.contains('sf-icon');
            return {color, icon, ratio: ratio(over(parse(color), bg), bg)};
          });
          const shadowColor = s.boxShadow.match(/rgba?\([^)]*\)/)?.[0];
          return {visible: node.matches(':focus-visible'), selected: node.classList.contains('selected'), bg, inks, shadow: s.boxShadow,
            focusRatio: shadowColor && s.boxShadow.includes('inset') ? ratio(over(parse(shadowColor), bg), bg) : 0,
            inkRatio: Math.min(...inks.map(i => i.ratio))};
        });
        const row = {...context, selected, ...paint}; results.push(row);
        if (!paint.visible || paint.selected !== selected || paint.focusRatio < 3 || !paint.inks.length || paint.inks.some(i => i.ratio < (i.icon ? 3 : 4.5))) failures.push(row);
      }
    }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length,
    minFocus: Math.min(...results.map(r => r.focusRatio)), minInk: Math.min(...results.map(r => r.inkRatio)), failures, errors, results};
}
