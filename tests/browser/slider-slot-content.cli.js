async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const kind of ['slider','gallery'])for(const mode of ['container','template','decorated','setSlot']){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(({kind,mode})=>{
      const cards='\n  <!-- first card -->\n  <article class="p-2 bg-surface-container"><h3>Первая карточка</h3><p>Описание</p><a href="#details">Ссылка</a></article>\n  <article class="p-2 bg-surface-container"><h3>Вторая карточка</h3><p>Описание</p></article>\n';
      window.cardsForSlots=cards;let source=mode==='template'?`<template slot="slide">${cards}</template>`:`<div slot="slide">${cards}</div>`;
      if(mode==='decorated')source='<article slot="slide" class="p-2"><h3>Первая карточка</h3><p>Описание</p><a href="#details">Ссылка</a></article><article slot="slide" class="p-2"><h3>Вторая карточка</h3><p>Описание</p></article>';
      document.querySelector('main').innerHTML=`<sf-${kind} id="subject" data-probe-mode="${mode}" speed="0" thumbs="false" dots="true" root-class="sf-slider--content">${source}</sf-${kind}>`;
    },{kind,mode});
    await page.waitForFunction(kind=>{const el=document.getElementById('subject'),s=kind==='slider'?el.getSlider?.():el.getInlineSlider?.()?.getSlider?.();return s?.initialized;},kind);
    if(mode==='setSlot'){
      await page.evaluate(kind=>{const el=document.getElementById('subject');window.beforeSlot=kind==='slider'?el.getSlider():el.getInlineSlider().getSlider();el.setSlot('slide',cardsForSlots);},kind);
      await page.waitForFunction(kind=>{const el=document.getElementById('subject'),s=kind==='slider'?el.getSlider?.():el.getInlineSlider?.()?.getSlider?.();return s!==beforeSlot&&s?.initialized;},kind);
    }
    await page.waitForFunction(kind=>{const el=document.getElementById('subject'),s=kind==='slider'?el.getSlider():el.getInlineSlider().getSlider();return [...s.slides].filter(n=>n.querySelector('h3')).length===2&&s.pagination.bullets.length===s.slides.length;},kind);
    const inline=await page.evaluate(kind=>{const el=document.getElementById('subject'),s=kind==='slider'?el.getSlider():el.getInlineSlider().getSlider();return{count:s.slides.length,labels:[...s.slides].map(n=>n.querySelector('h3')?.textContent||n.textContent.trim()),dots:s.pagination.bullets.length};},kind);
    let lightbox=null;
    if(kind==='gallery'&&inline.count===2){
      await page.evaluate(()=>document.getElementById('subject').open(2));
      await page.waitForFunction(()=>document.getElementById('subject').getLightboxSlider()?.getSlider()?.initialized);
      // Record a wrong index as an assertion failure rather than losing the
      // remaining evidence to a timeout. Zero-speed modal open sync uses RAF.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      lightbox=await page.evaluate(()=>{const s=document.getElementById('subject').getLightboxSlider().getSlider();return{count:s.slides.length,index:s.realIndex,selected:s.slides[s.activeIndex].querySelector('h3')?.textContent};});
      await page.evaluate(()=>document.getElementById('subject').close());
    }
    const sourceConnected=kind==='gallery'?await page.evaluate(()=>{const s=document.getElementById('subject').getSlotContent('slide');return(Array.isArray(s)?s:[s]).some(n=>n instanceof Node&&n.isConnected);}):null;
    const row={width,kind,mode,inline,lightbox,sourceConnected};results.push(row);
    if(inline.count!==2||inline.dots!==2||inline.labels.join('|')!=='Первая карточка|Вторая карточка'||sourceConnected||(kind==='gallery'&&!lightbox)||(lightbox&&(lightbox.count!==2||lightbox.index!==1||lightbox.selected!=='Вторая карточка')))failures.push(row);
  }return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
