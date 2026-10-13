async page => {
  await page.route('**/*', r => r.continue());
  await page.route('**/favicon.ico', r => r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser', results=[], failures=[], errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  for(const width of [390,1280])for(const mode of ['auto','fixed','fullscreen'])for(const authored of [false,true]) {
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider','modal'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addStyleTag({url:`${base}/smart/gallery/css/gallery.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons','smart/slider','smart/modal','smart/gallery'])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    const expected=await page.evaluate(({base,mode,authored})=>{
      document.documentElement.className=authored?'theme-dark':'theme-light';
      const container=document.createElement('div');
      container.innerHTML=`<sf-gallery id="subject" title="Изображение с подробной подписью" thumbs="false" arrows="false" speed="0" ${mode==='fixed'?'height="70vh"':mode==='fullscreen'?'fullscreen="true"':''}><figure slot="slide" class="m-0" ${authored?'style="display:block;width:75%"':''}><img src="${base}/examples/assets/color-study.jpg" alt="Цветовая композиция" ${authored?'style="object-fit:cover;width:50%;height:var(--sf-f2)"':''}><figcaption ${authored?'style="flex:1 1 auto;max-width:75%"':''}>${'Подробная подпись должна оставаться доступной при любом размере окна. '.repeat(14)}<a href="#end">Конец подписи</a></figcaption></figure></sf-gallery>`;
      const expected=[...container.querySelectorAll('figure,img,figcaption')].map(n=>n.getAttribute('style'));
      document.querySelector('main').replaceChildren(...container.childNodes);
      return expected;
    },{base,mode,authored});
    await page.waitForFunction(()=>document.getElementById('subject').getInlineSlider()?.getSlider()?.initialized);
    await page.evaluate(()=>document.getElementById('subject').open(1));
    await page.waitForFunction(()=>document.getElementById('subject').getLightboxSlider()?.getSlider()?.initialized);
    await page.evaluate(async()=>{const s=document.getElementById('subject').getLightboxSlider();await Promise.all([...s.querySelectorAll('img')].map(i=>i.decode()));for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
    const state=await page.evaluate(()=>{
      const g=document.getElementById('subject'),s=g.getLightboxSlider(),nodes=[s.querySelector('figure'),s.querySelector('img'),s.querySelector('figcaption')],modal=s.closest('.sf-modal'),panel=modal.querySelector('[data-sf-modal-panel]'),link=s.querySelector('figcaption a');
      link.focus();link.scrollIntoView({block:'nearest',behavior:'instant'});const b=link.getBoundingClientRect(),hitBox=[...link.getClientRects()].at(-1),p=panel.getBoundingClientRect();
      return {styles:nodes.map(n=>n.getAttribute('style')),index:s.getSlider().realIndex,overflow:document.documentElement.scrollWidth>innerWidth,
        captionReachable:b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth,
        focused:document.activeElement===link,hit:link.contains(document.elementFromPoint(hitBox.left+hitBox.width/2,hitBox.top+hitBox.height/2)),panelFits:p.left>=-1&&p.right<=innerWidth+1,
        panel:{top:p.top,bottom:p.bottom,width:p.width},image:{width:nodes[1].getBoundingClientRect().width,height:nodes[1].getBoundingClientRect().height,fit:getComputedStyle(nodes[1]).objectFit},fullscreen:g.getProp('fullscreen')};
    });
    const row={width,mode,authored,expected,...state};results.push(row);
    if((authored&&JSON.stringify(expected)!==JSON.stringify(state.styles))||state.overflow||!state.captionReachable||!state.focused||!state.hit||!state.panelFits||state.index!==0||state.image.width<=0||state.image.height<=0)failures.push(row);
    if(width===390&&mode==='auto'&&!authored)await page.screenshot({path:'output/playwright/gallery-layout-390.png',fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,errors,failures,results};
}
