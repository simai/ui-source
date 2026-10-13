async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-focus-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
  await page.locator('#before').focus();
  const tabs=[];
  for(let i=0;i<12;i++) {
    await page.keyboard.press('Tab');
    tabs.push(await page.evaluate(()=>{
      const e=document.activeElement;
      const thumb=e.querySelector('.sf-thumb-handle');
      return {id:e.id,role:e.getAttribute('role'),class:e.className,
        owner:e.closest('[id]')?.id,shadow:thumb?getComputedStyle(thumb).boxShadow:null};
    }));
    if(tabs.at(-1).id==='after')break;
  }
  return {tabs};
}
