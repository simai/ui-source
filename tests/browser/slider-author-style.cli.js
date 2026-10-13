async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const dir of ['ltr','rtl'])for(const loop of [false,true]){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(({dir,loop})=>{
      document.documentElement.dir=dir;document.documentElement.className=dir==='ltr'?'theme-light':'theme-dark';
      document.querySelector('main').innerHTML=`<sf-slider id="subject" loop="${loop}" speed="0" thumbs root-style="padding:var(--sf-space-1)">${[1,2,3,4].map(i=>`<div slot="slide" class="bg-surface-container p-2 radius-default">Слайд ${i}<button type="button" class="sf-button">Действие ${i}</button></div>`).join('')}</sf-slider>`;
      window.changes=[];document.querySelector('#subject').addEventListener('sf-slide-change',e=>changes.push(e.detail.realIndex));
    },{dir,loop});
    await page.waitForFunction(()=>document.querySelector('#subject').getSlider()?.initialized);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const row=await page.locator('#subject').evaluate(async(host,loop)=>{
      const settle=async()=>{await new Promise(r=>setTimeout(r,80));};
      const root=host.querySelector('.sf-slider'),slider=host.getSlider(),thumbs=root._sfSliderThumbs;
      const probe=document.createElement('div');probe.style.padding='var(--sf-space-1)';document.body.append(probe);
      const initialStyle=getComputedStyle(root).paddingTop===getComputedStyle(probe).paddingTop;
      (loop?slider.slideToLoop:slider.slideTo).call(slider,1,0,false);await settle();
      const active=root.querySelector('.swiper-slide-active button');active.focus();const count=changes.length;
      const beforeIndex=slider.realIndex;
      host.style.padding='var(--sf-space-2)';host.removeAttribute('root-style');host.setAttribute('root-class','bg-surface-container');await settle();
      probe.style.padding='var(--sf-space-2)';
      const projected=getComputedStyle(root).paddingTop===getComputedStyle(probe).paddingTop&&root.classList.contains('bg-surface-container');
      const stable=host.getSlider()===slider&&!slider.destroyed&&root._sfSliderThumbs===thumbs&&host.getSlider()?.realIndex===beforeIndex&&document.activeElement===active;
      host.setAttribute('root-style','padding:var(--sf-space-3)');await settle();probe.style.padding='var(--sf-space-3)';
      const override=getComputedStyle(root).paddingTop===getComputedStyle(probe).paddingTop;
      host.removeAttribute('root-style');host.removeAttribute('style');host.removeAttribute('root-class');await settle();
      const reset=!root.style.padding&&!root.classList.contains('bg-surface-container');
      const silent=changes.length===count;
      let callbacks=0;await host.afterRender(()=>{callbacks++;});await settle();
      const callback=callbacks===1&&host.getSlider()===slider;
      const realIndex=host.getSlider()?.realIndex;
      probe.remove();return{initialStyle,projected,stable,override,reset,silent,callback,realIndex,beforeIndex};
    },loop);
    const count=await page.evaluate(()=>changes.length);
    await page.locator('#subject .sf-slider-button-next').click();
    await page.waitForFunction(()=>document.querySelector('#subject').getSlider().realIndex===2,null,{timeout:2000}).catch(()=>{});
    const action=await page.evaluate(count=>({index:document.querySelector('#subject').getSlider().realIndex,events:changes.length-count}),count);
    results.push({width,dir,loop,...row,action});if(['initialStyle','projected','stable','override','reset','silent','callback'].some(k=>!row[k])||row.realIndex!==1||action.index!==2||action.events!==1)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
