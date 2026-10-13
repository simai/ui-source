async page => {
  await page.route('**/*',r=>r.continue());await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],errors=[],consoleErrors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl'])for(const size of [1,2]){
    await page.setViewportSize({width,height:900});await page.emulateMedia({forcedColors:'none',colorScheme:theme});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','component/slider','smart/icons','smart/icon-buttons','smart/slider'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(async({base,theme,dir,size})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      const doc=new DOMParser().parseFromString(await(await fetch(`${base}/examples/slider-dots.html`)).text(),'text/html');
      const root=doc.querySelector('.sf-slider');root.classList.add('sf-slider--content');
      const dots=root.querySelector('.sf-slider-pagination');dots.classList.remove('sf-slider-dots--size-1');dots.classList.add(`sf-slider-dots--size-${size}`);
      for(const slide of root.querySelectorAll('.sf-slider-slide'))slide.innerHTML=Array(18).fill('Подробный текст карточки, который должен оставаться доступным.').join(' ')+' <a href="#details">Последняя ссылка</a>';
      const main=document.querySelector('main');main.innerHTML=root.outerHTML;
      main.insertAdjacentHTML('beforeend',`<sf-slider root-class="sf-slider--content" dots dots-size="${size}"><div slot="slide"><article>${'Текст Smart Slider. '.repeat(20)}<a href="#smart-details">Ссылка Smart</a></article></div><div slot="slide">Вторая карточка</div><div slot="slide">Третья карточка</div></sf-slider>`);
    },{base,theme,dir,size});
    await page.waitForFunction(()=>document.querySelector('main > .sf-slider')?._sfSlider?.initialized&&document.querySelector('sf-slider')?.getSlider()?.initialized);
    const roots=page.locator('.sf-slider');const rows=[];
    for(let i=0;i<2;i++){
      const root=roots.nth(i),buttons=root.locator('.sf-slider-pagination button');await buttons.first().scrollIntoViewIfNeeded();
      const before=await root.evaluate(n=>{
        const p=n.querySelector('.sf-slider-pagination'),b=[...p.querySelectorAll('button')],pr=p.getBoundingClientRect(),main=n.querySelector('.sf-slider-main').getBoundingClientRect();
        const boxes=b.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});
        const hits=b.map((e,i)=>{const r=boxes[i],cx=r.x+r.w/2,cy=r.y+r.h/2;return [-11.5,0,11.5].every(dx=>[-11.5,0,11.5].every(dy=>{const hit=document.elementFromPoint(cx+dx,cy+dy);return hit===e||e.contains(hit);}));});
        const link=n.querySelector('.swiper-slide-active a'),lr=link.getBoundingClientRect(),hit=document.elementFromPoint(lr.x+lr.width/2,lr.y+lr.height/2);
        return{boxes,hits,noOverlap:pr.top>=main.bottom,linkUnobscured:hit===link||link.contains(hit),position:getComputedStyle(n.querySelector('.sf-slider-controls')).position};
      });
      const edge=await buttons.nth(2).evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2+10,y:r.y+r.height/2};});
      await page.mouse.click(edge.x,edge.y);
      await page.waitForFunction(i=>{const s=document.querySelectorAll('.sf-slider')[i]._sfSlider;return s.realIndex===2&&!s.animating;},i);
      await buttons.first().focus();await page.keyboard.press('Enter');
      await page.waitForFunction(i=>{const s=document.querySelectorAll('.sf-slider')[i]._sfSlider;return s.realIndex===0&&!s.animating;},i);
      const after=await buttons.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{w:r.width,h:r.height};}));
      const stable=after.every((b,j)=>Math.abs(b.w-before.boxes[j].w)<0.5&&Math.abs(b.h-before.boxes[j].h)<0.5);
      rows.push({kind:i?'smart':'ordinary',...before,stable});
    }
    const variants=await page.locator('main > .sf-slider').evaluate(n=>{
      const controls=n.querySelector('.sf-slider-controls'),slide=n.querySelector('.sf-slider-slide');
      n.classList.remove('sf-slider--content');const media={position:getComputedStyle(controls).position,minHeight:parseFloat(getComputedStyle(slide).minHeight)};
      n.classList.add('sf-slider--content');n.style.setProperty('--sf-slider-slide--min-height','var(--sf-d2)');const override=parseFloat(getComputedStyle(slide).minHeight)>0;
      n.style.removeProperty('--sf-slider-slide--min-height');document.body.style.fontSize='20px';
      n.querySelector('.sf-slider-pagination').style.setProperty('--sf-slider-dots-dot--target-size','var(--sf-ui-1--control-height)');
      n._sfSlider.update();const p=n.querySelector('.sf-slider-pagination').getBoundingClientRect(),main=n.querySelector('.sf-slider-main').getBoundingClientRect();
      const b=[...n.querySelectorAll('.sf-slider-pagination button')].map(e=>e.getBoundingClientRect()),distance=Math.abs(b[1].x-b[0].x);
      return{media,override,enlargedNoOverlap:p.top>=main.bottom,enlargedDistance:distance};
    });
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),row={width,theme,dir,size,rows,variants,overflow};results.push(row);
    if(rows.some(r=>r.hits.some(x=>!x)||!r.noOverlap||!r.linkUnobscured||!r.stable||r.position!=='static')||variants.media.position!=='absolute'||variants.media.minHeight<=0||!variants.override||!variants.enlargedNoOverlap||variants.enlargedDistance<24||overflow)failures.push(row);
    if(width===390&&dir==='ltr'&&size===1){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`output/playwright/slider-content-${theme}.png`,fullPage:true});}
  }
  return{status:failures.length||errors.length||consoleErrors.length?'failed':'passed',cases:results.length,failures,errors,consoleErrors,results};
}
