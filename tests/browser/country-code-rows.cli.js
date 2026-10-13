async page => {
  await page.route('**/*',route=>route.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [390,1280])for(const dir of ['ltr','rtl'])for(const custom of [false,true])for(const size of ['1/3','1/2','1','2','3']){
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({dir,custom,size})=>{
      document.documentElement.dir=dir;const main=document.querySelector('main');main.innerHTML='<section id="base"></section><section id="smart"></section><section id="markup"></section>';main.className='grid gap-3';
      const countries=custom?[{iso2:'DE',label:'Германия (+49)'},{iso2:'RU',label:'Страна с длинным названием '+ 'Название'.repeat(14)}]:[];
      const params={size,label:'Телефон',hint:'Выберите страну',countries,maxItems:2,iso2:custom?'DE':'AU'};
      const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');document.getElementById('base').append(new C({param:params}).render());
      const host=document.createElement('sf-country-code');for(const [k,v]of Object.entries({size,label:params.label,hint:params.hint,iso2:params.iso2,'max-items':'2'}))host.setAttribute(k,v);if(custom)host.countries=countries;document.getElementById('smart').append(host);
      document.getElementById('markup').innerHTML=`<label class="sf-country-code sf-country-code--size-${size} flex flex-col" data-iso2="${params.iso2}" data-max-items="2"><span class="sf-country-code-label flex"><span class="sf-country-code-text">Телефон</span></span><span class="sf-country-code-field flex items-center"><span class="sf-country-code-left flex items-center"><span class="sf-country-code-flag-icon"></span><i class="sf-icon" aria-hidden="true">expand_more</i></span><input class="flex-1" type="tel"></span><span class="sf-country-code-hint">Выберите страну</span>${custom?`<span class="sf-country-code-list"><span class="sf-country-code-items flex flex-col">${countries.map((c,i)=>`<span class="sf-country-code-item flex items-center" data-iso2="${c.iso2}" data-code="${i?'+7':'+49'}"><span class="sf-country-code-flag" aria-hidden="true">${i?'🇷🇺':'🇩🇪'}</span><span>${c.label}</span></span>`).join('')}</span></span>`:''}</label>`;
    },{dir,custom,size});
    await page.waitForFunction(()=>[...document.querySelectorAll('.sf-country-code')].every(r=>r.__sfCountryCodeInput));
    const paths=[];
    for(const mode of ['base','smart','markup']){
      await page.locator(`#${mode} .sf-country-code-left`).click();
      const row=await page.locator(`#${mode} .sf-country-code`).evaluate(root=>{
        const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
        const r=rect(root),f=rect(root.querySelector('.sf-country-code-field'));
        const probe=document.createElement('span');probe.style.borderRadius='var(--sf-radius--ui)';root.append(probe);const radius=getComputedStyle(probe).borderTopLeftRadius;probe.remove();
        const items=[...root.querySelectorAll('.sf-country-code-item')].map(item=>{const flag=item.querySelector('.sf-country-code-flag'),text=item.lastElementChild,ir=rect(item),fr=rect(flag),tr=rect(text),c=getComputedStyle(item);
          return{h:ir.h,display:c.display,radius:c.borderTopLeftRadius,flag:fr,text:tr,gap:parseFloat(c.columnGap),aligned:Math.abs(fr.y+fr.h/2-tr.y-tr.h/2)<1,
            inside:tr.x>=ir.x-1&&tr.right<=ir.right+1&&fr.x>=ir.x-1&&fr.right<=ir.right+1,overlap:Math.min(fr.right,tr.right)>Math.max(fr.x,tr.x)+1};});
        return{width:r.w,fieldWidth:f.w,radius,items,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      paths.push({mode,...row});
      if(width===390&&custom&&size==='1')await page.screenshot({path:`output/playwright/country-code-rows-${mode}-${dir}.png`,fullPage:true});
      if(Math.abs(row.width-row.fieldWidth)>1||row.overflow||row.items.some(i=>i.display!=='flex'||!i.aligned||!i.inside||i.overlap||i.radius!==row.radius))failures.push({width,dir,custom,size,mode,...row});
      await page.locator(`#${mode} .sf-country-code-left`).click();
    }
    const heights=paths.map(p=>p.items.map(i=>i.h));
    if(heights.some(pair=>pair.some((h,i)=>Math.abs(h-heights[0][i])>1)))failures.push({width,dir,custom,size,reason:'projection height mismatch',heights});
    results.push({width,dir,custom,size,paths});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
