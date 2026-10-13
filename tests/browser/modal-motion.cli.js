async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser', results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const kind of ['ordinary','smart'])for(const mode of ['normal','custom','reduce','forced','forced-dark']){
    await page.setViewportSize({width,height:700});
    await page.emulateMedia({reducedMotion:mode==='reduce'?'reduce':'no-preference',forcedColors:mode.startsWith('forced')?'active':'none',colorScheme:mode==='forced-dark'?'dark':'light'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['modal','icon-buttons','close'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/modal','smart/modal'])await page.addScriptTag({url:`${base}/${path}/js/modal.js`});
    await page.evaluate(async({kind,mode})=>{
      const main=document.querySelector('main');main.innerHTML='<button id="opener">Открыть</button>';
      if(mode==='custom')document.documentElement.style.setProperty('--sf-duration-normal','0.6s');
      let subject;
      if(kind==='ordinary'){const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];subject=new Constructor({id:'motion',param:{title:'Движение окна',showFooter:false,html:'<p>Содержимое окна</p>'}});}
      else{subject=document.createElement('sf-modal');subject.setAttribute('title','Движение окна');subject.innerHTML='<p slot="content">Содержимое окна</p>';main.append(subject);}
      for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
      document.getElementById('opener').focus();window.motionSubject=subject;window.motionRoot=()=>subject.getModalRoot?.()||subject.template;
      window.motionCloses=0;window.motionCloseAt=0;(kind==='ordinary'?motionRoot():subject).addEventListener('modal:after-close',()=>{motionCloses++;motionCloseAt=performance.now();});
      subject.open();
    },{kind,mode});
    await page.waitForFunction(()=>{const p=motionRoot()?.querySelector('[data-sf-modal-panel]');return p&&getComputedStyle(p).opacity==='1';});
    await page.keyboard.press('Tab');
    const row=await page.evaluate(()=>{
      const root=motionRoot(),panel=root.querySelector('[data-sf-modal-panel]'),surface=root.querySelector('[data-sf-modal-surface]'),overlay=root.querySelector('[data-sf-modal-overlay]');
      const css=getComputedStyle(panel),s=getComputedStyle(surface),o=getComputedStyle(overlay),focus=document.activeElement,glyph=getComputedStyle(root.querySelector('.sf-close-icon'));
      return{panelDuration:css.transitionDuration,overlayDuration:o.transitionDuration,background:s.backgroundColor,borderColor:s.borderTopColor,borderWidth:s.borderTopWidth,focusInside:root.contains(focus),focusOutline:getComputedStyle(focus).outlineStyle,glyphPaint:glyph.backgroundColor,glyphMask:glyph.maskImage};
    });
    if(mode.startsWith('forced')){
      await page.screenshot({path:`output/playwright/modal-motion-${mode}-${kind}-${width}.png`});
      row.disabled=await page.evaluate(()=>{
        const button=motionRoot().querySelector('[data-sf-modal-close]'),probe=document.createElement('span');probe.style.color='GrayText';document.body.append(probe);
        button.disabled=true;const color=getComputedStyle(button.querySelector('.sf-close-icon')).backgroundColor,expected=getComputedStyle(probe).color;button.disabled=false;probe.remove();return{color,expected};
      });
      if(row.disabled.color!==row.disabled.expected)failures.push({width,kind,mode,reason:'disabled-glyph',...row.disabled});
    }
    const closing=await page.evaluate(async()=>{
      const start=performance.now();motionSubject.close();
      await new Promise(resolve=>setTimeout(resolve,280));const middle=motionRoot().dataset.sfModalState;
      while(motionRoot().dataset.sfModalState!=='closed'&&performance.now()-start<1500)await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return{middle,elapsed:performance.now()-start,closeElapsed:motionCloseAt-start,state:motionRoot().dataset.sfModalState,closes:motionCloses,restored:document.activeElement.id==='opener'};
    });
    const zero=s=>s.split(',').every(v=>parseFloat(v)===0),expected=mode==='custom'?0.6:0.3;
    if(mode==='reduce'?!zero(row.panelDuration)||!zero(row.overlayDuration):!row.overlayDuration.split(',').every(v=>parseFloat(v)===expected)||!row.panelDuration.split(',').every(v=>parseFloat(v)===expected))failures.push({width,kind,mode,reason:'duration',...row});
    if(mode==='custom'&&closing.middle!=='closing')failures.push({width,kind,mode,reason:'premature-close',...closing});
    if(mode==='reduce'&&closing.closeElapsed>150)failures.push({width,kind,mode,reason:'reduced-delay',...closing});
    if(!row.focusInside||closing.state!=='closed'||closing.closes!==1||!closing.restored)failures.push({width,kind,mode,reason:'lifecycle',...row,...closing});
    if(mode.startsWith('forced')&&(row.borderColor===row.background||parseFloat(row.borderWidth)<=0||row.focusOutline==='none'||row.glyphPaint===row.background||row.glyphMask==='none'))failures.push({width,kind,mode,reason:'forced-boundary',...row});
    results.push({width,kind,mode,...row,...closing});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
