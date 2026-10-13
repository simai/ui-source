async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const lowerKind of ['none','ordinary','smart'])for(const state of ['valid','disabled','hidden','inert','detached','minimized']){
    if(state==='minimized'&&lowerKind!=='smart')continue;
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({kind,lowerKind,state})=>{
      const main=document.querySelector('main');main.id='return-main';main.innerHTML='<section id="return-region"><button id="opener">Открыть</button><button>Другое действие</button></section>';
      const settle=async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);};
      const create=async(type,id)=>{
        if(type==='ordinary'){const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];return new Constructor({id,param:{title:id,showFooter:false,html:'<button id="nested-opener">Открыть следующее</button>'}});}
        const modal=document.createElement('sf-modal');modal.setAttribute('modal-id',id);modal.setAttribute('title',id);modal.setAttribute('show-footer','false');modal.innerHTML='<button id="nested-opener" slot="content">Открыть следующее</button>';main.append(modal);await settle();return modal;
      };
      window.getRoot=m=>m.getModalRoot?.()||m.template;window.lower=null;document.getElementById('opener').focus();
      if(lowerKind!=='none'){lower=await create(lowerKind,'lower');lower.open({animate:false});await settle();}
      window.original=lower?getRoot(lower).querySelector('#nested-opener'):document.getElementById('opener');original.focus();
      window.subject=await create(kind,'upper');subject.open({animate:false});await settle();
      if(state==='disabled')original.disabled=true;
      if(state==='hidden')original.hidden=true;
      if(state==='inert')original.inert=true;
      if(state==='detached')original.remove();
      if(state==='minimized')lower.hide();
      subject.close();
    },{kind,lowerKind,state});
    await page.waitForFunction(()=>getRoot(subject).dataset.sfModalState==='closed');
    const result=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,original:document.activeElement===original,inLower:lower?getRoot(lower).contains(document.activeElement):false,inertAncestor:!!document.activeElement.closest('[inert]'),regionTab:document.getElementById('return-region').getAttribute('tabindex'),mainTab:document.getElementById('return-main').getAttribute('tabindex'),locked:document.body.classList.contains('overflow-hidden')}));
    const hasVisibleLower=lowerKind!=='none'&&state!=='minimized';
    const correct=state==='valid'?result.original:hasVisibleLower?result.inLower:result.id===(state==='minimized'?'return-main':'return-region');
    const row={width,kind,lowerKind,state,...result};results.push(row);
    const fallback=state!=='valid'&&!hasVisibleLower;
    if(!correct||result.inertAncestor||result.locked!==hasVisibleLower||result.regionTab!==(fallback&&state!=='minimized'?'-1':null)||result.mainTab!==(state==='minimized'?'-1':null))failures.push(row);
    if(fallback){
      await page.keyboard.press('Tab');
      const cleaned=await page.evaluate(()=>document.getElementById('return-region').getAttribute('tabindex')===null&&document.getElementById('return-main').getAttribute('tabindex')===null);
      row.cleaned=cleaned;if(!cleaned)failures.push({...row,issue:'temporary-tabindex-not-cleaned'});
    }
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
