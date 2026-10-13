async page => {
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const smart of [false, true]) for (const theme of ['light','dark']) for (const dir of ['ltr','rtl']) {
    await page.setViewportSize({width:390,height:850});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
    await page.addScriptTag({url:`${base}/component/country-code/js/country-code.js`});
    await page.addScriptTag({url:`${base}/smart/country-code/js/country-code.js`});
    await page.evaluate(({smart,theme,dir}) => {
      document.documentElement.className=`theme-${theme}`; document.documentElement.dir=dir;
      const main=document.querySelector('main'); main.replaceChildren();
      const countries=[{iso2:'RU',dialCode:'+7',nameEn:'Russia',label:'Russia (+7)'},{iso2:'DE',dialCode:'+49',nameEn:'Germany',label:'Germany (+49)'},{iso2:'US',dialCode:'+1',nameEn:'United States',label:'United States (+1)'}];
      if(smart){const e=document.createElement('sf-country-code');e.setAttribute('label','Phone');e.setAttribute('hint','Contact number');e.setAttribute('locale','en');e.setAttribute('iso2','RU');e.countries=countries;main.append(e);}
      else {const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');window.instance=new C({param:{label:'Phone',hint:'Contact number',locale:'en',iso2:'RU',countries}});main.append(instance.render());}
      const after=document.createElement('button');after.textContent='After';main.append(after);
      window.countryEvents={input:0,change:0};
      for(const name of ['input','change']) main.addEventListener(name,e=>{if(e.target.matches('input'))countryEvents[name]++;});
    },{smart,theme,dir});
    const root=page.locator('.sf-country-code'),toggle=root.locator('.sf-country-code-left');
    const check=async(name,fn)=>{const ok=await root.evaluate(fn);if(!ok)failures.push({smart,theme,dir,name});return ok;};
    await check('input name excludes country list',r=>document.getElementById(r.querySelector('input').getAttribute('aria-labelledby'))?.textContent==='Phone');
    await check('hint relationship',r=>document.getElementById(r.querySelector('input').getAttribute('aria-describedby'))?.textContent==='Contact number');
    await toggle.focus();await page.keyboard.press('Enter');
    await check('open selected focus and aria',r=>r.classList.contains('open')&&r.querySelector('.sf-country-code-left').getAttribute('aria-expanded')==='true'&&document.activeElement.dataset.iso2==='RU'&&document.activeElement.getAttribute('aria-selected')==='true'&&document.getElementById(r.querySelector('.sf-country-code-left').getAttribute('aria-controls'))?.getAttribute('role')==='listbox');
    await page.keyboard.press('End');await check('End does not commit',r=>document.activeElement.dataset.iso2==='US'&&r.dataset.iso2==='RU');
    await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
    await check('Down moves to Germany',r=>document.activeElement.dataset.iso2==='DE'&&r.dataset.iso2==='RU');
    await page.keyboard.press('Enter');
    await check('single commit and focus return',r=>r.dataset.iso2==='DE'&&!r.classList.contains('open')&&document.activeElement===r.querySelector('.sf-country-code-left')&&countryEvents.input===1&&countryEvents.change===1&&r.querySelectorAll('[aria-selected="true"]').length===1);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Escape');
    await check('Escape cancels',r=>r.dataset.iso2==='DE'&&!r.classList.contains('open')&&document.activeElement===r.querySelector('.sf-country-code-left')&&r.querySelector('.sf-country-code-list').inert);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('r');
    await check('typeahead',r=>document.activeElement.dataset.iso2==='RU'&&r.dataset.iso2==='DE');
    await page.keyboard.press(' ');await check('Space commits',r=>r.dataset.iso2==='RU'&&countryEvents.change===2);
    await root.locator('[data-iso2="DE"].sf-country-code-item').evaluate(e=>e.setAttribute('aria-disabled','true'));
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
    await check('skip disabled option',r=>document.activeElement.dataset.iso2==='US');
    await page.keyboard.press('Tab');await check('Tab leaves without trap',r=>document.activeElement.textContent==='After'&&!r.classList.contains('open'));
    await root.evaluate(r=>SF.CountryCode.setState(r,{disabled:true,open:true}));
    await toggle.dispatchEvent('click');await check('disabled cannot open',r=>!r.classList.contains('open')&&r.querySelector('.sf-country-code-left').tabIndex===-1);
    await root.evaluate(r=>SF.CountryCode.setState(r,{disabled:false}));
    await toggle.focus();await page.keyboard.press('ArrowDown');
    await check('keyboard outline',r=>getComputedStyle(document.activeElement).outlineStyle==='solid'&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0);
    await page.screenshot({path:`output/playwright/country-code-keys-${smart?'smart':'base'}-${theme}-${dir}.png`,fullPage:true});
    results.push({smart,theme,dir});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors};
}
