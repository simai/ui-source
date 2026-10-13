async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-semantics-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-continuous .sf-range-slider')?.noUiSlider);
  return page.locator('.sf-range-slider').evaluateAll(es=>es.map(e=>{
    const h=e.querySelector('[role="slider"]');
    return {id:e.id||e.parentElement.id,actual:e.noUiSlider.get(true),projected:e.dataset.value,
      name:h.getAttribute('aria-label'),labelledBy:h.getAttribute('aria-labelledby'),describedBy:h.getAttribute('aria-describedby'),
      text:h.getAttribute('aria-valuetext'),label:e.querySelector('.sf-thumb-text')?.textContent};
  }));
}
