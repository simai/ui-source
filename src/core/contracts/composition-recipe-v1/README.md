# Composition Recipe 1.0.1: нормативный комплект

Архитектура согласована пользователем 2026-09-14 после третьего отзыва Larena.
Редакция 1.0.1 уточняет статус без изменения схем и алгоритма редакции 1.0.0.
Сборщик Recipe реализован в Framework и проверен на одной точной кандидатной
поставке вместе с Larena и standalone Docara. Массовое подключение страниц,
переключение работающих сайтов и внешний релиз не приняты.
Канонический владелец — ui-source. Document v1 и type manifest v1 не изменяются.

## Файлы и версии

- recipe.schema.json — simai.composition.recipe.v1.
- manifest.schema.json — simai.composition.recipe-manifest.v1.
- inputs.schema.json — simai.composition.inputs.v1, snapshot доверенных входов.
- dependencies.schema.json — simai.composition.dependencies.v1, результат сборки.
- common.schema.json — общие определения, только через ссылки из схем.
- limits.json — конечные пределы сборки.
- fixtures/header-switch.json — полные источники и ожидаемые результаты двух режимов.
- fixtures/canonicalization.json — байты и digest для межъязыковой проверки.
- contract.lock.json — отпечатки нормативных файлов и базового Framework.

Доступность схем не означает публичную поддержку этих schema IDs runtime.
Совместимый потребитель объявляет Recipe capability только после приёмки сборщика.

## Неизменяемые границы

Recipe описывает сборку интерфейса. Продукт предоставляет данные, права, scope,
версии и публикацию. Framework определяет алгоритм раскрытия и проверяет результат.
HTML, произвольный код, CSS-классы и запросы в Recipe запрещены. Presentation
выбирает только зарегистрированные view/preset/modifiers. Утилиты реализует renderer.
Встроенный layout.page имеет только default; authoring slots переводятся в его детей.

При чтении JSON дубли ключей, некорректный Unicode и не-JSON значения отклоняются.
Unknown fields запрещены схемами. Extensions допускаются только в явно объявленных
местах и с namespace. Неизвестное необязательное расширение сохраняется без исполнения;
объект с required=true требует объявленной поддержки, иначе ошибка.
Вводные extensions Recipe остаются в Recipe и влияют на его digest; автоматически
в Document не копируются. Node extensions переходят в Document и проверяются им.

## Формы, области имён и слоты

Placement — ровно node, ref или select вместе с id. InsertSlot допустим только
среди slot entries. Корнем не является. Каждый body и root Recipe имеют отдельную
область local IDs; внутри неё IDs записей уникальны. Каждая ветвь select образует отдельную область,
поэтому одинаковые local IDs разных cases допустимы; каждая область проверяется отдельно.
Внешний source body начинает новую область. Названия parameters/inputs/slots
существуют в своих пространствах. Ссылка не выполняет неявного наследования параметров.

Template source — manifest с body. Fragment source в первом комплекте — placement
без параметров и публичных слотов. Параметризуемую часть оформляют template независимо
от её библиотечного названия. Ref на fragment с params или slot arguments — ошибка.
Так источник каждой kind имеет ровно одну проверяемую форму.

InsertSlot принадлежит ближайшему вызову template. ID вставки обязателен.
Переданный slot заменяет defaults, отсутствие использует defaults, [] явно очищает.
Defaults используют lexical context шаблона; переданные entries — контекст вызова.
Повторная вставка slot допустима только через разные insertion IDs. Ограничения
слота проверяются после раскрытия каждой вставки, затем по manifest конечного типа.
Неиспользованный переданный slot — ошибка, поскольку иначе теряются авторские данные.
Min должен быть <= max. Запрещено незаметное отбрасывание неизвестных параметров.

## Значения, defaults и select

Значение — одна оболочка literal/input/parameter. Literal содержит JSON целиком,
внутри него нет интерполяции. Input адресует объявленный вход Recipe; parameter —
ближайший вызов template. Никакого преобразования типов и вычисления выражений.
Схемы значений ограничены словарём valueSchema в common.schema.json.
Параметр без default обязателен. default параметра допускается только literal.
Input declaration default также только literal. Validate defaults по схеме значения.

У select ключи cases и значение являются строками; проверяется конечный enum
соответствующего входа/параметра либо literal. MissingCase обязан называть существующую
ветвь. Сначала input/parameter default, затем missingCase при явном missing;
неизвестное значение, null неправильного типа, отказ доступа и source_error — ошибка.
Проверяется синтаксис всех ветвей, но внешние refs неактивных ветвей не разрешаются.
Вызовы портов идут в порядке обхода дерева и массивов, только активная ветвь.

