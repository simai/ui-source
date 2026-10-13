async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  const scenarios = [
    {stage: 'default', selected: false, target: 1, current: 0},
    {stage: 'default', selected: true, target: 1, current: 1},
    {stage: 'completed', selected: false, target: 0, current: 1},
    {stage: 'error', selected: false, target: 0, current: 1, error: 0},
    {stage: 'error', selected: true, target: 0, current: 0, error: 0},
  ];
  for (const theme of ['light', 'dark']) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url: `${base}/component/step/css/step.css`});
    await page.addScriptTag({url: `${base}/smart/steps/js/steps.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`; document.querySelector('main').replaceChildren();}, theme);
    for (const size of ['1/2', '1']) for (const disabled of [false, true]) for (const scenario of scenarios) {
      const rows = await page.evaluate(async ({size, disabled, scenario}) => {
        const main = document.querySelector('main'); main.replaceChildren();
        const normal = document.createElement('div');
        normal.className = `sf-step sf-step--size-${size} sf-step--stage-${scenario.stage} flex items-center ${scenario.selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`;
        normal.innerHTML = `${scenario.stage === 'default' ? '' : '<i class="sf-icon">check_circle</i>'}<div class="sf-step-container">Данные</div>`;
        main.append(normal);
        const smart = document.createElement('sf-steps'); smart.setAttribute('size', size);
        smart.setAttribute('items', ['Данные', 'Проверка', 'Готово'].map((name, i) => name + (disabled && i === scenario.target ? '::disabled' : '')).join('|'));
        smart.setAttribute('current', String(scenario.current));
        if (scenario.error !== undefined) smart.setAttribute('error-step', String(scenario.error));
        main.append(smart);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const parse = value => {const n = value.match(/[\d.]+/g)?.map(Number); if (!/^rgba?\(/.test(value) || !n || n.length < 3) throw new Error(`Unsupported color ${value}`); return [...n.slice(0, 3), n[3] ?? 1];};
        const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3])).concat(1);
        const luminance = rgb => rgb.slice(0, 3).map(v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;}).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
        return [['base', normal], ['smart', smart.querySelector(`[data-step-index="${scenario.target}"]`)]].map(([owner, root]) => {
          const node = root.querySelector('.sf-step-container'), chain = [];
          for (let e = node; e; e = e.parentElement) chain.unshift(e);
          const bg = chain.reduce((b, e) => {const c = getComputedStyle(e); if (c.backgroundImage !== 'none' || Number(c.opacity) !== 1) throw new Error('Complex paint not covered'); return over(parse(c.backgroundColor), b);}, [255, 255, 255, 1]);
          const color = getComputedStyle(node).color, fg = over(parse(color), bg), a = luminance(fg), b = luminance(bg);
          const probe = document.createElement('span'); probe.style.color = 'var(--sf-on-disable)'; root.append(probe);
          const disabledColor = getComputedStyle(probe).color; probe.remove();
          return {owner, color, disabledColor, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), iconColor: root.querySelector('.sf-icon') ? getComputedStyle(root.querySelector('.sf-icon')).color : null};
        });
      }, {size, disabled, scenario});
      for (const row of rows) {
        const result = {theme, size, disabled, scenario, ...row}; results.push(result);
        if (!disabled && row.ratio < 4.5) failures.push({...result, reason: 'active text contrast'});
        if (disabled && (row.color !== row.disabledColor || (row.iconColor && row.iconColor !== row.disabledColor))) failures.push({...result, reason: 'disabled role'});
      }
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', checks: results.length, minActive: Math.min(...results.filter(r => !r.disabled).map(r => r.ratio)), failures, errors, results};
}
