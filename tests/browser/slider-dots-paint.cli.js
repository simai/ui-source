async page => {
  await page.route('**/*',r=>r.continue());
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width,height:900});await page.emulateMedia({forcedColors:'none',colorScheme:theme});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/slider/css/slider.css`});
    await page.evaluate(({theme,dir})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      const items=[];for(const scheme of ['primary','clear'])for(const tone of ['light','dark'])for(const framed of [false,true])for(const size of [1,2]){
        const key=[scheme,tone,framed,size].join('-'),surface=scheme==='clear'&&tone==='dark'?'bg-surface-inverse':'bg-surface-0';
        items.push(`<section class="p-2 ${surface}" data-case="${key}"><div class="sf-slider-dots sf-slider-dots--${scheme} sf-slider-dots--${tone} ${framed?'sf-slider-dots--framed':''} sf-slider-dots--size-${size} flex">${[0,1,2].map(i=>`<button type="button" aria-label="Слайд ${i+1}" class="sf-slider-dots-dot ${i===1?'active':''}"></button>`).join('')}</div></section>`);
      }document.querySelector('main').innerHTML=items.join('');
    },{theme,dir});
    await page.locator('[data-case] button').first().click();
    const pointerFocus=await page.locator('[data-case] button').first().evaluate(n=>n.matches(':focus-visible'));
    await page.keyboard.press('Tab');
    const normal=await page.evaluate(()=>{
      const rgb=s=>{const a=(s.match(/[\d.]+/g)||[]).map(Number);return[a[0]||0,a[1]||0,a[2]||0,a.length>3?a[3]:1];};
      const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
      const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
      const box=n=>{const r=n.getBoundingClientRect();return[r.x,r.y,r.width,r.height];};
      return [...document.querySelectorAll('[data-case]')].map(section=>{
        const dots=section.firstElementChild,buttons=[...dots.children],inactive=buttons[0],active=buttons[1],before=buttons.map(box);
        const ic=getComputedStyle(inactive),ac=getComputedStyle(active),ibg=ic.backgroundColor,abg=ac.backgroundColor,border=ic.borderTopColor,stroke=parseFloat(ic.borderTopWidth);
        let chain=[],node=dots;while(node){chain.unshift(getComputedStyle(node).backgroundColor);node=node.parentElement;}
        const backdrop=chain.reduce((bg,value)=>over(rgb(value),bg),[255,255,255,1]);
        const activeContrast=contrast(over(rgb(abg),backdrop),backdrop),strokeContrast=contrast(over(rgb(border),backdrop),backdrop);
        active.classList.remove('active');inactive.classList.add('active');const selected=buttons.map(box);
        inactive.focus({preventScroll:true});const focused=buttons.map(box),fc=getComputedStyle(inactive);
        const focus=fc.outlineStyle!=='none'&&parseFloat(fc.outlineWidth)>0;
        const focusBounded=parseFloat(fc.outlineWidth)<=parseFloat(getComputedStyle(dots).columnGap)/2+0.01;
        const stable=[selected,focused].every(state=>state.every((b,i)=>b.every((v,j)=>Math.abs(v-before[i][j])<0.5)));
        inactive.classList.remove('active');active.classList.add('active');
        return{key:section.dataset.case,ibg,abg,border,stroke,activeContrast,strokeContrast,hollow:rgb(ibg)[3]===0,filled:rgb(abg)[3]===1,focus,focusBounded,stable};
      });
    });
    await page.emulateMedia({forcedColors:'active'});
    const forced=await page.evaluate(()=>[...document.querySelectorAll('[data-case]')].map(section=>{const buttons=section.querySelectorAll('button'),inactive=getComputedStyle(buttons[0]),active=getComputedStyle(buttons[1]);buttons[0].focus({preventScroll:true});const focus=getComputedStyle(buttons[0]);return{key:section.dataset.case,distinct:inactive.backgroundColor!==active.backgroundColor,stroke:parseFloat(inactive.borderTopWidth)>0,focus:focus.outlineStyle!=='none'&&parseFloat(focus.outlineWidth)>0};}));
    await page.emulateMedia({forcedColors:'none'});
    await page.screenshot({path:`output/playwright/slider-dots-${width}-${theme}-${dir}.png`,fullPage:true});
    results.push({width,theme,dir,pointerFocus,normal,forced});
    const bad=normal.filter(r=>!r.hollow||!r.filled||r.stroke<=0||r.activeContrast<3||r.strokeContrast<3||!r.focus||!r.focusBounded||!r.stable),badForced=forced.filter(r=>!r.distinct||!r.stroke||!r.focus);
    if(pointerFocus||bad.length||badForced.length)failures.push({width,theme,dir,pointerFocus,bad,badForced});
  }
  return{status:failures.length||errors.length||consoleErrors.length?'failed':'passed',cases:results.length,variants:results.length*16,failures,errors,consoleErrors,results};
}
