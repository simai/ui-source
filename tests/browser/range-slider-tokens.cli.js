async(page)=>{
  const results=[];
  for(const width of [390,1280])for(const rtl of [false,true])for(const dark of [false,true]){
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-focus-lab.html?${rtl?'rtl':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
    await page.evaluate(dark=>document.documentElement.className=dark?'theme-dark':'theme-light',dark);
    for(const id of ['single','smart-single','multiple','smart-multiple']){
      const host=page.locator(`#${id}`),multiple=id.includes('multiple');
      // Explicit pixel overrides are test inputs, not product design defaults.
      await host.evaluate(e=>{
        e.setAttribute('style','--sf-thumb-handle--width:40px;--sf-thumb-handle--height:32px;--sf-range-slider-track--height:6px;--sf-thumb-inner--width:12px;--sf-thumb-inner--height:10px');
      });
      const surface=id.startsWith('smart-')?host.locator('.sf-range-slider'):host;
      await page.waitForFunction(id=>{
        const e=document.getElementById(id),r=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
        return Math.abs(r.querySelector('[role="slider"]').getBoundingClientRect().width-40)<.01;
      },id);
      await surface.scrollIntoViewIfNeeded();
      for(const value of multiple?[[0,100],[50,50]]:[0,100]){
        await surface.evaluate((r,value)=>SF.RangeSlider.setValue(r,value),value);
        await page.waitForFunction(id=>{
          const e=document.getElementById(id),r=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
          return !r.classList.contains('sf-range-slider-state-tap');
        },id);
        const sample=await surface.evaluate(r=>{
          const b=r.querySelector('.sf-range-slider-base').getBoundingClientRect();
          const rect=e=>{const v=e.getBoundingClientRect();return {width:v.width,height:v.height,x:v.x,y:v.y};};
          return {base:rect(r.querySelector('.sf-range-slider-base')),
            track:rect(r.querySelector('.sf-range-slider-track')),
            progress:rect(r.querySelector('.sf-range-slider-progress')),
            handles:[...r.querySelectorAll('[role="slider"]')].map(h=>({hit:rect(h),visual:rect(h.querySelector('.sf-thumb-handle')),inner:rect(h.querySelector('.sf-thumb-inner'))})),
            overflow:document.documentElement.scrollWidth>innerWidth};
        });
        if(sample.overflow||sample.track.height!==6||sample.progress.height!==6)throw new Error(`${id}: rail or page overflow ${JSON.stringify(sample)}`);
        for(const h of sample.handles){
          for(const part of [h.hit,h.visual])if(Math.abs(part.width-40)>.01||Math.abs(part.height-32)>.01)throw new Error(`${id}: inherited size ${JSON.stringify(h)}`);
          if(Math.abs(h.hit.x-h.visual.x)>.1||Math.abs(h.hit.y-h.visual.y)>.1)throw new Error('Offset visual');
          if(Math.abs(h.inner.width-12)>.01||Math.abs(h.inner.height-10)>.01)throw new Error('Inner override');
        }
        const values=Array.isArray(value)?value:[value];
        sample.handles.forEach((h,i)=>{
          const position=(h.hit.x+h.hit.width/2-sample.base.x)/sample.base.width;
          if(Math.abs(position-(rtl?100-values[i]:values[i])/100)>.001)throw new Error('Endpoint geometry');
        });
        results.push({width,rtl,dark,id,value});
      }
      if(id.startsWith('smart-')){
        const updated=await host.evaluate(async e=>{
          const root=e.querySelector('.sf-range-slider'),api=root.noUiSlider,before=e.value;
          e.setAttribute('root-style','--sf-thumb-handle--width:48px;--sf-thumb-handle--height:48px');
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const width=root.querySelector('.sf-thumb-handle').getBoundingClientRect().width;
          e.removeAttribute('root-style');
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          return {width,restored:root.querySelector('.sf-thumb-handle').getBoundingClientRect().width,same:api===root.noUiSlider,valueSame:before===e.value};
        });
        if(Math.abs(updated.width-48)>.01||Math.abs(updated.restored-40)>.01||!updated.same||!updated.valueSame)throw new Error(`Smart style lifecycle ${JSON.stringify(updated)}`);
      }
    }
    for(const id of ['disabled','smart-disabled']){
      const host=page.locator(`#${id}`),surface=id.startsWith('smart-')?host.locator('.sf-range-slider'):host;
      await surface.scrollIntoViewIfNeeded();await page.mouse.move(1,1);
      const sample=()=>surface.evaluate(r=>{
        const h=r.querySelector('.sf-thumb-handle'),i=r.querySelector('.sf-thumb-inner'),s=getComputedStyle(h);
        return {background:s.backgroundColor,inner:getComputedStyle(i).backgroundColor,w:i.getBoundingClientRect().width,value:SF.RangeSlider.getValue(r)};
      });
      const before=await sample();
      await surface.locator('[role="slider"]').hover();
      await surface.evaluate(async r=>Promise.all(r.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
      const after=await sample();
      if(JSON.stringify(before)!==JSON.stringify(after))throw new Error(`Disabled hover ${id}`);
      const role=await surface.evaluate(r=>{
        const probe=document.createElement('span');probe.style.backgroundColor='var(--sf-disable)';r.append(probe);
        const color=getComputedStyle(probe).backgroundColor;probe.remove();return color;
      });
      if(after.background!==role)throw new Error(`Disabled role ${id}`);
      await surface.click({position:{x:10,y:10}});
      if((await sample()).value!==before.value)throw new Error('Disabled changed value');
      results.push({width,rtl,dark,id,disabled:true});
    }
  }
  await page.screenshot({path:'output/playwright/range-slider-tokens.png'});
  return {status:'passed',cases:results.length,results};
}
