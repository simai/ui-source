async(page)=>{
  const results=[];
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [390,1280])for(const rtl of [false,true])for(const large of [false,true]){
    await page.setViewportSize({width,height:1200});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-labels-lab.html?${[rtl&&'rtl',large&&'large'].filter(Boolean).join('&')}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tooltip .sf-range-slider-labels')?.style.blockSize);
    for(const id of ['text','tooltip','smart-text','smart-tooltip']){
      const host=page.locator(`#${id}`),surface=id.startsWith('smart-')?host.locator('.sf-range-slider'):host;
      for(const values of [[0,100],[49,51],[50,50]]){
        await surface.evaluate((r,values)=>SF.RangeSlider.setValue(r,values),values);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const sample=await surface.evaluate(r=>{
          const row=r.querySelector('.sf-range-slider-labels'),rect=e=>e.getBoundingClientRect().toJSON();
          return {root:rect(r),row:rect(row),base:rect(r.querySelector('.sf-range-slider-base')),
            labels:[...row.children].filter(e=>getComputedStyle(e).display!=='none').map(e=>({text:e.textContent,rect:rect(e)})),
            values:SF.RangeSlider.getValue(r),aria:[...r.querySelectorAll('[role="slider"]')].map(e=>e.getAttribute('aria-valuenow')),
            hidden:row.getAttribute('aria-hidden'),overflow:document.documentElement.scrollWidth>innerWidth};
        });
        if(sample.overflow||sample.hidden!=='true')throw new Error(`${id}: overflow/ARIA`);
        if(JSON.stringify(sample.values)!==JSON.stringify(values)||sample.aria.join(',')!==values.join(','))throw new Error('Changed numeric meaning');
        for(const label of sample.labels){
          const r=label.rect;
          if(r.left<sample.row.left-.1||r.right>sample.row.right+.1||r.top<sample.root.top-.1||r.bottom>sample.root.bottom+.1)throw new Error(`Clipped ${JSON.stringify(sample)}`);
        }
        const [a,b]=sample.labels;
        if(b&&Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>0.1)throw new Error('Overlapping labels');
        if(values[0]>=49&&(sample.labels.length!==1||!a.text.includes(' – ')))throw new Error('Missing combined range');
        results.push({width,rtl,large,id,values,visible:sample.labels.length,height:sample.root.height});
      }
      // Unmerge after narrow values; typography and resize use real measured widths.
      await surface.evaluate(r=>SF.RangeSlider.setValue(r,[0,100]));
    }
  }
  await page.setViewportSize({width:390,height:1200});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  const resized=await page.locator('.sf-range-slider-labels').evaluateAll(rows=>rows.every(row=>{
    const b=row.getBoundingClientRect();
    return [...row.children].filter(e=>getComputedStyle(e).display!=='none').every(e=>{
      const r=e.getBoundingClientRect();return r.left>=b.left-.1&&r.right<=b.right+.1&&r.bottom<=b.bottom+.1;
    });
  }));
  if(!resized)throw new Error('Live resize label bounds');
  const typography=await page.locator('#text').evaluate(async root=>{
    root.style.setProperty('--sf-thumb-text--font-size','24px');
    root.style.setProperty('--sf-thumb-text--line-height','32px');
    root.style.display='none';SF.RangeSlider.setValue(root,[20,80]);
    await new Promise(requestAnimationFrame);root.style.removeProperty('display');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const row=root.querySelector('.sf-range-slider-labels'),bounds=row.getBoundingClientRect();
    return {font:getComputedStyle(row.querySelector('.sf-thumb-text')).fontSize,
      fits:[...row.children].filter(e=>getComputedStyle(e).display!=='none').every(e=>{
        const r=e.getBoundingClientRect();return r.left>=bounds.left-.1&&r.right<=bounds.right+.1&&r.bottom<=bounds.bottom+.1;
      }),values:SF.RangeSlider.getValue(root)};
  });
  if(typography.font!=='24px'||!typography.fits||typography.values.join(',')!=='20,80')throw new Error(`Typography/reveal ${JSON.stringify(typography)}`);
  const lifecycle=await page.evaluate(async()=>{
    const e=document.createElement('sf-range-slider');
    e.setAttribute('value','37');e.setAttribute('label','text');
    e.setAttribute('style','--sf-thumb-handle--width:48px;--sf-thumb-handle--height:48px');
    document.querySelector('main').append(e);
    const until=async predicate=>{for(let i=0;i<120;i++){if(predicate())return;await new Promise(requestAnimationFrame);}throw new Error('Lifecycle timeout');};
    await until(()=>e.querySelector('.sf-range-slider-labels')?.style.blockSize);
    const first=e.querySelector('.sf-range-slider'),oldState=first.__sfRangeSliderLabels;
    const initial=first.querySelector('.sf-thumb-handle').getBoundingClientRect().width;
    e.setAttribute('label','tooltip');
    await until(()=>e.querySelector('.sf-range-slider-labels .sf-tooltip'));
    const root=e.querySelector('.sf-range-slider'),rebuilt=root.querySelector('.sf-thumb-handle').getBoundingClientRect().width;
    const value=e.value,oldReleased=!oldState.active;
    const state=root.__sfRangeSliderLabels;
    e.remove();await new Promise(requestAnimationFrame);
    return {initial,rebuilt,value,oldReleased,removedReleased:!state.active};
  });
  if(lifecycle.initial!==48||lifecycle.rebuilt!==48||Number(lifecycle.value)!==37||!lifecycle.oldReleased||!lifecycle.removedReleased)throw new Error(`Lifecycle ${JSON.stringify(lifecycle)}`);
  const removal=await page.locator('#text').evaluate(async r=>{
    const state=r.__sfRangeSliderLabels,api=r.noUiSlider;
    const container=document.createElement('section');r.parentElement.append(container);container.append(r);
    await new Promise(requestAnimationFrame);
    const moved=state.active&&api===r.noUiSlider;
    container.remove();await new Promise(requestAnimationFrame);
    return {moved,released:!state.active,engineRemoved:!r.noUiSlider};
  });
  if(!removal.moved||!removal.released||!removal.engineRemoved)throw new Error(`Base removal ${JSON.stringify(removal)}`);
  await page.setViewportSize({width:390,height:1100});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-labels-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-tooltip .sf-range-slider-labels')?.style.blockSize);
  await page.screenshot({path:'output/playwright/range-slider-labels.png'});
  if(errors.length)throw new Error(`Browser errors: ${errors.join('; ')}`);
  return {status:'passed',cases:results.length,results,lifecycle,removal,resized,typography,errors};
}
