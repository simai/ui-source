async page => {
  const {base,fixture}=await page.evaluate(()=>({base:new URL('../../source/output/action-focus-browser',location.href).href,fixture:location.href}));
  const results=[],failures=[],errors=[],fontResponses=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{
    if(response.status()>=400)errors.push(`HTTP ${response.status()} ${response.url()}`);
    if(/\.woff2?(?:\?|$)/.test(response.url()))fontResponses.push({status:response.status(),cors:response.headers()['access-control-allow-origin'],type:response.headers()['content-type']});
  });
  for(const width of [390,1280])for(const theme of ['theme-light','theme-dark']){
    await page.setViewportSize({width,height:700});await page.goto(fixture);
    await page.evaluate(theme=>document.documentElement.className=theme,theme);
    for(const name of ['modal','icon-buttons','close','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/modal/js/modal.js`});
    await page.evaluate(async base=>document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/modal-embedded-document/index.html`)).text(),base);
    await page.addScriptTag({url:`${base}/examples/modal-embedded-document/index.js`});
    await page.locator('#modal-document-open').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='open'&&getComputedStyle(document.querySelector('[data-sf-modal-panel]')).opacity==='1');
    await page.frameLocator('#modal-document-frame').locator('#document-first').waitFor();
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(()=>document.activeElement.id==='modal-document-frame');
    const frame=page.frames().find(f=>f!==page.mainFrame());
    await frame.waitForFunction(()=>document.activeElement.id==='document-last');
    const entered=await frame.evaluate(async()=>{
      await document.fonts.ready;
      const button=document.getElementById('document-first'),s=getComputedStyle(button);
      const role=document.createElement('span');role.style.backgroundColor='var(--sf-primary)';document.body.append(role);
      const expected=getComputedStyle(role).backgroundColor;role.remove();
      const text=button.querySelector('.sf-button-text-container');
      const family=getComputedStyle(text).fontFamily.split(',')[0].replace(/["']/g,'').trim(),loaded=[...document.fonts].filter(face=>face.status==='loaded').map(face=>face.family.replace(/["']/g,'').trim());
      return{active:document.activeElement.id,display:s.display,background:s.backgroundColor,expected,styled:expected!=='rgba(0, 0, 0, 0)'&&s.backgroundColor===expected,family,loaded,fontReady:loaded.includes(family),scripts:document.scripts.length};
    });
    const isolated=await page.evaluate(()=>{const frame=document.getElementById('modal-document-frame');return frame.getAttribute('sandbox')===''&&frame.contentDocument===null;});
    await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement.matches('[data-sf-modal-close]'));
    if(width===390)await page.screenshot({path:`output/playwright/modal-document-example-${theme}.png`,fullPage:true});
    await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.sf-modal').dataset.sfModalState==='closed');
    const after=await page.evaluate(()=>({restored:document.activeElement.id==='modal-document-open',guards:document.querySelectorAll('.sf-modal-focus-guard').length}));
    const row={width,theme,entered,isolated,after};results.push(row);if(entered.active!=='document-last'||!entered.styled||!entered.fontReady||entered.scripts!==0||!isolated||!after.restored||after.guards!==0)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results,fontResponses};
}
