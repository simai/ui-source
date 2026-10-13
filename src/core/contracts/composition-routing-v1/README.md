# Composition Routing 1.0.0: нормативный комплект

Комплект задаёт декларативную связь составных Smart Components через общего
родителя. Recipe 1.0.1, Document v1 и type manifest v1 не меняются: добавлены
тип `layout.scope`, опубликованный реестр портов `composition-ports.v1.json` со
схемой `composition-port-manifest.v1.schema.json` и runtime-элемент
`sf-composition-scope` в Core. Продуктовый JavaScript-мост не нужен. Владелец —
ui-source.

## Файлы

- README.md — этот текст, нормативный.
- fixtures/routing.json — setup (типы примера, привязка портов, правило
  продуктового renderer), положительные и отрицательные случаи с кодами,
  каноническими байтами, digest, HTML и hydration.
- checks/schemas.py — независимая проверка Draft 2020-12.
- checks/digest-parity.php — межъязыковая проверка канонизации и digest.
- contract.lock.json — отпечатки нормативных файлов, типа и порт-манифеста.

## Модель

`layout.scope@1.0.0` — составной layout со слотом `default` (1..500) и props
`routes` (1..32). Маршрут: `{id, from: {endpoint, port}, to: {endpoint, port}}`.
Других полей нет: URL, endpoint, method, action, handler, query, выражения и
преобразования запрещены схемой и общими правилами. `id` —
`^[a-z][a-z0-9-]{0,63}$`, имена endpoint и port — `^[a-z][a-z0-9-]{0,31}$`.

Endpoint объявляется на узле-потомке расширением
`"simai.composition:endpoint": {"name": "..."}` — только поле `name`. Имя
уникально в своём scope. Вложенный `layout.scope` инкапсулирует свои endpoints:
внешний scope их не видит.

Порт принадлежит элементу, реализующему протокол. Порт-манифест
(`simai.composition.port-manifest.v1`) публикует `outputs` и `inputs` с закрытым
типом значения. Тип узла получает порты по `renderer.kind = custom-element` и
имени элемента либо через явную привязку `type → element` в реестре портов
хоста. Привязка не добавляет портов и грамматики; она лишь указывает, какой
опубликованный элемент рендерит продуктовый тип.

Типы значений (`value_types` реестра):

- `record-ids.v1` — упорядоченный список уникальных идентификаторов: непустые
  строки до 256 code units без управляющих символов или safe integers, до 1000;
  пустой список означает «нет выбора»;
- `record-id.v1` — один идентификатор или null;
- `text.v1` — строка до 2000 code units, никогда не разметка и не запрос;
- `boolean.v1` — строгий boolean.

Приведения типов нет. Имена портов, типов значений и маршрутов сравниваются только
как собственные ключи опубликованных записей. Значение до 64 KiB в JSON. Маршрут допустим только при
точном совпадении типа выхода и входа.

Опубликован порт-манифест `sf-table@1.0.0` (Data View 1.2.0): выход `selection`
и вход `context`, оба `record-ids.v1`, эффект входа `request`.

## Правила проверки

Проверки выполняет общий `validate` (значит, и результат Recipe v1). Реестр
портов передаётся в `options.ports` функций validate, normalize и render как
готовый реестр или `{manifests, bindings}`; без него используется встроенный.
`resolveRecipe` принимает тот же реестр в необязательном поле контекста
`compositionPorts` (поле `ports` там занято портами чтения источников); Recipe
1.0.1 при этом не меняется. Коды:

- `route_endpoint_unknown`, `route_endpoint_duplicate`, `route_endpoint_invalid`
  (форма расширения проверяется на любом узле документа, в том числе вне scope);
- `route_port_unknown` — тип endpoint не публикует порт или не имеет портов;
- `route_port_direction` — выход использован как вход или наоборот;
- `route_type_mismatch`, `route_self`, `route_cycle` (цикл между endpoints);
- `route_input_conflict` — у одного входа больше одного маршрута;
- `route_id_duplicate`, `route_fanout_limit` (больше 8 маршрутов с одного
  выхода), `route_limit` (больше 64 endpoints), `scope_nesting_limit`
  (больше 4 вложенных scope).

Общие коды тоже применяются (`schema_*`, `executable_or_secret_field_forbidden`,
`type_unknown` и другие). Любая ошибка — отказ целиком.

