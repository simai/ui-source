async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const kind of ['base','smart']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?checkbox');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async({kind,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`../../source/output/action-focus-browser/examples/dropdown-checkbox-${kind}.html`);
      if(!response.ok)throw new Error(`Example unavailable: ${response.status}`);
      document.querySelector('main').innerHTML=await response.text();
    },{kind,theme});
    const field=page.locator('.sf-dropdown-field'),button=field.locator(':scope > button');
    await page.waitForFunction(()=>document.querySelector('.sf-dropdown-field > button[aria-controls]'));
    await settle();
    const selection=()=>page.locator('.sf-list-item.selected').evaluateAll(items=>items.map(e=>e.dataset.value).join(','));
    const initial=kind==='smart'?'kazan,moscow':'kazan';
    check(await selection()===initial,`${kind}: example initial selection`);
    await button.click();
    const mark=page.locator('.sf-list-item[data-value="moscow"] .sf-checkbox-box');
    await mark.scrollIntoViewIfNeeded();const box=await mark.boundingBox();
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await settle();
    const selected=kind==='smart'?'kazan':'moscow';
    check(await selection()===selected,`${kind}: example pointer selection`);
    const payload=await page.locator('form').evaluate(e=>[...new FormData(e)]);
    check(JSON.stringify(payload)===JSON.stringify([[kind==='smart'?'cities':'city',selected]]),`${kind}: example form payload ${JSON.stringify(payload)}`);
    await page.keyboard.press('Escape');
    await page.locator('button[type="reset"]').click();await settle();
    check(await selection()===initial,`${kind}: example native reset`);
    await button.click();
    check(await page.locator('.sf-list-item[data-value="ufa"]').getAttribute('aria-disabled')==='true',`${kind}: example disabled option`);
    const indicators=await page.locator('.sf-list-item').evaluateAll(items=>items.every(e=>e.querySelector('input').checked===e.classList.contains('selected')&&e.querySelector('.sf-checkbox-box .sf-icon').textContent===(e.classList.contains('selected')?'check':'')));
    check(indicators,`${kind}: example visible indicators`);
    await page.screenshot({path:`output/playwright/dropdown-checkbox-example-${kind}-${width}-${theme}.png`});
    results.push({width,theme,kind,payload});
  }
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',cases:results.length,results,errors};
}
