async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const scenario of ['background','cancel','inline','closed']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    const row=await page.evaluate(async scenario=>{
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button><button id="after">Другое действие</button>';
      const settle=async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);};
      const subject=document.createElement('sf-modal');subject.setAttribute('title','Проверка');subject.setAttribute('hide','true');subject.innerHTML='<button slot="content" id="inside">Внутри</button>';
      if(scenario==='inline'){subject.setAttribute('display','inline');subject.setAttribute('minimized','');}
      main.append(subject);await settle();const root=()=>subject.getModalRoot();document.getElementById('opener').focus();subject.open({animate:false});await settle();
      let extra={},ok=true;
      if(scenario==='background'){
        root().querySelector('#inside').focus();
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        const upper=new Constructor({id:'upper',param:{title:'Верхнее окно',showFooter:false}});upper.open({animate:false});await settle();subject.hide();await settle();
        extra.focusUpper=upper.template.contains(document.activeElement);extra.lowerInert=root().inert;
        ok=extra.focusUpper&&extra.lowerInert;
        upper.close();await new Promise(resolve=>setTimeout(resolve,350));
        extra.afterUpperFocus=document.activeElement.id;extra.activeInHidden=root().contains(document.activeElement);extra.locked=document.body.classList.contains('overflow-hidden');
        ok=ok&&!extra.activeInHidden&&!extra.locked;
      }else if(scenario==='cancel'){
        subject.addEventListener('modal:before-hide',e=>e.preventDefault(),{once:true});subject.hide();await settle();
        extra={hidden:subject.hiddenState,inert:root().inert,inside:root().contains(document.activeElement),locked:document.body.classList.contains('overflow-hidden')};
        ok=!extra.hidden&&!extra.inert&&extra.inside&&extra.locked;
      }else if(scenario==='inline'){
        subject.hide();await settle();extra={hidden:subject.hiddenState,inert:root().inert,aria:root().getAttribute('aria-hidden'),focus:document.activeElement.id,locked:document.body.classList.contains('overflow-hidden')};
        ok=!extra.hidden&&!extra.inert&&extra.aria==='false'&&extra.focus==='opener'&&!extra.locked;
      }else{
        subject.hide();await settle();document.getElementById('after').focus();subject.close();await new Promise(resolve=>setTimeout(resolve,350));subject.setAttribute('minimized','');subject.removeAttribute('minimized');await settle();
        extra={state:root().dataset.sfModalState,inert:root().inert,focus:document.activeElement.id,locked:document.body.classList.contains('overflow-hidden')};
        ok=extra.state==='closed'&&extra.inert&&extra.focus==='after'&&!extra.locked;
      }
      return{scenario,ok,...extra};
    },scenario);
    results.push({width,...row});if(!row.ok)failures.push({width,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
