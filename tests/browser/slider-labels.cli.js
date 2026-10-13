async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const order of ['component-first','smart-first'])for(const mode of ['authored','explicit','false','disabled','fallback','labelledby','smart','smart-explicit']){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['swiper','slider'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const path of ['component/swiper','smart/icons','smart/icon-buttons',...(order==='component-first'?['component/slider','smart/slider']:['smart/slider','component/slider'])])await page.addScriptTag({url:`${base}/${path}/js/${path.split('/').pop()}.js`});
    await page.evaluate(mode=>{
      const smart=mode.startsWith('smart'),labels=mode==='fallback'?'':' aria-label="Назад"',next=mode==='fallback'?'':' aria-label="Вперёд"';
      const root=document.createElement(smart?'sf-slider':'div');root.id='subject';
      if(smart){root.setAttribute('speed','0');root.innerHTML='<div slot="slide">Один</div><div slot="slide">Два</div><div slot="slide">Три</div>';}
      else{root.className='sf-slider';root.innerHTML=`<div class="sf-slider-main swiper"><div class="swiper-wrapper"><div class="swiper-slide">Один</div><div class="swiper-slide">Два</div><div class="swiper-slide">Три</div></div></div><button class="sf-slider-button-prev"${labels}>Назад</button><button class="sf-slider-button-next"${next}>Вперёд</button>`;}
      let options={};if(mode.includes('explicit'))options={a11y:{prevSlideMessage:'Previous configured',nextSlideMessage:'Next configured'}};
      if(mode==='false')options={a11y:false};if(mode==='disabled')options={a11y:{enabled:false}};
      root.setAttribute('data-swiper-options',JSON.stringify(options));
      const main=document.querySelector('main');main.innerHTML='<span id="prev-name">Назад по подписи</span><span id="next-name">Вперёд по подписи</span>';main.append(root);
      if(mode==='labelledby'){root.querySelector('.sf-slider-button-prev').setAttribute('aria-labelledby','prev-name');root.querySelector('.sf-slider-button-next').setAttribute('aria-labelledby','next-name');}
    },mode);
    await page.waitForFunction(mode=>mode.startsWith('smart')?document.querySelector('#subject').getSlider()?.initialized:document.querySelector('#subject')._sfSlider?.initialized,mode);
    const row=await page.evaluate(async mode=>{
      const host=document.querySelector('#subject'),smart=mode.startsWith('smart'),root=smart?host.querySelector('.sf-slider'):host;
      const names=()=>[root.querySelector('.sf-slider-button-prev').getAttribute('aria-label'),root.querySelector('.sf-slider-button-next').getAttribute('aria-label')];
      const initial=names();let restored=null,edited=null,rebound=null;
      if(!smart){
        SF.Slider.unbind(root);restored=names();SF.Slider.bind(root);
        root.querySelector('.sf-slider-button-prev').setAttribute('aria-label','Новое имя');SF.Slider.unbind(root);edited=names()[0];
        root.setAttribute('data-swiper-options','{}');SF.Slider.bind(root);rebound=names();
      }else{
        const old=host.getSlider();host.setAttribute('speed','100');
        await new Promise(resolve=>{const check=()=>host.getSlider()!==old&&host.getSlider()?.initialized?resolve():requestAnimationFrame(check);check();});rebound=names();
      }
      return{initial,restored,edited,rebound,labelledby:root.querySelector('.sf-slider-button-prev').getAttribute('aria-labelledby')};
    },mode);
    const expected=mode.includes('explicit')?['Previous configured','Next configured']:mode==='fallback'||mode==='smart'?['Previous slide','Next slide']:['Назад','Вперёд'];
    const smart=mode.startsWith('smart');const restoreExpected=mode==='fallback'?[null,null]:['Назад','Вперёд'];
    const accessible=mode!=='labelledby'||await page.getByRole('button',{name:'Назад по подписи',exact:true}).count()===1;
    const ok=JSON.stringify(row.initial)===JSON.stringify(expected)&&accessible&&(smart?JSON.stringify(row.rebound)===JSON.stringify(expected):JSON.stringify(row.restored)===JSON.stringify(restoreExpected)&&row.edited==='Новое имя'&&row.rebound[0]==='Новое имя'&&row.rebound[1]===(mode==='fallback'?'Next slide':'Вперёд'));
    results.push({order,mode,...row,accessible});if(!ok)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
