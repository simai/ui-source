async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const mode of ['default','false','object-false','object-true','true-false','false-true','right','reduce']){
    await page.setViewportSize({width,height:700});await page.emulateMedia({reducedMotion:mode==='reduce'?'reduce':'no-preference',forcedColors:'none'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    const row=await page.evaluate(async({kind,mode})=>{
      const frame=()=>new Promise(requestAnimationFrame),main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button>';
      let subject;
      if(kind==='ordinary'){const C=SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];subject=new C({id:'animation-option',param:{title:'Анимация',showFooter:false,position:mode==='right'?'right':'center',html:'<p>Содержимое</p>'}});}
      else{subject=document.createElement('sf-modal');subject.setAttribute('title','Анимация');if(mode==='right')subject.setAttribute('position','right');subject.innerHTML='<p slot="content">Содержимое</p>';main.append(subject);}
      for(let i=0;i<8;i++)await frame();const root=()=>subject.getModalRoot?.()||subject.template;
      let opens=0,closes=0;const emitter=kind==='ordinary'?root():subject;emitter.addEventListener('modal:after-open',()=>opens++);emitter.addEventListener('modal:after-close',()=>closes++);
      document.getElementById('opener').focus();
      if(['true-false','false-true'].includes(mode)){
        subject.open(mode==='true-false');await new Promise(r=>setTimeout(r,400));subject.close();await new Promise(r=>setTimeout(r,400));
      }
      if(mode.startsWith('object-'))subject.open({animate:mode==='object-true'});else if(['false','true-false'].includes(mode))subject.open(false);else subject.open();
      const samples=[];const start=performance.now();
      do{await frame();const panel=root().querySelector('[data-sf-modal-panel]'),css=getComputedStyle(panel);samples.push({opacity:Number(css.opacity),transform:css.transform,duration:css.transitionDuration});}while(performance.now()-start<380);
      const animateClass=root().classList.contains('animate'),focusInside=root().contains(document.activeElement);
      subject.close();await new Promise(r=>setTimeout(r,380));
      return{animateClass,animated:samples.some(s=>s.opacity>0&&s.opacity<1),settled:samples.at(-1).opacity,duration:samples.at(-1).duration,focusInside,restored:document.activeElement.id==='opener',state:root().dataset.sfModalState,opens,closes,samples};
    },{kind,mode});
    const enabled=!['false','object-false','true-false'].includes(mode),expectedMotion=enabled&&mode!=='reduce',events=['true-false','false-true'].includes(mode)?2:1;
    if(row.animateClass!==enabled||row.animated!==expectedMotion||row.settled!==1||!row.focusInside||!row.restored||row.state!=='closed'||row.opens!==events||row.closes!==events)failures.push({width,kind,mode,expectedMotion,...row});
    results.push({width,kind,mode,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
