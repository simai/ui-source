async page => {
  await page.route('**/*', route => route.continue());
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const results = [], failures = [], errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width:390, height:850});
  await page.emulateMedia({reducedMotion:'reduce', forcedColors:'none'});
  for (const mode of ['base','smart']) for (const theme of ['light','dark']) for (const dir of ['ltr','rtl']) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
    for (const layer of ['component','smart']) await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({mode,theme,dir}) => {
      document.documentElement.className=`theme-${theme}`; document.documentElement.dir=dir;
      const main=document.querySelector('main');main.replaceChildren(); main.className='grid gap-3';
      for (const size of ['1/3','1/2','1','2','3']) {
        let host;
        if (mode==='smart') {host=document.createElement('sf-country-code');for (const [k,v] of Object.entries({size, label:'Рабочий телефон', hint:'Укажите номер с кодом страны', placeholder:'Номер телефона', iso2:'RU'}))host.setAttribute(k,v);}
        else {const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode'); host=new C({param:{size,label:'Рабочий телефон',hint:'Укажите номер с кодом страны',placeholder:'Номер телефона',iso2:'RU',maxItems:2}}).render();}
        host.id=`field-${size.replace('/','-')}`;main.append(host);
      }
    },{mode,theme,dir});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-country-code input').length===5);
    const read = () => page.evaluate(() => {
      const parse=c=>{const n=c.match(/[\d.]+/g).map(Number);return [...n.slice(0,3),n[3]??1];};
      const over=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3])).concat(1);
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
      const bg=node=>{const chain=[];for(let e=node;e;e=e.parentElement)chain.unshift(e);return chain.reduce((c,e)=>over(parse(getComputedStyle(e).backgroundColor),c),[255,255,255,1]);};
      return [...document.querySelectorAll('.sf-country-code')].map(root=>{
        const input=root.querySelector('input'),field=root.querySelector('.sf-country-code-field'),size=[...root.classList].find(c=>c.startsWith('sf-country-code--size-')).replace('sf-country-code--size-','');
        const probe=document.createElement('span');probe.style.fontSize=`var(--sf-text-size-${size.replace('/','\\/')})`;probe.style.borderRadius='var(--sf-radius--ui)';probe.style.color='var(--sf-outline)';root.append(probe);
        const expected={font:getComputedStyle(probe).fontSize,radius:getComputedStyle(probe).borderTopLeftRadius,border:getComputedStyle(probe).color};probe.remove();
        const colors=[['label',root.querySelector('.sf-country-code-text')],['hint',root.querySelector('.sf-country-code-hint')],['value',input],['placeholder',input,'::placeholder']].map(([role,node,pseudo])=>{const c=getComputedStyle(node,pseudo),back=bg(node),front=parse(c.color);front[3]*=Number(c.opacity);const a=lum(over(front,back)),b=lum(back);return{role,color:c.color,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
        const f=getComputedStyle(field),i=getComputedStyle(input),r=field.getBoundingClientRect(),ir=input.getBoundingClientRect();
        return{size,colors,expected,font:i.fontSize,placeholderFont:getComputedStyle(input,'::placeholder').fontSize,radius:f.borderTopLeftRadius,border:f.borderTopColor,background:f.backgroundColor,shadow:f.boxShadow,disabled:input.disabled,overflow:document.documentElement.scrollWidth>innerWidth || ir.left<r.left-1 || ir.right>r.right+1};
      });
    });
    await page.mouse.move(0,0);
    const rest=await read();
    for(const r of rest){if(r.colors.some(c=>c.ratio<4.5)||r.font!==r.expected.font||r.font!==r.placeholderFont||r.radius!==r.expected.radius||r.border!==r.expected.border||r.overflow)failures.push({mode,theme,dir,stage:'rest',...r});}
    for(const size of ['1/3','1/2','1','2','3']){
      const input=page.locator(`#field-${size.replace('/','-')} input`);await input.focus();await page.keyboard.press('ArrowLeft');
      const r=(await read()).find(r=>r.size===size), original=rest.find(r=>r.size===size);
      if(r.colors.some(c=>c.ratio<4.5)||r.background!==original.background||r.shadow==='none'||r.overflow)failures.push({mode,theme,dir,stage:'focus',...r});
      results.push({mode,theme,dir,rest:original,focus:r});await input.evaluate(e=>e.blur());
    }
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('main .sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    await page.screenshot({path:`output/playwright/country-code-paint-${mode}-${theme}-${dir}.png`,fullPage:true});
    await page.evaluate(()=>document.documentElement.style.setProperty('--sf-radius--ui','var(--sf-space-1)'));
    const radiusRows=await read();
    for(const row of radiusRows)if(row.radius!==row.expected.radius)failures.push({mode,theme,dir,stage:'radius-token',...row});
    await page.emulateMedia({forcedColors:'active'});
    await page.locator('#field-1 input').focus();await page.keyboard.press('ArrowLeft');
    const forced=await page.locator('#field-1 .sf-country-code-field').evaluate(e=>({outline:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth),shadow:getComputedStyle(e).boxShadow}));
    if(forced.outline==='none'||forced.width===0||forced.shadow!=='none')failures.push({mode,theme,dir,stage:'forced-colors',forced});
    await page.emulateMedia({forcedColors:'none'});
    await page.evaluate(()=>document.querySelectorAll('.sf-country-code input').forEach(e=>{e.disabled=true;e.blur();}));
    const disabled=await page.evaluate(()=>[...document.querySelectorAll('.sf-country-code')].map(root=>{
      const input=root.querySelector('input'),probe=document.createElement('span');probe.style.color='var(--sf-on-disable)';root.append(probe);const ink=getComputedStyle(probe).color;probe.remove();
      const c=getComputedStyle(root.querySelector('.sf-country-code-field'));
      return{value:getComputedStyle(input).color===ink,placeholder:getComputedStyle(input,'::placeholder').color===ink,noFocus:c.boxShadow==='none'};
    }));
    if(disabled.some(row=>!Object.values(row).every(Boolean)))failures.push({mode,theme,dir,stage:'disabled',disabled});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
