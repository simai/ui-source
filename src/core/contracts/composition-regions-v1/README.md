# Composition Regions 1.0.0: нормативный комплект

Комплект добавляет в Framework раскладку с несколькими именованными областями.
Он не меняет Composition Recipe 1.0.1, Composition Document v1 и type manifest v1:
новые типы публикуются как обычные записи реестра `composition-types.v1.json`.
Старые документы, Recipe и их digest остаются прежними; builtin HTML прежних
типов не меняется. Владелец — ui-source.

## Файлы

- README.md — этот текст, нормативный.
- fixtures/regions.json — положительные и отрицательные случаи с точными
  кодами диагностик, каноническими байтами, digest, HTML и digest областей.
- checks/digest-parity.php — межъязыковая проверка канонизации и digest.
- contract.lock.json — отпечатки нормативных файлов и типов.

## Типы

`layout.regions@1.0.0` — составной layout со слотом `regions`: от 1 до 12
детей, только `layout.region`. Порядок массива — порядок чтения и DOM.

`layout.region@1.0.0` — одна объявленная область со слотом `default` (0..500,
категории layout, content, smart). Props:

| Поле | Значение | По умолчанию |
|---|---|---|
| `name` | обязательное имя области, `^[a-z][a-z0-9-]{0,31}$`, уникально в своём `layout.regions` | — |
| `landmark` | обязательное: banner, navigation, main, complementary, contentinfo, region, none | — |
| `placement` | block, start, center, end | block |
| `label` | доступное имя, 1..120 символов | нет |
| `sticky` | boolean, закрепление при прокрутке | false |
| `accepts` | непустое подмножество layout, content, smart | все три |
| `min_items`, `max_items` | собственная cardinality области, 0..500 | 0 и 500 |

Имена областей выбирает автор документа. Framework не закрепляет header, main,
aside, footer или другие продуктовые названия; такие имена — обычные значения.
Семантику задаёт только `landmark`. Неизвестные поля, классы, HTML, выражения
и запросы запрещены общими правилами Document v1.

## Правила проверки

Проверки выполняет общий `validate`, поэтому они действуют для Document и для
результата Recipe v1 (ошибка Recipe — `invalid_resolved_document` с исходной
диагностикой). Коды:

- `region_parent_invalid` — `layout.region` вне слота `regions` у `layout.regions`;
- `region_name_duplicate` — повтор имени в одной раскладке;
- `region_order_invalid` — в группе соседних областей без `block` порядок
  объявления нарушает start → center → end, поэтому визуальный порядок разошёлся бы с DOM;
- `region_landmark_duplicate` — второй `main` в документе;
- `region_landmark_context` — banner, main или contentinfo внутри другой области
  с landmark либо внутри `layout.page`, который уже выводит `<main>`;
- `region_label_required` — landmark `region` без label, либо повторяющийся
  landmark без label; `region_label_duplicate` — повтор label для одного landmark;
- `region_label_forbidden` — label у landmark `none`;
- `region_bounds_invalid` — `min_items > max_items`; `region_cardinality` — число
  детей вне собственных границ;
- `region_child_category_forbidden` — категория ребёнка не входит в `accepts`;
- `region_nesting_limit` — больше 4 вложенных `layout.regions`.

Общие коды тоже применяются: `slot_unknown`, `slot_cardinality`,
`slot_child_type_forbidden`, `type_unknown`, `schema_*`,
`executable_or_secret_field_forbidden`, `type_profile_unsupported` (только ui-layout),
`depth_limit` и `node_limit`. Любая ошибка возвращает отказ целиком.

## Нормализация и digest

Нормализация — существующий `normalize` Document v1: канонический порядок ключей,
без перестановки массивов и без подстановки значений по умолчанию. Отсутствующий
`placement` и явный `block` рендерятся одинаково, но дают разные digest — так же,
как отсутствующее и явное значение других props. Digest документа —
SHA-256 канонических байтов `simai.recipe.canonical-json.v1`.

`describeRegions(document)` возвращает области в порядке документа:
layout, node, name, landmark, placement, path и `sha256:` digest канонического
поддерева области. Изменение одной области меняет только её digest и digest
охватывающих областей. Продукт использует это для выборочной инвалидации.

## Серверный rendering contract

- `layout.regions` → `<div class="sf-composition-regions" data-sf-composition-id="ID">` с
  единственным ребёнком `<div class="sf-composition-regions-grid">`, внутри
  которого области. Внешний элемент — size container, внутренний — сетка.
- `layout.region` → элемент по landmark: banner `header`, navigation `nav`,
  main `main`, complementary `aside`, contentinfo `footer`, region `section`,
  none `div`; атрибуты в порядке `class="sf-composition-region"`,
  `data-sf-composition-id`, `data-sf-region`, `data-sf-region-placement`
  (фактическое значение, по умолчанию block), `data-sf-region-sticky=""`
  только при true, `aria-label` только при label. Все значения экранируются.

Экранирование значений атрибутов и текста: `&` → `&amp;`, `<` → `&lt;`,
`>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`; других замен нет.
- Пустая область выводится пустым элементом, а не пропускается.

Стили входят в core.css (`@layer sf.components`). Узкий контейнер — одна
колонка в порядке DOM. Контейнер от 48rem ставит start, center и end рядом,
block занимает всю строку. Колонки логические и зеркалируются для RTL.
Sticky действует для block и боковых областей. Доступность обеспечивают
семантические landmark-элементы, совпадение визуального порядка с DOM и
уникальные label повторяющихся landmark. Клавиатурный порядок равен порядку DOM.

## Совместимость и откат

Потребитель подключает возможность, закрепив точную пару Core/Smart, где реестр
содержит эти типы, и digest этого комплекта. Реестр без новых типов продолжает
отклонять такие документы как `type_unknown`. Откат — возврат к предыдущей паре;
документы с новыми типами при этом отклоняются, старые не затрагиваются.