## Snapshot, входы и binding

Scope поступает от доверенного продукта. Ссылки идентифицируются tuple
(scope,kind,owner,ref,revision). Доступ к общей области продукт разрешает отдельно.
Snapshot фиксируется на всю сборку. Один input или точный source читается один раз;
повторные обращения используют то же значение. Повторное раскрытие всё равно расходует
лимит шагов. Product adapter обязан вернуть согласованные источники или ошибку.

Input envelope: kind, value, valueDigest и origin для setting/content. Product adapter
удостоверяет источник и права; хеш удостоверяет только соответствие value.
Проверяются declaration kind/schema, expectedOrigin, scope и пересчитанный valueDigest.
Для content в первом этапе expectedOrigin с owner/ref обязателен; revision может быть
закреплена declaration либо выбрана snapshot продукта. Несовпадение — document=null.
Input parameter без origin допустим; он всё равно попадает в receipt с valueDigest.

Authoring binding {input,target} допустим только для content input и непосредственного
поля data[target]. Оно должно иметь value {input: тот же input}. Совпадение target,
manual revision и автоматическое назначение другого input запрещены. Полученный
Document binding строится из origin: owner/ref/target/revision. Props bindings остаются
вне этого первого режима; обычные проверенные параметры props поддерживаются.
Проверяется data_schema конечного типа. Контент и binding получены из одного envelope.

Missing вход может использовать default. Receipt тогда содержит resolution=default,
valueDigest default и missingSource вместо origin. У параметра без внешнего источника
missingSource отсутствует. Для setting/content missingSource обязателен; зависимость
от отсутствующего источника нужна для обнаружения его будущего появления.
Не добавлять выдуманную ревизию. Доступ к источнику не подменять missing.

## Алгоритм идентичности

ID = n- + SHA-256(UTF-8 compact JSON ["sf-composition-node-v1", recipeId, segments]).
Segments — упорядоченный массив пар строк. Все идентификаторы ASCII, без normalizing.

- node X добавляет [node,X], затем получает ID;
- ref X добавляет [placement,X], затем раскрывает source body по обычным правилам;
- select X добавляет [select,X], затем [case,key] и раскрывает entry выбранной ветви;
- слот конечного node S добавляет [slot,S] перед обработкой детей;
- insertSlot X имени S добавляет [insertion,X], [argument-slot,S] перед вставкой детей.

Имена node и placement не объединяются даже при совпадении. Source revision и индексы
соседей не входят в ID. Перестановка соседей сохраняет ID, перенос меняет. Разные
insertion IDs создают разные экземпляры. Duplicate identity и коллизия digest — ошибка.
Полученный ID имеет 66 символов. Полные пути сохраняются отдельно в trace.

## Алгоритм сборки

1. Проверить JSON, размер, схемы Recipe, declarations и синтаксис всех branches.
2. Зафиксировать доверенный scope, execution contract, доступные capabilities и budgets.
3. Идти в depth-first порядке. До каждой операции проверять остаток budgets.
4. Ref: разрешить policy, получить manifest/body, проверить revision/digest/schema/scope.
   Для template проверить параметры и slots до раскрытия. Проверить active reference stack.
5. Вычислить значения из snapshot. Проверить origin/digest и схемы значений. Записать
   использованные входы. Defaults не скрывают отказ доступа или повреждение.
6. Select: выбрать одну ветвь. Остальные не выполняют I/O.
7. Node: вычислить data/props/presentation и binding, раскрыть children/insertion, создать ID.
8. Проверить limits и manifest constraints итоговых узлов и слотов.
9. Проверить Document v1 и нормализовать существующим Framework API.
10. Сформировать document, dependencyReceipt, trace и diagnostics.

Любая блокирующая ошибка возвращает document=null, dependencyReceipt=null и diagnostics.
Частичный trace может возвращаться после удаления секретов; публикация невозможна.
Renderer получает готовый Document с data и без I/O callback в первом режиме.
Неизвестный обязательный extension — ошибка; неизвестный тип/renderer не обходится.

## Receipt и execution contract

Receipt — данные только о реально прочитанных источниках. Inputs dedup по имени;
references dedup по полному tuple. Порядок — первое чтение в нормативном обходе;
он детерминирован для неизменных источников. Logical pointers содержат generation и
resolvedRevision и связываются с выбранной exact reference того же scope/kind/owner/ref.
Pinned не создаёт pointer dependency. Trace в document digest не входит.

