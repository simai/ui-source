async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','buttons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`${base}/examples/slider-customization.html`);if(!response.ok)throw Error('Missing actual example');
      const main=document.querySelector('main');main.innerHTML=await response.text();
      for(const inert of [...main.querySelectorAll('script')]){const live=document.createElement('script');live.textContent=inert.textContent;inert.replaceWith(live);}
    },{base,theme});
    await page.waitForFunction(()=>document.querySelector('sf-slider').getSlider()?.initialized);
    await page.getByRole('button',{name:'Next slide',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('output').value==='Слайд 2');
    const before=await page.evaluate(()=>{window.retainedSlider=document.querySelector('sf-slider').getSlider();return getComputedStyle(document.querySelector('.sf-slider')).paddingTop;});
    await page.getByRole('button',{name:'Изменить отступ',exact:true}).click();
    await page.waitForFunction(before=>getComputedStyle(document.querySelector('.sf-slider')).paddingTop!==before,before);
    const row=await page.evaluate(()=>({index:document.querySelector('sf-slider').getSlider().realIndex,same:document.querySelector('sf-slider').getSlider()===retainedSlider,output:document.querySelector('output').value,overflow:document.documentElement.scrollWidth>innerWidth}));
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    await page.screenshot({path:`output/playwright/slider-customization-${width}-${theme}.png`,fullPage:true});
    await page.evaluate(()=>document.querySelector('sf-slider').setAttribute('speed','100'));
    await page.waitForFunction(()=>document.querySelector('sf-slider').getSlider()!==retainedSlider&&document.querySelector('sf-slider').getSlider()?.params.speed===100);
    const configuration=await page.evaluate(()=>({oldDestroyed:!!retainedSlider.destroyed,speed:document.querySelector('sf-slider').getSlider().params.speed}));
    results.push({width,theme,...row,configuration});if(row.index!==1||!row.same||row.output!=='Слайд 2'||row.overflow||!configuration.oldDestroyed||configuration.speed!==100)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
