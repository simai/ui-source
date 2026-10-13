async page => {
  await page.route('**/*', route => route.continue());
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const mode of ['base', 'smart', 'markup', 'fixed-smart']) for (const fixedMask of [false, true]) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addScriptTag({url: 'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(() => { window.SF = {Mask: {create: async (e, o) => IMask(e, o), destroy: m => m?.destroy()}}; });
    for (const layer of fixedMask ? ['smart', 'component'] : ['component', 'smart']) await page.addScriptTag({url: `${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({mode, fixedMask}) => {
      const main = document.querySelector('main'); main.innerHTML = '<form id="test-form"></form>';
      window.customCountries = [
        {iso2: 'de', code: '+49', label: 'Германия — свой формат', maskPattern: '+49 00-00-00-00-00'},
        {iso2: 'RU', code: '+7', label: 'Россия — свой формат', maskPattern: '+7 00-000-00-000'},
        {code: '+999', label: 'Тестовый код', maskPattern: '+999 000-000-0000'},
      ];
      window.fixedPattern = '+000 000000000000';
      const params = {label: 'Телефон', value: '+49 1511234567', countries: customCountries, useMask: true, useCountryMasks: !fixedMask, maskPattern: fixedMask ? fixedPattern : '', multiCountry: mode !== 'fixed-smart'};
      const parent = document.getElementById('test-form');
      if (mode.includes('smart')) {
        const host = document.createElement('sf-country-code');
        for (const [key, value] of Object.entries({label: params.label, value: params.value, 'use-mask': 'true', 'use-country-masks': String(!fixedMask), 'mask-pattern': params.maskPattern, 'multi-country': String(params.multiCountry)})) host.setAttribute(key, value);
        host.countries = customCountries; parent.append(host);
      } else if (mode === 'base') {
        const C = window.__sfComponentClasses.CountryCode || new Map(window.SF_PENDING_COMPONENTS || []).get('CountryCode'); window.instance = new C({param: params}); parent.append(instance.render());
      } else {
        parent.innerHTML = `<label class="sf-country-code" data-use-mask="true" data-use-country-masks="${!fixedMask}" data-mask-pattern="${params.maskPattern}"><span class="sf-country-code-text">Телефон</span><span class="sf-country-code-field"><span class="sf-country-code-left"></span><input type="tel" value="${params.value}"></span><span class="sf-country-code-list"><span class="sf-country-code-items">${customCountries.map(c => `<span class="sf-country-code-item" data-iso2="${c.iso2 || ''}" data-code="${c.code}" data-mask-pattern="${c.maskPattern}">${c.label}</span>`).join('')}</span></span></label>`;
      }
    }, {mode, fixedMask});
    await page.waitForFunction(() => !!document.querySelector('.sf-country-code')?.__sfCountryMask);
    const row = await page.evaluate(async ({mode, fixedMask}) => {
      const root = document.querySelector('.sf-country-code'), input = root.querySelector('input');
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const pattern = () => root.__sfCountryMask?.masked.mask;
      const expected = i => fixedMask ? fixedPattern : customCountries[i].maskPattern;
      const initial = {value: input.value, iso2: root.dataset.iso2, pattern: pattern()};
      const checks = {initialCountry: initial.iso2 === 'DE', initialMask: initial.pattern === expected(0)};
      if (mode !== 'fixed-smart') root.querySelector('[data-code="+7"]').click();
      else SF.CountryCode.setState(root, {iso2: 'RU'});
      await settle();
      checks.selectionMask = root.dataset.iso2 === 'RU' && pattern() === expected(1);
      checks.selectionName = root.querySelector('.sf-country-code-left').getAttribute('aria-label')?.includes('Россия — свой формат');
      // With country masks the old German mask must not rewrite the new prefix.
      checks.localDigits = fixedMask || input.value.replace(/\D/g, '') === '71511234567';
      SF.CountryCode.setState(root, {dialCode: '+999'}); await settle();
      checks.codeOnly = root.dataset.dialCode === '+999' && pattern() === expected(2);
      checks.optionIdentity = mode === 'fixed-smart' || root.querySelector('[aria-selected="true"]')?.dataset.code === '+999';
      if (mode.includes('smart')) {
        const host = document.querySelector('sf-country-code'), done = new Promise(resolve => host.addEventListener('sf-after-render', resolve, {once: true}));
        host.setAttribute('hint', 'Свой список стран'); await done;
      } else { root.remove(); await settle(); document.getElementById('test-form').append(root); }
      await settle(); checks.rebind = root.dataset.dialCode === '+999' && pattern() === expected(2);
      document.getElementById('test-form').reset(); await settle();
      checks.reset = root.dataset.iso2 === 'DE' && input.value === initial.value && pattern() === expected(0);
      return {checks, initial, final: {value: input.value, iso2: root.dataset.iso2, pattern: pattern()}};
    }, {mode, fixedMask});
    results.push({mode, fixedMask, ...row}); if (!Object.values(row.checks).every(Boolean)) failures.push(results.at(-1));
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
