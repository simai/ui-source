async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const theme of ['theme-light','theme-dark']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/smart/modal/js/modal.js`});
    await page.evaluate(async base=>document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-minimized/index.html`)).text(),base);
    await page.addScriptTag({url:`${base}/examples/modal-minimized/index.js`});
    await page.waitForFunction(()=>document.querySelector('sf-modal')?.getModalRoot()?.isConnected);
    await page.locator('#modal-restore-demo').click();
    await page.waitForFunction(()=>document.querySelector('sf-modal').getModalRoot().dataset.sfModalState==='open');
    await page.locator('.sf-modal [data-sf-modal-hide]').click();
    await page.waitForFunction(()=>document.querySelector('sf-modal').getModalRoot().inert);
    const hidden=await page.evaluate(()=>({focused:document.activeElement.id==='modal-restore-demo',locked:document.body.classList.contains('overflow-hidden')}));
    await page.locator('#modal-restore-demo').click();
    await page.evaluate(async()=>{for(let i=0;i<16;i++)await new Promise(requestAnimationFrame);});
    const shown=await page.evaluate(()=>{const root=document.querySelector('sf-modal').getModalRoot(),panel=root.querySelector('[data-sf-modal-panel]');return{inside:root.contains(document.activeElement),inert:root.inert,opacity:getComputedStyle(panel).opacity,fits:document.documentElement.scrollWidth<=innerWidth};});
    if(width===390)await page.screenshot({path:`output/playwright/modal-minimized-example-${theme}.png`,fullPage:true});
    await page.locator('.sf-modal [data-sf-modal-close]').click();
    await page.waitForFunction(()=>document.querySelector('sf-modal').getModalRoot().dataset.sfModalState==='closed');
    const restored=await page.evaluate(()=>document.activeElement.id==='modal-restore-demo');
    const row={width,theme,hidden,shown,restored};results.push(row);if(!hidden.focused||hidden.locked||!shown.inside||shown.inert||shown.opacity!=='1'||!shown.fits||!restored)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