## Серверный rendering contract

`layout.scope` → `<sf-composition-scope data-sf-composition-id="ID"
data-sf-routes="JSON">…</sf-composition-scope>`. `data-sf-routes` —
экранированный канонический JSON маршрутов в порядке объявления, каждая сторона
дополнена разрешённым типом значения `value`. Узел с endpoint-расширением,
отрисованный builtin custom-element renderer, получает атрибут
`data-sf-endpoint="имя"` последним; без расширения вывод не меняется. Продуктовый
renderer привязанного типа обязан поставить `data-sf-endpoint` на элемент,
реализующий порты, либо на обёртку ровно с одним таким элементом того же scope.
Экранирование значений атрибутов и текста: `&` → `&amp;`, `<` → `&lt;`,
`>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`; других замен нет.
Hydration содержит `sf-composition-scope`. `sf-composition-scope` имеет
`display: contents` и не влияет на раскладку и доступность.

## Протокол элемента

- Элемент объявляет `static sfPorts = {outputs: {имя: тип}, inputs: {имя: тип}}`.
- Выход: `CustomEvent('sf-port-output', {bubbles: true, composed: true, detail:
  {port, value}})`, где `event.target` — сам элемент порта.
- Вход: метод `sfPortInput(port, value, meta)`; неизвестный порт или значение —
  TypeError до изменения состояния. `meta` содержит `route`, `sequence`,
  `signal` (AbortSignal) и `isLatest()`. Возврат Promise означает асинхронную работу.

## Runtime scope

`sf-composition-scope` при подключении разбирает `data-sf-routes` (некорректный
атрибут — `data-sf-routing="error"`, доставки нет) и добавляет ровно один
делегированный слушатель `sf-port-output`. Повторное подключение без отключения
не добавляет второй слушатель. Обрабатываются только события, у которых
`event.target` — элемент порта endpoint этого же ближайшего scope.

Доставка: значение проверяется по типу выхода и замораживается (некорректное
значение тоже считается новейшим: прежняя ожидающая доставка прерывается,
маршрут переходит в error), затем получает
монотонный в пределах scope `sequence`. Предыдущая незавершённая доставка того
же маршрута прерывается через `signal`. Endpoint разрешается заново при каждой
доставке, поэтому удалённые и заново вставленные дети не удерживаются. До
определения custom element доставка ждёт `customElements.whenDefined` и
выполняется, только если осталась последней. Объявленный элементом тип входа
обязан совпасть с маршрутом (`port_mismatch`). Синхронная глубина повторных
доставок ограничена 8 (`reentrancy_limit`).

Latest-result-wins: результат Promise устаревшей доставки не меняет состояние
маршрута и учитывается как stale. Для `sf-table.context` таблица сбрасывает свой
выбор (если он был, выход `selection` сообщает пустой список один раз и
каскадно доходит до нижних маршрутов), переходит в loading и затем отправляет
`sf-table-query-intent` с `{reason: "context", context: {record_ids}, sequence}`. Хост выполняет запрос со
своей авторизацией и отвечает `applyQueryResult(sequence, rows)`; ответ на
неактуальный или уже применённый sequence возвращает false и ничего не меняет.

Состояние маршрута: idle, pending, waiting, settled, error (с кодом
value_invalid, endpoint_unresolved, endpoint_unavailable, port_unsupported,
port_mismatch, port_rejected, reentrancy_limit) и disposed. Его читают через
`getRouteState(id)` и событие `sf-composition-route-state` на scope; счётчики —
`getRoutingCounters()`.

Disposal и remount: отключение scope снимает слушатель, прерывает все ожидания и
переводит маршруты в disposed; поздний ответ не может их завершить. Повторное
подключение добавляет один слушатель, sequence продолжает расти. При отключении
`sf-table` сбрасывает выбор и ожидающий sequence без эмиссии; ответ на прежний
sequence отклоняется. Если запрос контекста остался без ответа, таблица после
повторного подключения один раз запрашивает тот же контекст с новым sequence.

## Совместимость и откат

Существующие документы, HTML прежних типов и Recipe не меняются. Потребитель
подключает возможность, закрепив точную пару Core/Smart и digest комплекта.
Откат — возврат к предыдущей паре: документы с `layout.scope` отклоняются как
`type_unknown`, продуктовые данные и права не затрагиваются.
