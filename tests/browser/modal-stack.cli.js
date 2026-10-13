async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const lower of ['ordinary','smart'])for(const upper of ['ordinary','smart'])for(const action of ['escape','cancel','remove','remove-lower']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({lower,upper})=>{
      document.querySelector('main').innerHTML='<button id="page-opener">Открыть</button>';
      window.items=[];
      const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
      for(const [index,kind] of [lower,upper].entries()){
        let instance;
        if(kind==='ordinary')instance=new Constructor({id:`stack-${index}`,param:{title:`Окно ${index}`,showFooter:false}});
        else {instance=document.createElement('sf-modal');instance.setAttribute('modal-id',`stack-${index}`);instance.setAttribute('title',`Окно ${index}`);instance.setAttribute('show-footer','false');document.querySelector('main').append(instance);}
        items.push({instance,kind,root:()=>kind==='ordinary'?instance.template:instance.getModalRoot()});
      }
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      document.getElementById('page-opener').focus();items[0].instance.open({animate:false});
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      const trigger=document.createElement('button');trigger.id='nested-opener';trigger.textContent='Открыть следующее';items[0].root().querySelector('[data-sf-modal-panel]').append(trigger);trigger.focus();
      items[1].instance.open({animate:false});
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
    },{lower,upper});
    const before=await page.evaluate(()=>({z:items.map(i=>Number(getComputedStyle(i.root()).zIndex)),focusTop:items[1].root().contains(document.activeElement),guards:document.querySelectorAll('.sf-modal-focus-guard').length}));
    if(width===390&&lower==='ordinary'&&upper==='smart'&&action==='cancel')await page.screenshot({path:'output/playwright/modal-mixed-stack.png',fullPage:true});
    if(before.z[1]<=before.z[0]||!before.focusTop||before.guards!==2)failures.push({width,lower,upper,action,phase:'open',before});
    if(action==='cancel')await page.evaluate(()=>{const item=items[1];window.cancelHandler=e=>e.preventDefault();(item.kind==='ordinary'?item.root():item.instance).addEventListener('modal:before-close',cancelHandler,{once:true});});
    if(action.startsWith('remove'))await page.evaluate(action=>{const item=items[action==='remove-lower'?0:1];if(item.kind==='ordinary')item.instance.destroy();else item.instance.remove();},action);
    else await page.keyboard.press('Escape');
    const after=await page.evaluate(async()=>{
      for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);
      return {open:items.map(i=>!!i.root()?.isConnected&&i.root().getAttribute('data-sf-modal-state')==='open'),locked:document.documentElement.classList.contains('overflow-hidden'),focusLower:!!items[0].root()?.contains(document.activeElement),focusTop:!!items[1].root()?.contains(document.activeElement)};
    });
    const expected=action==='cancel'?[true,true]:action==='remove-lower'?[false,true]:[true,false];
    if(JSON.stringify(after.open)!==JSON.stringify(expected)||!after.locked||(['cancel','remove-lower'].includes(action)?!after.focusTop:!after.focusLower))failures.push({width,lower,upper,action,phase:'after',after});
    await page.evaluate(()=>{const upper=items[1];if(window.cancelHandler)(upper.kind==='ordinary'?upper.root():upper.instance)?.removeEventListener('modal:before-close',cancelHandler);for(const item of items.slice().reverse())if(item.root()?.isConnected)item.instance.close();});
    await page.waitForFunction(()=>items.every(i=>!i.root()?.isConnected||i.root().getAttribute('data-sf-modal-state')==='closed'));
    const unlocked=await page.evaluate(()=>!document.documentElement.classList.contains('overflow-hidden')&&document.querySelectorAll('.sf-modal-focus-guard').length===0);
    if(!unlocked)failures.push({width,lower,upper,action,phase:'cleanup'});
    results.push({width,lower,upper,action,before,after,unlocked});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
