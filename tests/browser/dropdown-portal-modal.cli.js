async(page)=>{
  const results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,context,actual)=>{if(!ok)failures.push({context,actual});};
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const modal of ['native','framework','smart'])for(const fallback of [false,true])for(const id of ['base','smart']){
    const prefix=`${width}/${modal}/${fallback}/${id}`;
    await page.setViewportSize({width,height:800});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.addStyleTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/modal/css/modal.css'});
    await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/modal/js/modal.js'});
    if(modal==='smart')await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/smart/modal/js/modal.js'});
    await page.evaluate(async({id,fallback,modal})=>{
      if(fallback)HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),wrapper=document.createElement('section');
      wrapper.className='theme-dark';wrapper.style.cssText='overflow:hidden;height:100px;max-width:100%';
      wrapper.append(host);document.querySelector('main').replaceChildren();
      if(modal==='native'){
        const dialog=document.createElement('dialog');dialog.id='test-modal';
        dialog.style.cssText='width:min(600px,80vw);padding:var(--sf-space-2)';
        dialog.append(wrapper);document.body.append(dialog);dialog.showModal();
        window.testModal={root:dialog,close:()=>dialog.close(),open:()=>dialog.showModal()};
      }else if(modal==='framework'){
        const Constructor=window.SF_PENDING_COMPONENTS.find(([name])=>name==='Modal')[1];
        const instance=new Constructor({id:'test-modal',param:{title:'Выбор города',contentNodes:[wrapper],showFooter:false}});
        instance.open({animate:false});
        window.testModal={root:instance.template,close:()=>instance.close({animate:false}),open:()=>instance.open({animate:false})};
      }else{
        // Exercise actual Smart Modal layer/focus lifecycle. Insert into its
        // rendered content slot; slot cloning itself is a separate contract.
        const instance=document.createElement('sf-modal');
        instance.setAttribute('modal-id','test-modal');instance.setAttribute('title','Выбор города');
        instance.innerHTML='<section slot="content" id="modal-slot"></section>';
        document.body.append(instance);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        instance.open({animate:false});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        instance.getModalRoot().querySelector('#modal-slot').append(wrapper);
        window.testModal={get root(){return instance.getModalRoot();},close:()=>instance.close({animate:false}),open:()=>instance.open({animate:false})};
      }
    },{id,fallback,modal});
    await page.waitForTimeout(120);
    const host=page.locator(`#test-modal #${id}`),button=host.locator('.sf-dropdown-field > button');
    await button.click();await page.waitForTimeout(100);
    const state=()=>page.evaluate(id=>{
      const host=document.querySelector(`#test-modal #${id}`),root=host.matches('.sf-dropdown')?host:host.querySelector('.sf-dropdown');
      const list=root.__sfDropdownPortalList||host.querySelector('.sf-list');
      const option=list.querySelector('[data-value="moscow"]'),rect=option.getBoundingClientRect();
      const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
      return {expanded:root.querySelector('.sf-dropdown-field > button').getAttribute('aria-expanded'),hidden:list.hidden,
        visible:rect.width>0&&rect.height>0,reachable:option.contains(hit),hit:hit?.tagName,hitClass:hit?.className,
        insideModal:testModal.root.contains(list),projected:!!root.__sfDropdownPortalList,
        value:root.querySelector('input[type="hidden"]').value};
    },id);
    let s=await state();check(s.reachable,`${prefix}: projected option receives pointer`,s);
    if(fallback&&modal==='smart'&&id==='smart')await page.screenshot({path:`output/playwright/dropdown-smart-modal-${width}.png`});
    if(s.reachable){
      await page.locator('#test-modal .sf-list-item[data-value="moscow"],body > .sf-dropdown > .sf-list .sf-list-item[data-value="moscow"]').click();
      s=await state();check(s.value==='moscow',`${prefix}: selection`,s);
      await button.click();await page.waitForTimeout(80);
    }
    if(s.reachable){
      await button.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(60);
      await page.keyboard.press('Escape');await page.waitForTimeout(100);
      s=await state();
      check(s.expanded==='false'&&await page.locator('#test-modal').isVisible(),`${prefix}: first Escape closes only dropdown`,s);
      for(const key of ['Tab','Shift+Tab']){
        await button.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(60);
        await page.keyboard.press(key);await page.waitForTimeout(100);
        s=await state();
        check(s.expanded==='false'&&await page.evaluate(()=>testModal.root.contains(document.activeElement)),`${prefix}: ${key} stays in modal`,s);
      }
      await button.click();await page.waitForTimeout(60);
    }
    await page.evaluate(()=>testModal.close());await page.waitForTimeout(350);
    s=await state();check(!s.projected&&s.expanded==='false'&&!s.visible,`${prefix}: closing modal releases child panel`,s);
    await page.evaluate(()=>testModal.open());await page.waitForTimeout(120);
    s=await state();check(s.expanded==='false'&&!s.projected,`${prefix}: reopen starts with closed dropdown`,s);
    results.push({width,modal,fallback,id});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
