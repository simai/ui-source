async(page)=>{
  const results=[];
  for(const width of [390,1280])for(const rtl of [false,true])for(const large of [false,true]){
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-focus-lab.html?${[rtl&&'rtl',large&&'large'].filter(Boolean).join('&')}`);
    await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
    for(const id of ['single','multiple','smart-single','smart-multiple']){
      const host=page.locator(`#${id}`);
      const multiple=id.includes('multiple');
      await host.evaluate((e,multiple)=>{
        const root=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
        SF.RangeSlider.setValue(root,multiple?[25,75]:25);
      },multiple);
      // noUiSlider briefly rejects dragging during its programmatic-set phase.
      // Wait for that actual state to end; do not alter the engine in the test.
      await page.waitForFunction(id=>{
        const e=document.getElementById(id),root=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
        return !root.classList.contains('sf-range-slider-state-tap');
      },id);
      // Smart hosts may use display:contents; scroll the actual visual root.
      await (id.startsWith('smart-')?host.locator('.sf-range-slider'):host).scrollIntoViewIfNeeded();
      const sample=()=>host.evaluate(e=>{
        const root=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
        const base=root.querySelector('.sf-range-slider-base').getBoundingClientRect(),r=root.getBoundingClientRect();
        return {value:SF.RangeSlider.getValue(root),width:r.width,height:r.height,
          base:{x:base.x,y:base.y,width:base.width,height:base.height},direction:root.noUiSlider.options.direction,
          centers:[...root.querySelectorAll('[role="slider"]')].map(h=>{const b=h.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,relative:(b.x+b.width/2-base.x)/base.width};})};
      });
      const before=await sample(),expected=multiple?[25,75]:[25];
      before.centers.forEach((center,i)=>{
        const p=(rtl?100-expected[i]:expected[i])/100;
        if(Math.abs(center.relative-p)>0.001)throw new Error(`${id} origin ${JSON.stringify(before)}`);
      });
      if(before.direction!==(rtl?'rtl':'ltr'))throw new Error('Engine direction');
      const h=before.centers[0],x=before.base.x+before.base.width*.4;
      await page.mouse.move(h.x,h.y);await page.mouse.down();
      await page.mouse.move(x,h.y,{steps:8});await page.mouse.up();
      let changed=await sample(),numeric=Array.isArray(changed.value)?changed.value[0]:changed.value;
      if(numeric!==(rtl?60:40))throw new Error(`${id} drag ${numeric}`);
      const handle=host.locator('[role="slider"]').first();
      await handle.focus();await page.keyboard.press('ArrowRight');
      changed=await sample();numeric=Array.isArray(changed.value)?changed.value[0]:changed.value;
      if(numeric!==(rtl?55:45))throw new Error(`${id} keyboard direction ${numeric}`);
      if(before.width!==changed.width||before.height!==changed.height)throw new Error(`${id} unstable layout`);
      if(!multiple){
        await page.mouse.click(changed.base.x+changed.base.width*.6,changed.base.y+changed.base.height/2);
        const clicked=await sample();
        if(clicked.value!==(rtl?40:60))throw new Error(`${id} track click ${clicked.value}`);
      }
      results.push({width,rtl,large,id,initial:before.value,drag:rtl?60:40,keyboard:numeric,widthPx:before.width,heightPx:before.height});
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw new Error(`Page overflow ${width}/${rtl}/${large}`);
  }
  await page.screenshot({path:'output/playwright/range-slider-rtl-large.png'});
  return {status:'passed',cases:results.length,results};
}
