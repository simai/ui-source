async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  for(const width of [390,1280])for(const theme of ['theme-light','theme-dark']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/modal/js/modal.js`});
    await page.evaluate(async base=>document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-panel-animation/index.html`)).text(),base);
    await page.addScriptTag({url:`${base}/examples/modal-panel-animation/index.js`});
    const states=[];
    for(const id of ['modal-motion-default','modal-motion-instant','modal-motion-default']){
      await page.locator(`#${id}`).focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>{const root=document.querySelector('.sf-modal');return root?.dataset.sfModalState==='open'&&getComputedStyle(root.querySelector('[data-sf-modal-panel]')).opacity==='1';});
      states.push(await page.evaluate(()=>document.querySelector('.sf-modal').classList.contains('animate')));
      if(width===390&&id==='modal-motion-default')await page.screenshot({path:`output/playwright/modal-animation-panel-${theme}.png`,fullPage:true});
      await page.keyboard.press('Tab');await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='closed');
      if(await page.evaluate(()=>document.activeElement.id)!==id)failures.push({width,theme,id,reason:'restore'});
    }
    if(width===390)await page.screenshot({path:`output/playwright/modal-animation-example-${theme}.png`,fullPage:true});
    const row={width,theme,states};results.push(row);if(JSON.stringify(states)!=='[true,false,true]')failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
