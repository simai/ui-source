async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[];
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['swiper','slider'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async base=>{document.querySelector('main').innerHTML=await(await fetch(`${base}/examples/slider-dots.html`)).text();},base);
    await page.waitForFunction(()=>[...document.querySelectorAll('.sf-slider')].length===16&&[...document.querySelectorAll('.sf-slider')].every(n=>n._sfSlider?.initialized));
    const rows=await page.locator('.sf-slider-pagination').evaluateAll(nodes=>nodes.map(n=>{
      const buttons=[...n.children],r=buttons[0].getBoundingClientRect(),next=buttons[1].getBoundingClientRect(),s=getComputedStyle(buttons[0]);
      const tokens=Object.fromEntries(['--sf-ui-1/3--control-height','--sf-ui-1/2--control-height','--sf-ui-1--control-height','--sf-a6','--sf-a8','--sf-b2'].map(k=>[k,s.getPropertyValue(k)]));
      return{classes:n.className,width:r.width,height:r.height,centers:next.x+next.width/2-r.x-r.width/2,tokens};
    }));
    const overlap=await page.evaluate(()=>{
      const root=document.querySelector('.sf-slider');
      for(const slide of root.querySelectorAll('.sf-slider-slide'))slide.innerHTML=Array(18).fill('Подробное описание карточки со ссылкой.').join(' ')+' <a href="#details">Последняя ссылка</a>';
      root._sfSlider.update();const dot=root.querySelector('.sf-slider-pagination'),r=dot.getBoundingClientRect(),link=root.querySelector('.swiper-slide-active a').getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(root.querySelector('.swiper-slide-active .sf-slider-slide'));
      const rects=[...range.getClientRects()];return{pagination:[r.x,r.y,r.width,r.height],link:[link.x,link.y,link.width,link.height],textIntersections:rects.filter(b=>b.x<r.right&&b.right>r.x&&b.y<r.bottom&&b.bottom>r.y).length};
    });results.push({width,rows,overlap});
  }return{results};
}
