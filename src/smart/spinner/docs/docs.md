# Smart Spinner

`sf-spinner` показывает неопределённое ожидание с дугой или точками. Он не
загружает данные, не задаёт `aria-busy` внешней области и не решает, когда
ожидание завершилось ошибкой или успехом.

## Базовое использование

```html
<section aria-busy="true">
  <sf-spinner
    size="1"
    variant="arc"
    infinite
    announce
    label="Загрузка данных"
  ></sf-spinner>
</section>
```

`announce` превращает непустой локализованный `label` в `role="status"` с
вежливым объявлением. Без подписи визуальный индикатор декоративен. Spinner не
получает фокус и не имеет клавиатурных действий.

## Публичные параметры

- `size="1/2|1|2|3"` — системный размер;
- `variant="arc|dots"` — визуальная форма;
- `infinite` — повторять движение;
- `direction="clockwise|counterclockwise"` — направление точек;
- `dots` — от 3 до 32 точек;
- `filled` — от 1 до количества точек;
- `label` — видимая локализованная подпись;
- `announce` — объявить подпись как polite status;
- `root-class`, `style`, `root-style` — стандартная настройка корня.

`width`, `height`, `stroke-width` и `dot-radius` сохраняются как совместимый
низкоуровневый контракт. Новые интерфейсы используют системный `size` и токены
Framework. При `prefers-reduced-motion` анимация выключается, а статичный
индикатор остаётся видимым.

## Методы

- `getSpinnerRoot()`;
- `refreshSpinner()`.
