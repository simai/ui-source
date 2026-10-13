async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const phase of ['initial','open','closing','cancelled','reopened','closed']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    const row=await page.evaluate(async({kind,phase})=>{
      const frame=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button><button id="after">После окна</button>';
      const html='<div><button id="action">Действие</button><div inert><button id="author-inert">Изначально инертный</button></div></div>';
      let subject;
      if(kind==='ordinary'){const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];subject=new Constructor({id:'visibility',param:{title:'Видимость',showFooter:false,html}});}
      else{subject=document.createElement('sf-modal');subject.setAttribute('title','Видимость');subject.innerHTML=`<div slot="content">${html}</div>`;main.append(subject);}
      await frame(10);const root=()=>subject.getModalRoot?.()||subject.template,opener=document.getElementById('opener');opener.focus();
      window.visibilitySubject=subject;window.visibilityRoot=root;
      if(phase!=='initial'){subject.open({animate:false});await frame(10);}
      if(phase==='cancelled')(kind==='ordinary'?root():subject).addEventListener('modal:before-close',e=>e.preventDefault(),{once:true});
      if(['closing','cancelled','reopened','closed'].includes(phase)){
        root().querySelector('#action').focus();subject.close();
        if(phase==='reopened'){subject.open({animate:false});await frame(10);}
        if(phase==='closed')await new Promise(resolve=>setTimeout(resolve,350));
      }
      const action=root().querySelector('#action'),panel=root().querySelector('[data-sf-modal-panel]');
      const focusBefore=document.activeElement===panel?'panel':document.activeElement.id;
      if(phase!=='closing')opener.focus();
      action.focus();const actionFocused=document.activeElement===action;
      root().querySelector('#author-inert').focus();const authorFocused=document.activeElement.id==='author-inert';
      const hiddenFocus=root().getAttribute('aria-hidden')==='true'&&root().contains(document.activeElement);
      return{phase,state:root().dataset.sfModalState,actionFocused,authorFocused,hiddenFocus,focusBefore,focusAfter:document.activeElement===panel?'panel':document.activeElement.id,display:getComputedStyle(root()).display};
    },{kind,phase});
    const expected=['open','cancelled','reopened'].includes(phase);
    if(phase==='closing'){
      await page.keyboard.press('Tab');
      row.keyboard=await page.evaluate(()=>({state:visibilityRoot().dataset.sfModalState,panel:document.activeElement===visibilityRoot().querySelector('[data-sf-modal-panel]'),hiddenFocus:visibilityRoot().getAttribute('aria-hidden')==='true'&&visibilityRoot().contains(document.activeElement)}));
      row.keyboard.namedDialog=await page.getByRole('dialog',{name:'Видимость',exact:true}).count();
      if(row.keyboard.state!=='closing'||!row.keyboard.panel||row.keyboard.hiddenFocus||row.keyboard.namedDialog!==1)failures.push({width,kind,phase,action:'native-tab',...row.keyboard});
    }
    results.push({width,kind,...row});if(row.actionFocused!==expected||row.authorFocused||row.hiddenFocus)failures.push({width,kind,...row,expected});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
