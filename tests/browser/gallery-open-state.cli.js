async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];let scenario='setup';
  page.on('pageerror',e=>errors.push({scenario,message:e.message,stack:e.stack}));
  for(const width of [390,1280])for(const input of ['pointer','keyboard','attribute','api']) {
    scenario=`${width}/${input}`;
    await page.setViewportSize({width,height:700});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(()=>{document.querySelector('main').innerHTML='<sf-gallery id="subject" speed="0" thumbs="false" arrows="false"><article slot="slide" class="p-3">Первый слайд</article><article slot="slide" class="p-3">Второй слайд</article><article slot="slide" class="p-3">Третий слайд</article></sf-gallery>';});
    await page.waitForFunction(()=>document.getElementById('subject').getInlineSlider()?.getSlider()?.initialized);
    await page.evaluate(()=>{
      const g=document.getElementById('subject');g.goTo(2);window.beforeGalleryOpen=g.getInlineSlider().getSlider();window.galleryDestroyCount=0;window.galleryUpdates=[];
      beforeGalleryOpen.on('destroy',()=>window.galleryDestroyCount++);
      g.addEventListener('sf-updated',e=>{if(e.target===g)window.galleryUpdates.push(e.detail.updateMode);});
    });
    await page.waitForFunction(()=>document.getElementById('subject').getInlineSlider().getSlider().realIndex===1);
    const trigger=page.locator('[data-sf-gallery-slider="inline"] [data-sf-gallery-open="2"]');
    if(input==='pointer')await trigger.click();
    else if(input==='keyboard'){await trigger.focus();await page.keyboard.press('Enter');}
    else await page.evaluate(input=>{const g=document.getElementById('subject');if(input==='attribute')g.setAttribute('open','');else g.open(2);},input);
    await page.waitForFunction(()=>{const g=document.getElementById('subject'),s=g.getLightboxSlider();return s?.isConnected&&s===g.getModal().getModalRoot()?.querySelector('[data-sf-gallery-slider="lightbox"]')&&s.getSlider()?.realIndex===1;});
    const opened=await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);const g=document.getElementById('subject'),s=g.getLightboxSlider();return{same:g.getInlineSlider().getSlider()===beforeGalleryOpen,destroyed:!!beforeGalleryOpen.destroyed,count:galleryDestroyCount,current:g.current,open:g.openState,updates:galleryUpdates.slice(),live:s.isConnected&&s===g.getModal().getModalRoot().querySelector('[data-sf-gallery-slider="lightbox"]'),slides:s.getSlider().slides.length,label:s.querySelector('.swiper-slide-active')?.textContent.trim()};});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('subject').openState);
    const closed=await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);const g=document.getElementById('subject');return{same:g.getInlineSlider().getSlider()===beforeGalleryOpen,index:g.getInlineSlider().getSlider().realIndex,count:galleryDestroyCount};});
    const row={width,input,opened,closed};results.push(row);
    if(!opened.same||opened.destroyed||opened.count||opened.current!==2||!opened.open||!opened.live||opened.slides!==3||opened.label!=='Второй слайд'||!closed.same||closed.index!==1||closed.count)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
