async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/smart/modal/js/modal.js`});
    await page.evaluate(async()=>{
      document.querySelector('main').innerHTML='<button id="opener">Открыть или восстановить</button><button id="after">Другое действие</button><sf-modal title="Сворачивание" hide="true" show-footer="false"><button slot="content" id="inside">Действие в окне</button></sf-modal>';
      window.subject=document.querySelector('sf-modal');window.root=()=>subject.getModalRoot();
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      document.getElementById('opener').focus();subject.open({animate:false});
      for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
      root().querySelector('[data-sf-modal-hide]').focus();subject.hide();
      await new Promise(resolve=>setTimeout(resolve,350));
    });
    const hidden=await page.evaluate(()=>({hidden:subject.hiddenState,opacity:getComputedStyle(root().querySelector('[data-sf-modal-panel]')).opacity,activeInPanel:root().querySelector('[data-sf-modal-panel]').contains(document.activeElement),locked:document.body.classList.contains('overflow-hidden')}));
    await page.keyboard.press('Tab');
    const tab=await page.evaluate(()=>({id:document.activeElement.id,activeInPanel:root().querySelector('[data-sf-modal-panel]').contains(document.activeElement)}));
    if(width===390)await page.screenshot({path:'output/playwright/modal-minimized-probe.png',fullPage:true});
    await page.evaluate(()=>subject.show());
    await page.waitForFunction(()=>getComputedStyle(root().querySelector('[data-sf-modal-panel]')).opacity==='1');
    await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});
    const shown=await page.evaluate(()=>({hidden:subject.hiddenState,inside:root().contains(document.activeElement)}));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>root().dataset.sfModalState==='closed');
    const restored=await page.evaluate(()=>document.activeElement.id==='opener');
    const row={width,hidden,tab,shown,restored};results.push(row);
    if(hidden.activeInPanel||tab.activeInPanel||!hidden.hidden||shown.hidden||!shown.inside||!restored)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
