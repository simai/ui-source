async(page)=>{
  await page.emulateMedia({forcedColors:'none'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/field-layout-parity-lab.html');
  await page.locator('#constructed-quantity input').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const results=[];
  for(const width of [390,1280]) for(const rtl of [false,true]) for(const zoom of [1,2]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(({rtl,zoom})=>{document.documentElement.dir=rtl?'rtl':'ltr';document.documentElement.style.fontSize=`${16*zoom}px`;},{rtl,zoom});
    for(const kind of ['input','textarea','quantity']) for(const size of ['1/3','1/2','1','2','3']) for(const type of kind==='quantity'?['']:['bordered','filled']) {
      const measure=await page.evaluate(({kind,size,type})=>{
        for(const origin of ['authored','constructed']) {
          const root=document.getElementById(`${origin}-${kind}`);
          for(const name of [...root.classList]) if(name.startsWith(`sf-${kind}--size-`) || name===`sf-${kind}--bordered` || name===`sf-${kind}--filled`)root.classList.remove(name);
          root.classList.add(`sf-${kind}--size-${size}`);if(type)root.classList.add(`sf-${kind}--${type}`);
        }
        // Apply both variants before measuring: crossing the page scrollbar
        // threshold between sequential mutations would compare two viewports.
        return ['authored','constructed'].map(origin=>{
          const root=document.getElementById(`${origin}-${kind}`);
          const field=root.querySelector(kind==='input'?'.sf-input-field':kind==='textarea'?'textarea':'.sf-quantity-wrap');
          const label=root.querySelector(`.sf-${kind}-label`);
          const measure=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};};
          return {origin,root:measure(root),field:measure(field),label:measure(label),gap:field.getBoundingClientRect().top-label.getBoundingClientRect().bottom,
            fakeClasses:[root,...root.querySelectorAll('*')].flatMap(e=>[...e.classList].filter(c=>c.startsWith('--sf-'))),
            overflow:root.scrollWidth>root.clientWidth+1};
        });
      },{kind,size,type});
      const [a,b]=measure;
      for(const dimension of ['width','height']) {
        if(Math.abs(a.field[dimension]-b.field[dimension])>1)throw new Error(JSON.stringify({width,rtl,zoom,kind,size,type,dimension,measure}));
      }
      if(Math.abs(a.gap-b.gap)>1||Math.abs(a.label.height-b.label.height)>1||a.overflow||b.overflow||b.fakeClasses.length)throw new Error(JSON.stringify({width,rtl,zoom,kind,size,type,measure}));
      const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      if(pageWidth>width+1)throw new Error(JSON.stringify({reason:'page overflow',width,pageWidth,rtl,zoom,kind,size,type,measure}));
      results.push({width,rtl,zoom,kind,size,type,field:b.field,gap:b.gap});
    }
  }
  await page.setViewportSize({width:390,height:1000});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/field-layout-parity-lab.html');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'output/playwright/field-layout-parity.png',fullPage:true});
  return{status:'passed',cases:results.length,results};
}
