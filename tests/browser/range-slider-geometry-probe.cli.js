async(page)=>{
  const results=[];
  for(const rtl of [false,true]){
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-focus-lab.html${rtl?'?rtl':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-single .sf-range-slider')?.noUiSlider);
    results.push(await page.locator('#single').evaluate(e=>{
      SF.RangeSlider.setValue(e,25);
      const base=e.querySelector('.sf-range-slider-base').getBoundingClientRect();
      const handle=e.querySelector('[role="slider"]').getBoundingClientRect();
      return {direction:getComputedStyle(e).direction,engine:e.noUiSlider.options.direction,
        relativeCenter:(handle.x+handle.width/2-base.x)/base.width,baseWidth:base.width,handleWidth:handle.width};
    }));
  }
  return results;
}
