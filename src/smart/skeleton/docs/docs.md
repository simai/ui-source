# sf-skeleton

Визуально резервирует геометрию ожидаемого содержимого. Это не индикатор
прогресса, не пустое состояние и не сообщение об ошибке.

## Базовое использование

```html
<sf-skeleton size="1" count="3" animation="wave"></sf-skeleton>
```

Сам скелетон декоративный и скрыт от экранного диктора. `aria-busy="true"`
задаётся области будущего содержимого, а не `<sf-skeleton>`.

## Атрибуты

- `size`
- `width`
- `height`
- `count` — число от 1 до 20
- `animation`
- `kind` — `text`, `circle`, `square`, `rounded` (прежнее имя `variant`
  читается до 2026-12-01)
- `type`
- `items`
- `root-class`

`size` использует типографическую шкалу Framework. Для `width` применяются
проценты или dimension-токены, для `height` — dimension-токены. Доступные
анимации: `pulse`, `wave`, `none`; системная настройка reduced motion отключает
декоративное движение автоматически.

Публичные переменные: `--sf-skeleton-background-color`,
`--sf-skeleton-highlight-color`, `--sf-skeleton-radius`, `--sf-skeleton-gap`,
`--sf-skeleton-animation-duration`.
