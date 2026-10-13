async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const smart of [false, true]) for (const remove of [false, true]) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addScriptTag({url: 'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(() => {
      window.requests = [];
      window.SF = {Mask: {
        create: (input, options) => new Promise(resolve => {const instance = IMask(input, options); requests.push({input, instance, resolve, destroyed: false});}),
        destroy: instance => {const entry = requests.find(e => e.instance === instance); if (entry) entry.destroyed = true; instance?.destroy();},
      }};
    });
    await page.addScriptTag({url: `${base}/component/country-code/js/country-code.js`});
    await page.addScriptTag({url: `${base}/smart/country-code/js/country-code.js`});
    await page.evaluate(smart => {
      const main = document.querySelector('main'); main.replaceChildren();
      if (smart) {
        const host = document.createElement('sf-country-code'); host.id = 'race-country';
        host.setAttribute('use-mask', 'true'); host.setAttribute('iso2', 'RU'); host.setAttribute('value', '+7 9991234567'); main.append(host);
      } else {
        const Constructor = window.__sfComponentClasses.CountryCode || new Map(window.SF_PENDING_COMPONENTS || []).get('CountryCode');
        window.countryInstance = new Constructor({id: 'race-country', param: {iso2:'RU', useMask:true, value:'+7 9991234567'}});
        main.append(countryInstance.render());
      }
    }, smart);
    await page.waitForFunction(() => requests.length > 0 && document.querySelector('.sf-country-code')?.dataset.sfCountryCodeBound === '1');
    await page.evaluate(async ({smart, remove}) => {
      window.raceRoot = document.querySelector('.sf-country-code');
      if (remove) {
        if (smart) document.getElementById('race-country').remove(); else countryInstance.destroy();
      } else if (smart) {
        const host = document.getElementById('race-country');
        const done = new Promise(r => host.addEventListener('sf-after-render', r, {once: true}));
        host.setAttribute('hint', 'Обновлённая подсказка'); await done;
      } else {
        countryInstance.destroyInternal(); countryInstance.init();
      }
      for (const entry of [...requests].reverse()) {
        entry.resolve(entry.instance); await new Promise(r => setTimeout(r, 0));
      }
    }, {smart, remove});
    const row = await page.evaluate(remove => ({requests: requests.length,
      oldDestroyed: (remove ? requests : requests.slice(0,-1)).every(e => e.destroyed),
      newestOwns: remove ? !raceRoot.__sfCountryMask : raceRoot.__sfCountryMask === requests.at(-1).instance && !requests.at(-1).destroyed,
      connected: raceRoot.isConnected}), remove);
    results.push({smart, remove, ...row});
    if ((!remove && row.requests < 2) || !row.oldDestroyed || !row.newestOwns || row.connected === remove) failures.push({smart, remove, row});
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors, results};
}
