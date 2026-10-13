async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const sandbox of [false,true])for(const layout of ['parent-first','frame-first','only-frame']){
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({kind,sandbox,layout})=>{
      document.querySelector('main').innerHTML='<button id="opener">Открыть</button><button id="outside">После окна</button>';
      if(kind==='ordinary'){const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];window.subject=new Constructor({id:'frame-modal',param:{title:'Документ',showFooter:false}});window.root=()=>subject.template;}
      else{window.subject=document.createElement('sf-modal');subject.setAttribute('title','Документ');document.querySelector('main').append(subject);window.root=()=>subject.getModalRoot();}
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);subject.open({animate:false});for(let i=0;i<10;i++)await new Promise(requestAnimationFrame);
      window.panel=root().querySelector('[data-sf-modal-panel]');panel.innerHTML=layout==='parent-first'?'<button id="first">Действие окна</button>':'';
      const frame=document.createElement('iframe');frame.id='embedded';frame.title='Встроенный документ';if(sandbox)frame.setAttribute('sandbox','');
      frame.srcdoc='<button id="frame-first">Первое действие документа</button><button id="frame-last">Последнее действие документа</button>';panel.append(frame);await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
      if(layout==='frame-first')panel.insertAdjacentHTML('beforeend','<button id="last">Действие окна</button>');
    },{kind,sandbox,layout});
    const state={width,kind,sandbox,layout,states:[]};
    const exit=layout==='parent-first'?'first':layout==='frame-first'?'last':'';
    const actions=[['panel-forward',null,'Tab',layout==='parent-first'?'first':'embedded','frame-first'],['panel-backward',null,'Shift+Tab',layout==='frame-first'?'last':'embedded','frame-last'],['frame-exit-forward','frame-last','Tab',exit],['frame-exit-backward','frame-first','Shift+Tab',exit],['child-forward','frame-first','Tab','embedded','frame-last'],['child-backward','frame-last','Shift+Tab','embedded','frame-first']];
    if(layout==='parent-first')actions.push(['parent-wrap-backward','first','Shift+Tab','embedded','frame-last']);
    if(layout==='frame-first')actions.push(['parent-wrap-forward','last','Tab','embedded','frame-first']);
    for(const [action,target,key,expected,expectedChild]of actions){
      if(target?.startsWith('frame-'))await page.frameLocator('#embedded').locator(`#${target}`).focus();
      else await page.evaluate(target=>(target?document.getElementById(target):panel).focus(),target);
      await page.keyboard.press(key);
      // Opaque frames can live in another renderer; key acknowledgement precedes
      // the focus handoff. Inspect the settled focus before starting another key.
      await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
      const next=await page.evaluate(()=>({id:document.activeElement.id,inside:panel.contains(document.activeElement),guard:document.activeElement.classList.contains('sf-modal-focus-guard')}));
      if(next.id==='embedded')next.child=await page.frames().find(frame=>frame!==page.mainFrame()).evaluate(()=>document.activeElement.id);
      state.states.push({action,...next});if(!next.inside||next.id!==expected||next.guard||(expected==='embedded'&&next.child!==expectedChild))failures.push({width,kind,sandbox,layout,action,expected,expectedChild,...next});
    }
    const guardState=await page.evaluate(()=>({count:document.querySelectorAll('.sf-modal-focus-guard').length,zero:[...document.querySelectorAll('.sf-modal-focus-guard')].every(node=>{const r=node.getBoundingClientRect();return r.width===0&&r.height===0;})}));
    await page.evaluate(()=>subject.close());await page.waitForFunction(()=>root().dataset.sfModalState==='closed');
    const cleaned=await page.evaluate(()=>document.querySelectorAll('.sf-modal-focus-guard').length===0);
    state.guardState={...guardState,cleaned};if(guardState.count!==2||!guardState.zero||!cleaned)failures.push({width,kind,sandbox,layout,action:'guard-lifetime',...state.guardState});
    results.push(state);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