ExecutionContract содержит contractDigest, registryDigest, rendererDigest и имя
канонизации. Registry digest — digest массива manifests, отсортированного по type.
Renderer digest для этого corpus — SHA-256 concatenation исходных bytes index.mjs,
затем builtins.mjs. Другой host публикует собственный renderer digest. Код и assets
готовой поставки связываются BOM; совпадение номеров версий недостаточно.

ContractDigest — SHA-256 canonical map относительныйПуть -> sha256:байты для схем,
README, limits и canonicalization vectors, перечисленных в lock. Corpus с receipts
не входит в этот digest, чтобы исключить самоссылку; его отпечаток закреплён в lock
отдельно. Lock не хеширует сам себя. Изменения нормативных файлов требуют нового lock
и проверки потребителей. Внешнего релиза в этом комплекте нет.

## Канонизация simai.recipe.canonical-json.v1

Порядок ключей соответствует текущему JS stableStringify + JSON.stringify:
сначала канонические десятичные array-index ключи 0..4294967294 без ведущих нулей,
по числовому значению; затем остальные ключи лексикографически по UTF-16 code units.
Это правило применяется рекурсивно; оно учитывает переупорядочивание ключей JS object. Массивы сохраняют порядок. Null/boolean стандартные.
Строки — корректный Unicode, без нормализации; UTF-8 без BOM. Управляющие U+0000..001F
экранируются: short escapes для b,t,n,f,r, остальные lowercase \\u00xx. Quote/backslash
экранируются; slash, Unicode, U+2028/U+2029 остаются буквальными.

Числа первого межъязыкового профиля — математически целые в [-9007199254740991,
9007199254740991]. Дробные и вне диапазона отклоняются. -0 становится 0; 1.0 и 1e0
после корректного JSON-декодирования становятся 1. Это ограничение Recipe corpus,
а не молчаливое изменение Document v1. Непарные суррогаты, duplicate object keys,
NaN/Infinity/undefined запрещены. Пустой object {} не превращается в array [].
Digest = sha256: + lowercase SHA-256 канонических UTF-8 bytes.

## Пределы и ошибки

Limits задаёт жёсткие максимумы; продукт может только уменьшить положительные значения.
Байты учитываются по UTF-8 входных JSON до разбора и перед добавлением очередного
фрагмента результата. TotalSourceBytes — сумма уникальных полученных source bytes;
InputBytes включает envelope. MaxReferenceDepth — число активных ref frames, включая
корневой ref. Cycle — точная ссылка уже в активном стеке, не в глобальном кеше.
ExpansionSteps: каждая посещённая node/ref/select/insertion, каждое разрешение value
и каждое чтение источника/input; повторные инстанцирования учитываются.
IntermediateBytes — бюджет канонических bytes материализуемых накопленных промежуточных
JSON-значений; максимальное значение действует даже если финальный результат меньше.
Budgets проверяются до append/allocation, порты читают ограниченный поток. Это логический
бюджет, не обещание точной величины heap; host дополнительно ограничивает memory/time.
Output limits применяются до normalize/render. Input schema не заменяет budget checks.

Ошибки: code, sourcePath (JSON Pointer к Recipe или source), referenceChain и безопасное
message. Коды: invalid_json, unknown_field, invalid_value, unknown_type, unknown_slot,
unknown_parameter, missing_input, missing_reference, reference_cycle, revision_mismatch,
input_origin_mismatch, input_digest_mismatch, access_denied, source_error,
duplicate_id, limit_exceeded, incompatible_profile, unsupported_extension,
invalid_resolved_document, renderer_unavailable. Детали текущего validate прикладываются
без переименования его кодов. Unknown field может сообщаться рядом с schema diagnostics.

## Публикация принадлежит продукту

Pinned по умолчанию; follow-published — явный выбор. Публичная страница всегда использует
точный активный snapshot. Атомарность первого этапа — одна страница целиком. Очередь
может обновлять страницы постепенно. Перед активацией сверяются desired generation и
ожидаемый active snapshot. Старый завершившийся job не может перезаписать новую версию.
Ошибка оставляет старую страницу только при актуальных правах/публикации. Откат — новая
операция активации целого предыдущего snapshot, инвалидирующая старые jobs. TTL не
выбирает новые refs. Атомарность всего сайта не требуется.

## Приёмка отдельно от схем

Ожидаемые Documents зафиксированы независимо от будущего resolver. Проверка схем/SSR
не считается доказательством раскрытия. Реальный сборщик совпал с corpus и
измеряемыми проверками чтения источников. PHP, standalone Docara, браузер и публикация
принимаются отдельно. Текущая реализация и generated outputs проверены отдельно от
внедрения на работающих сайтах. Для конкретного сайта нужны проверка закреплённой
сборки, ресурсов в браузере, публикации и возврата к предыдущему результату.
