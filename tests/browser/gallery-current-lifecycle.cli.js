async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const dir of ['ltr','rtl'])for(const loop of [false,true]){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(({dir,loop})=>{document.documentElement.dir=dir;document.querySelector('main').innerHTML=`<sf-gallery id="subject" speed="0" dots="true" thumbs="false" loop="${loop}">${[1,2,3].map(i=>`<article slot="slide" class="p-2 bg-surface-container"><h3>Карточка ${i}</h3></article>`).join('')}</sf-gallery>`;},{dir,loop});
    await page.waitForFunction(()=>document.getElementById('subject').getInlineSlider()?.getSlider()?.initialized);
    await page.evaluate(()=>document.getElementById('subject').open(2));
    await page.waitForFunction(()=>document.getElementById('subject').getLightboxSlider()?.getSlider()?.realIndex===1);
    await page.evaluate(()=>document.getElementById('subject').getLightboxSlider().slideNext());
    await page.waitForFunction(()=>document.getElementById('subject').current===3);
    const phases=await page.evaluate(async()=>{
      const g=document.getElementById('subject'),snapshot=()=>({current:g.current,index:g.getInlineSlider()?.getSlider()?.realIndex,alive:!!g.getInlineSlider()?.getSlider()?.initialized});
      g.close();const samples=[snapshot()];for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);samples.push(snapshot());}
      return{immediate:samples[0],settled:samples.at(-1),observedIndices:[...new Set(samples.filter(s=>s.alive).map(s=>s.index))]};
    });
    const reconfigured=await page.evaluate(async()=>{
      const g=document.getElementById('subject'),s=g.getInlineSlider(),old=s.getSlider();g.goTo(2);s.setAttribute('speed','100');
      for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);
      return{current:g.current,index:s.getSlider()?.realIndex,replaced:s.getSlider()!==old,oldDestroyed:!!old.destroyed};
    });
    const latest=await page.evaluate(async()=>{
      const g=document.getElementById('subject');g.setAttribute('title','Новый заголовок');g.goTo(3);g.goTo(2);
      for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);
      return{current:g.current,index:g.getInlineSlider()?.getSlider()?.realIndex};
    });
    const row={width,dir,loop,phases,reconfigured,latest};results.push(row);
    if(phases.settled.current!==3||phases.settled.index!==2||phases.observedIndices.some(i=>i!==2)||reconfigured.current!==2||reconfigured.index!==1||!reconfigured.replaced||!reconfigured.oldDestroyed||latest.current!==2||latest.index!==1)failures.push(row);
  }return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
