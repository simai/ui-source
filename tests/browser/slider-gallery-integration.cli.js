async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(dir=>{
      document.documentElement.dir=dir;
      document.querySelector('main').innerHTML='<sf-gallery id="gallery" speed="0" thumbs="false" show-header="true" title="Галерея"><figure slot="slide" class="bg-primary-container p-3">Первая иллюстрация</figure><figure slot="slide" class="bg-secondary-container p-3">Вторая иллюстрация</figure><figure slot="slide" class="bg-tertiary-container p-3">Третья иллюстрация</figure></sf-gallery>';
    },dir);
    await page.waitForFunction(()=>document.querySelector('#gallery').getInlineSlider()?.getSlider()?.initialized);
    await page.evaluate(()=>document.querySelector('#gallery').goTo(2));
    await page.waitForFunction(()=>document.querySelector('#gallery').getInlineSlider().getSlider().realIndex===1);
    const inline=await page.evaluate(async()=>{
      const g=document.querySelector('#gallery'),s=g.getInlineSlider(),instance=s.getSlider();
      s.style.padding='var(--sf-space-2)';await new Promise(r=>setTimeout(r,120));
      return{current:g.current,index:s.getSlider().realIndex,same:s.getSlider()===instance};
    });
    await page.evaluate(()=>document.querySelector('#gallery').open(2));
    await page.waitForFunction(()=>document.querySelector('#gallery').getLightboxSlider()?.getSlider()?.initialized);
    await page.waitForFunction(()=>document.querySelector('#gallery').getLightboxSlider().getSlider().realIndex===1);
    const lightbox=await page.evaluate(async()=>{
      const g=document.querySelector('#gallery'),s=g.getLightboxSlider(),instance=s.getSlider();
      s.setAttribute('root-class','bg-surface-container');await new Promise(r=>setTimeout(r,120));
      return{current:g.current,index:s.getSlider().realIndex,same:s.getSlider()===instance,open:g.openState};
    });
    await page.evaluate(()=>document.querySelector('#gallery').getLightboxSlider().slideNext());
    await page.waitForFunction(()=>document.querySelector('#gallery').current===3);
    await page.evaluate(()=>document.querySelector('#gallery').close());
    await page.waitForFunction(()=>!document.querySelector('#gallery').openState);
    const closed=await page.evaluate(()=>({current:document.querySelector('#gallery').current,index:document.querySelector('#gallery').getInlineSlider().getSlider().realIndex}));
    results.push({width,dir,inline,lightbox,closed});
    if(!inline.same||inline.index!==1||inline.current!==2||!lightbox.same||!lightbox.open||lightbox.index!==1||lightbox.current!==2||closed.current!==3||closed.index!==2)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
