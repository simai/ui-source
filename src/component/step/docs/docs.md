# Step

`Step` — разметка шагов, которую рисует `sf-steps`: где человек находится в
упорядоченном процессе, который он проходит сам (решение владельца C101).
Это не индикатор фоновой работы сервера — для неё `sf-progress-run`, и не
список задач, которые делают в любом порядке.

## Каноническая разметка

```html
<div class="sf-steps sf-steps--size-1 sf-steps--marker-number sf-steps--layout-row">
  <ol class="sf-steps-container" role="list" aria-label="Оформление заказа">
    <li class="sf-step sf-step--size-1 sf-step--state-done sf-step--passed" data-step-index="0">
      <span class="sf-step-body">
        <span class="sf-step-marker" aria-hidden="true"><i class="sf-icon">check</i></span>
        <span class="sf-step-content"><span class="sf-step-container">Корзина</span><span class="sr-only">, Пройден</span></span>
      </span>
    </li>
    <li class="sf-step sf-step--size-1 sf-step--state-current" data-step-index="1" aria-current="step">…</li>
  </ol>
</div>
```

- Список — `ol` с `role="list"`, шаг — `li.sf-step`, текущий шаг —
  `aria-current="step"`.
- Состояние — класс `sf-step--state-<слово>`: `done`, `current`, `ahead`,
  `error`, `skipped`, `running`. `sf-step--passed` — шаг до текущего: линия
  после него — линия хода. `sf-step--disabled` — недоступный шаг.
- Слово состояния повторяется для программы чтения с экрана (`sr-only`), метка
  декоративная (`aria-hidden="true"`).
- Шаг, на который можно перейти, — нативная кнопка
  `button.sf-step-body.sf-step-control`, остальные — `span.sf-step-body`.

## Вид

Метка + подпись + линия. Линия — 2 px основного цвета до текущего шага и
1 px `outline-variant` после него. Состояние видно по форме (C61, C73):
пройден — заливка с галочкой, текущий — заливка с кольцом через зазор, впереди
— пустой контур, ошибка — цвет ошибки, пропущен — пунктир, выполняется —
индикатор загрузки Framework размером с метку. Зелёного у шагов нет.

Метка (`sf-steps--marker-number` или `sf-steps--marker-dot`) равна строке
текста ступени: 24 px у `size-1`, 20 px у `size-1/2` на десктопе; точка — по
лестнице `.sf-dot` (8 / 6 px).

Раскладка — класс корня: `sf-steps--layout-row` (строка), `-column` (столбец
с второй строкой `.sf-step-text`), `-count` (строка «Шаг N из M» над
`sf-progress-bar`). Подпись не разрывается внутри слова.

Геометрия, интервалы, цвета и focus ring — только из токенов Framework.
