async(page)=>{
  const results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:1000});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?rtl');
  await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
  for(const id of ['base','smart']){
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button');
    await button.focus();await page.keyboard.press('ArrowDown');
    const search=host.locator('.sf-list input');
    await search.fill('нет такого города');
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    await page.keyboard.press('ArrowDown');
    check(await search.evaluate(e=>e===document.activeElement),`${id}: zero results retain search focus`);
    await page.keyboard.press('Home');await page.keyboard.type('а');
    check(await search.inputValue()==='анет такого города',`${id}: Home edits search, not options`);
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Backspace');
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    await page.keyboard.press('ArrowDown');
    check(await page.locator(':focus').getAttribute('data-value')==='kazan',`${id}: recover options after empty results`);
    await page.keyboard.press('Escape');
    await host.evaluate(e=>e.setAttribute('aria-label','Место доставки'));
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    await button.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
    check((await button.ariaSnapshot()).includes(id==='base'?'Открыть список':'Место доставки'),`${id}: preserve explicit button name or inherit owner name`);
    await page.locator('#before').evaluate(e=>{e.textContent='Регион доставки';});
    await host.evaluate(e=>e.setAttribute('aria-labelledby','before'));
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
    check((await button.ariaSnapshot()).includes('Регион доставки'),`${id}: external label reference`);
    const summary=await button.evaluate(e=>e.getAttribute('aria-describedby').split(/\s+/).map(id=>document.getElementById(id)?.textContent));
    check(summary.length>0&&summary.every(s=>typeof s==='string'),`${id}: value summary references resolve`);
  }
  // Native or fallback projection must not change the keyboard contract.
  await page.locator('#base').evaluate(e=>e.setAttribute('data-portal','true'));
  const baseButton=page.locator('#base .sf-dropdown-field > button');
  await baseButton.focus();await page.keyboard.press('ArrowDown');
  check(await page.locator('#base').evaluate(e=>{
    const panel=e.__sfDropdownPortalList;
    return panel?.contains(document.activeElement)&&(panel.matches(':popover-open')||!e.contains(panel));
  }), 'portal: focus reaches projected popup');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('End');
  check(await page.locator(':focus').getAttribute('data-value')==='moscow','portal: option navigation');
  await page.keyboard.press('Escape');
  check(await baseButton.evaluate(e=>e===document.activeElement),'portal: Escape restores trigger');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Shift+Tab');
  check(await page.locator('#before').evaluate(e=>e===document.activeElement),'portal: Shift+Tab exits backwards');
  check(await baseButton.getAttribute('aria-expanded')==='false','portal: Tab closes popup');
  // Capture actual keyboard focus in the dark theme, not only computed CSS.
  await page.evaluate(()=>document.documentElement.className='theme-dark');
  await page.keyboard.press('Tab');
  const field=page.locator('#base .sf-dropdown-field');
  await field.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
  const visual=await field.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,width:e.getBoundingClientRect().width}));
  check(visual.shadow.includes('inset')&&!visual.shadow.includes('rgba(0, 0, 0, 0)')&&visual.width>0,'dark/RTL: visible joined focus');
  await page.screenshot({path:'output/playwright/dropdown-keyboard-dark-rtl.png'});
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',checks:results.length,results,visual,errors};
}
