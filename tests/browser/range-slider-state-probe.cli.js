async(page)=>{
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/range-slider-state-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-multiple .sf-range-slider')?.noUiSlider);
  return page.evaluate(()=>{
    const scientific=document.getElementById('scientific');
    const smart=document.getElementById('smart-multiple');
    const results={scientific:{actual:SF.RangeSlider.getValue(scientific),projected:scientific.dataset.value,label:scientific.querySelector('.sf-thumb-text').textContent}};
    smart.setValue([30,70]);
    results.array={actual:smart.getValue(),attribute:smart.getAttribute('value'),public:smart.value};
    smart.setValue('40,60');
    results.string={actual:smart.getValue(),attribute:smart.getAttribute('value'),public:smart.value};
    return results;
  });
}
