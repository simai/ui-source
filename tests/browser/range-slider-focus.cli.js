async(page)=>{
  const results=[];
  const owners=['single','multiple','multiple','smart-single','smart-multiple','smart-multiple'];
  for(const width of [390,1280]) for(const dark of [false,true]) for(const forcedColors of ['none','active']) {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({forcedColors,reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-focus-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
    await page.evaluate(dark=>document.documentElement.className=dark?'theme-dark':'theme-light',dark);
    const settle=()=>page.locator('main').evaluate(async e=>{
      await Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));
    });
    await settle();
    const sample=()=>page.evaluate(()=>{
      const e=document.activeElement;
      const thumb=e.querySelector('.sf-thumb-handle');
      const style=thumb&&getComputedStyle(thumb);
      return {id:e.id,owner:e.closest('[id]')?.id,role:e.getAttribute('role'),
        keyboard:e.matches(':focus-visible'),shadow:style?.boxShadow,
        outline:style?.outlineStyle,outlineWidth:parseFloat(style?.outlineWidth||'0')};
    });
    const first=page.locator('#single .sf-range-slider-handle');
    await first.click();await page.mouse.move(1,1);await settle();
    const pointer=await first.evaluate(e=>({keyboard:e.matches(':focus-visible'),
      shadow:getComputedStyle(e.querySelector('.sf-thumb-handle')).boxShadow,
      outline:getComputedStyle(e.querySelector('.sf-thumb-handle')).outlineStyle}));
    if(pointer.keyboard||pointer.shadow!=='none'||pointer.outline!=='none')throw new Error('Pointer focus treatment');
    await page.locator('#before').focus();
    const focus=[];
    for(const owner of owners) {
      await page.keyboard.press('Tab');await settle();
      const state=await sample();
      if(state.owner!==owner||state.role!=='slider'||!state.keyboard)throw new Error(`Tab ownership ${JSON.stringify(state)}`);
      if(forcedColors==='none'&&(state.shadow==='none'||state.shadow.startsWith('rgba(0, 0, 0, 0)')))throw new Error('Invisible focus');
      if(forcedColors==='active'&&(state.outline==='none'||state.outlineWidth<=0))throw new Error('Invisible system focus');
      const value=await page.locator(':focus').getAttribute('aria-valuenow');
      await page.keyboard.press('ArrowRight');
      const changed=await page.locator(':focus').getAttribute('aria-valuenow');
      if(Number(changed)!==Number(value)+5)throw new Error(`Keyboard step ${value} -> ${changed}`);
      focus.push(state);
    }
    await page.keyboard.press('Tab');
    if((await sample()).id!=='after')throw new Error('Extra or disabled tab stop');
    await page.locator('#before').focus();await page.keyboard.press('Tab');
    await page.keyboard.press('Home');
    if(Number(await first.getAttribute('aria-valuenow'))!==0)throw new Error('Home');
    await page.keyboard.press('End');
    if(Number(await first.getAttribute('aria-valuenow'))!==100)throw new Error('End');
    await page.locator('#smart-single').evaluate(e=>e.disabled=true);
    await page.waitForFunction(()=>!document.querySelector('#smart-single [tabindex="0"]'));
    await page.locator('#smart-single').evaluate(e=>e.disabled=false);
    await page.waitForFunction(()=>document.querySelector('#smart-single [tabindex="0"][role="slider"]'));
    const extras=await page.locator('.sf-range-slider-touch-area[tabindex],.sf-range-slider-touch-area[role]').count();
    if(extras)throw new Error('Decorative interactive nodes');
    results.push({width,dark,forcedColors,pointer,focus});
  }
  await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:900});
  await page.evaluate(()=>document.documentElement.className='theme-light');
  await page.locator('#before').focus();await page.keyboard.press('Tab');
  await page.locator('main').evaluate(async e=>{
    await Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));
  });
  await page.screenshot({path:'output/playwright/range-slider-focus-mobile.png'});
  return {status:'passed',scenarios:results.length,focusChecks:results.length*6,results};
}
