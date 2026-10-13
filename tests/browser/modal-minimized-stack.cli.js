async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const lowerKind of ['none','ordinary','smart'])for(const method of ['api','attribute','initial']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({lowerKind,method})=>{
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button><button id="after">Другое действие</button>';
      const settle=async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);};
      document.getElementById('opener').focus();window.lower=null;
      if(lowerKind==='ordinary'){
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        lower=new Constructor({id:'lower',param:{title:'Нижнее окно',showFooter:false,html:'<button id="lower-opener">Открыть верхнее</button>'}});
      }else if(lowerKind==='smart'){
        lower=document.createElement('sf-modal');lower.setAttribute('title','Нижнее окно');lower.innerHTML='<button slot="content" id="lower-opener">Открыть верхнее</button>';main.append(lower);await settle();
      }
      window.lowerRoot=()=>lower?.getModalRoot?.()||lower?.template;
      if(lower){lower.open({animate:false});await settle();lowerRoot().querySelector('#lower-opener').focus();}
      window.subject=document.createElement('sf-modal');subject.setAttribute('title','Верхнее окно');subject.setAttribute('hide','true');subject.setAttribute('show-footer','false');
      subject.innerHTML='<button id="inside" slot="content">Внутри</button>';if(method==='initial')subject.setAttribute('minimized','');main.append(subject);await settle();
      window.root=()=>subject.getModalRoot();subject.open({animate:false});await settle();
      if(method!=='initial'){root().querySelector('[data-sf-modal-hide]').focus();if(method==='api')subject.hide();else subject.setAttribute('minimized','');}
      await settle();
    },{lowerKind,method});
    await page.keyboard.press('Tab');
    const hidden=await page.evaluate(()=>({hidden:subject.hiddenState,inert:root().inert,aria:root().getAttribute('aria-hidden'),inside:root().contains(document.activeElement),lowerFocus:lower?lowerRoot().contains(document.activeElement):null,locked:document.body.classList.contains('overflow-hidden'),activeLayers:document[Symbol.for('simai.modal.document-stack')]?.items.length||0,open:subject.openState}));
    await page.evaluate(method=>{if(method==='attribute')subject.removeAttribute('minimized');else subject.show();},method);
    await page.waitForFunction(()=>getComputedStyle(root().querySelector('[data-sf-modal-panel]')).opacity==='1');
    await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});
    const shown=await page.evaluate(()=>({inert:root().inert,aria:root().getAttribute('aria-hidden'),inside:root().contains(document.activeElement),locked:document.body.classList.contains('overflow-hidden'),activeLayers:document[Symbol.for('simai.modal.document-stack')]?.items.length||0}));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>root().dataset.sfModalState==='closed');
    const closed=await page.evaluate(()=>({focus:lower?lowerRoot().contains(document.activeElement):document.activeElement.id==='opener',locked:document.body.classList.contains('overflow-hidden')}));
    const guardCount=await page.evaluate(()=>document.querySelectorAll('.sf-modal-focus-guard').length);
    const row={width,lowerKind,method,hidden,shown,closed,guardCount};results.push(row);const hasLower=lowerKind!=='none';
    if(guardCount!==(hasLower?2:0))failures.push({...row,phase:'guard-cleanup'});
    if(!hidden.hidden||!hidden.open||!hidden.inert||hidden.aria!=='true'||hidden.inside||hidden.locked!==hasLower||hidden.activeLayers!==(hasLower?1:0)||(hasLower&&!hidden.lowerFocus)||shown.inert||shown.aria!=='false'||!shown.inside||!shown.locked||shown.activeLayers!==(hasLower?2:1)||!closed.focus||closed.locked!==hasLower)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
