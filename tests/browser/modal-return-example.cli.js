async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/modal/js/modal.js`});
    await page.evaluate(async base=>document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-return-focus/index.html`)).text(),base);
    await page.addScriptTag({url:`${base}/examples/modal-return-focus/index.js`});
    await page.locator('#modal-return-open').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='open');
    await page.locator('#modal-return-finish').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='closed');
    const result=await page.evaluate(()=>({focus:document.activeElement.id,temporary:document.getElementById('modal-return-region').getAttribute('tabindex'),removed:!document.getElementById('modal-return-open'),text:document.getElementById('modal-return-status').textContent}));
    if(width===390)await page.screenshot({path:'output/playwright/modal-return-example.png',fullPage:true});
    let cleaned;
    if(width===390){await page.keyboard.press('Tab');cleaned=await page.evaluate(()=>document.getElementById('modal-return-region').getAttribute('tabindex')===null);}
    else cleaned=await page.evaluate(async()=>{const region=document.getElementById('modal-return-region');region.remove();await new Promise(requestAnimationFrame);return region.getAttribute('tabindex')===null;});
    results.push({width,...result,cleaned,cleanup:width===390?'blur':'removal'});if(result.focus!=='modal-return-region'||result.temporary!=='-1'||!result.removed||!cleaned)failures.push({width,...result,cleaned});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
