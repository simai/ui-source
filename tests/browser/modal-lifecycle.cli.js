async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const scenario of ['immediate-reopen','delayed-reopen','inline']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({kind,scenario})=>{
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button><button id="after">Следующее действие</button>';
      const display=scenario==='inline'?'inline':'modal';
      if(kind==='ordinary'){
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        window.subject=new Constructor({id:'lifecycle-test',param:{title:'Жизненный цикл',display,root:main,showFooter:false,html:'<button id="inside">Внутри</button>'}});
        window.root=()=>subject.template;subject.render();
      }else{
        window.subject=document.createElement('sf-modal');subject.setAttribute('title','Жизненный цикл');subject.setAttribute('display',display);subject.setAttribute('show-footer','false');
        subject.innerHTML='<button id="inside" slot="content">Внутри</button>';main.append(subject);
        for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);window.root=()=>subject.getModalRoot();
      }
      // Ordinary also broadcasts to window, while Smart emits on its host.
      window.closedEvents=0;(kind==='ordinary'?root():subject).addEventListener('modal:after-close',()=>closedEvents++);
      document.getElementById('opener').focus();subject.open({animate:false});
      for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
    },{kind,scenario});
    if(scenario==='inline'){
      const opened=await page.evaluate(()=>({focus:document.activeElement.id,locked:document.body.classList.contains('overflow-hidden'),role:root().getAttribute('role')}));
      await page.keyboard.press('Escape');
      const afterEscape=await page.evaluate(()=>({visible:getComputedStyle(root()).display!=='none',hidden:root().getAttribute('aria-hidden')}));
      await page.evaluate(()=>{document.getElementById('after').focus();subject.close();});
      await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
      const closed=await page.evaluate(()=>({focus:document.activeElement.id,visible:getComputedStyle(root()).display!=='none',hidden:root().getAttribute('aria-hidden'),locked:document.body.classList.contains('overflow-hidden')}));
      const row={width,kind,scenario,opened,afterEscape,closed};results.push(row);
      if(opened.focus!=='opener'||opened.locked||opened.role!=='region'||!afterEscape.visible||afterEscape.hidden!=='false'||closed.visible||closed.hidden!=='true'||closed.locked||closed.focus!=='after')failures.push(row);
    }else{
      await page.evaluate(async scenario=>{
        root().querySelector('#inside').focus();subject.close();
        if(scenario==='delayed-reopen')await new Promise(resolve=>setTimeout(resolve,60));
        subject.open();await new Promise(resolve=>setTimeout(resolve,400));
      },scenario);
      const reopened=await page.evaluate(()=>({state:root().getAttribute('data-sf-modal-state'),hidden:root().getAttribute('aria-hidden'),locked:document.body.classList.contains('overflow-hidden'),inside:root().contains(document.activeElement),closedEvents,stackSize:document[Symbol.for('simai.modal.document-stack')].items.length}));
      await page.evaluate(()=>subject.close());
      await page.waitForFunction(()=>root().getAttribute('data-sf-modal-state')==='closed');
      const closed=await page.evaluate(()=>({focus:document.activeElement.id,locked:document.body.classList.contains('overflow-hidden'),closedEvents,stackSize:document[Symbol.for('simai.modal.document-stack')].items.length}));
      const row={width,kind,scenario,reopened,closed};results.push(row);
      if(reopened.state!=='open'||reopened.hidden!=='false'||!reopened.locked||!reopened.inside||reopened.closedEvents!==0||reopened.stackSize!==1||closed.focus!=='opener'||closed.locked||closed.closedEvents!==1||closed.stackSize!==0)failures.push(row);
    }
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
