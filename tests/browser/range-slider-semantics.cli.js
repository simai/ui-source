async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-semantics-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-continuous .sf-range-slider')?.noUiSlider);
  let checks=0;
  const check=(condition,message)=>{if(!condition)throw new Error(message);checks++;};
  for(const name of ['Громкость','Яркость','Вес','Smart вес','Доза'])check(await page.getByRole('slider',{name,exact:true}).count()===1,`Name ${name}`);
  check(await page.getByRole('slider',{name:'Минимальная цена',exact:true}).count()===1,'Lower boundary name');
  check(await page.getByRole('slider',{name:'Максимальная цена',exact:true}).count()===1,'Upper boundary name');
  check(await page.getByRole('slider',{name:'Громкость',exact:true}).getAttribute('aria-describedby')==='volume-hint','Description');
  await page.locator('#smart-named').evaluate(e=>e.setAttribute('aria-label','Освещение'));
  await page.getByRole('slider',{name:'Освещение',exact:true}).waitFor();checks++;
  await page.locator('#base-named').evaluate(e=>{e.removeAttribute('aria-labelledby');e.setAttribute('aria-label','Звук');});
  await page.getByRole('slider',{name:'Звук',exact:true}).waitFor();checks++;
  await page.locator('#smart-pair').evaluate(e=>e.setAttribute('aria-label','Общий диапазон'));
  await page.waitForTimeout(30);
  check(await page.getByRole('slider',{name:'Минимальная цена',exact:true}).count()===1,'Preserve lower name');
  check(await page.getByRole('slider',{name:'Максимальная цена',exact:true}).count()===1,'Preserve upper name');
  const values=await page.evaluate(()=>{
    const results=[];
    for(const id of ['continuous','smart-continuous']) {
      const e=document.getElementById(id),root=e.matches('.sf-range-slider')?e:e.querySelector('.sf-range-slider');
      const events=[];root.addEventListener('sf-range-slider-change',event=>events.push(event.detail.value));
      SF.RangeSlider.setValue(root,1.2345);
      const handle=root.querySelector('[role="slider"]');
      results.push({id,actual:SF.RangeSlider.getValue(root),projected:Number(root.dataset.value),events,
        label:root.querySelector('.sf-thumb-text').textContent,aria:Number(handle.getAttribute('aria-valuenow')),text:handle.getAttribute('aria-valuetext')});
    }
    return results;
  });
  for(const result of values){
    check(result.actual===1.2345&&result.projected===result.actual&&result.events.length===1&&result.events[0]===result.actual,`${result.id} data fidelity`);
    check(result.label==='1.2'&&result.aria===result.actual&&result.text==='1.2345',`${result.id} presentation versus ARIA`);
  }
  const dose=page.getByRole('slider',{name:'Доза',exact:true});
  check(await dose.getAttribute('aria-valuenow')==='0.002','Exact ARIA now');
  check(await dose.getAttribute('aria-valuemax')==='0.01','Exact ARIA maximum');
  check(await dose.getAttribute('aria-valuetext')==='0.002 мг','Accessible unit');
  await dose.focus();await page.keyboard.press('ArrowRight');
  check(await dose.getAttribute('aria-valuenow')==='0.003','Fractional keyboard ARIA');
  await page.locator('#smart-pair').evaluate(e=>e.setAttribute('margin','10'));
  await page.waitForFunction(()=>document.querySelector('#smart-pair .sf-range-slider').getAttribute('data-margin')==='10');
  const limits=await page.locator('#smart-pair [role="slider"]').evaluateAll(es=>es.map(e=>({min:Number(e.getAttribute('aria-valuemin')),max:Number(e.getAttribute('aria-valuemax'))})));
  check(limits[0].max===70&&limits[1].min===30,'Dependent ARIA bounds');
  check(await page.getByRole('slider',{name:'Минимальная цена',exact:true}).count()===1,'Lower name survives Smart rebuild');
  check(await page.getByRole('slider',{name:'Максимальная цена',exact:true}).count()===1,'Upper name survives Smart rebuild');
  await page.locator('#smart-named').evaluate(e=>{
    window.detachedSlider=e;window.detachedHandle=e.querySelector('[role="slider"]');e.remove();e.setAttribute('aria-label','После подключения');
  });
  await page.waitForTimeout(30);
  check(await page.evaluate(()=>window.detachedHandle.getAttribute('aria-label')==='Освещение'),'Observer released');
  await page.evaluate(()=>document.querySelector('main').append(window.detachedSlider));
  await page.getByRole('slider',{name:'После подключения',exact:true}).waitFor();checks++;
  await page.locator('#smart-named').evaluate(e=>e.removeAttribute('aria-label'));
  await page.waitForFunction(()=>!document.querySelector('#smart-named [role="slider"]').hasAttribute('aria-label'));checks++;
  return {status:'passed',checks,values,limits};
}
