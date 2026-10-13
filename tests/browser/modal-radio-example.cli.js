async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const theme of ['theme-light','theme-dark']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close','buttons','radio'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/modal/js/modal.js`});
    await page.evaluate(async base=>document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-radio-group/index.html`)).text(),base);
    await page.addScriptTag({url:`${base}/examples/modal-radio-group/index.js`});
    await page.locator('#modal-radio-open').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='open'&&getComputedStyle(document.querySelector('.sf-modal [data-sf-modal-panel]')).opacity==='1');
    await page.keyboard.press('Shift+Tab');
    const entry=await page.evaluate(()=>document.activeElement.value);
    await page.keyboard.press('ArrowRight');
    const selected=await page.evaluate(()=>({active:document.activeElement.value,checked:document.querySelector('.sf-modal input:checked').value}));
    if(width===390)await page.screenshot({path:`output/playwright/modal-radio-example-${theme}.png`,fullPage:true});
    await page.keyboard.press('Tab');
    const closeFocused=await page.evaluate(()=>document.activeElement.matches('[data-sf-modal-close]'));
    if(closeFocused)await page.keyboard.press('Enter');else await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='closed');
    const restored=await page.evaluate(()=>document.activeElement.id==='modal-radio-open');
    const row={width,theme,entry,selected,closeFocused,restored};results.push(row);
    if(entry!=='download'||selected.active!=='link'||selected.checked!=='link'||!closeFocused||!restored)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
