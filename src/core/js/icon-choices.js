// The glyphs a person may mark a part of an interface with -- a section of a
// record, a row of a menu, a tile of a dashboard. A hundred and twenty names
// from the Framework's own icon set, the ones products actually reach for,
// read in rows of what they are usually about: what a thing is, who it
// belongs to, when it happens, what it costs, what it is made of. One list,
// so every set chooses from the same glyphs.
//
// Raised from ui-pro sf-view-properties (js/icon-choices.js), which sf-admin-menu
// imported across what become two component sets (duplication audit
// 2026-11-03, A-1; owner decision 2026-11-03, component sets, point 13). A
// component imports ICON_CHOICES; a page reads SF.icons.choices, and
// SF.icons.choices.words[name] gives a glyph's Russian and English words
// (C151 point 8). The choice
// itself is drawn by sf-dropdown with options of kind icon (layout grid,
// search), as sf-view-properties and sf-admin-menu do.
// The words a person searches the choice by (owner decision C151 point 8): a
// Russian and an English word or two for each glyph, the name's own words
// among the English ones. sf-dropdown matches its icon options against them
// in either language, so «папка» finds folder and «folder» still does.
export const ICON_CHOICE_WORDS = Object.freeze({
  folder: {ru: ["папка", "каталог"], en: ["folder", "directory"]},
  folder_open: {ru: ["открытая", "папка"], en: ["open", "folder"]},
  topic: {ru: ["тема", "раздел"], en: ["topic", "section"]},
  home: {ru: ["главная", "дом"], en: ["home", "main"]},
  dashboard: {ru: ["панель", "сводка"], en: ["dashboard", "overview"]},
  apartment: {ru: ["здание", "организация"], en: ["building", "organisation"]},
  store: {ru: ["магазин"], en: ["store", "shop"]},
  storefront: {ru: ["витрина", "магазин"], en: ["storefront", "shop"]},
  business_center: {ru: ["портфель", "бизнес"], en: ["business", "briefcase"]},
  work: {ru: ["работа", "портфель"], en: ["work", "briefcase"]},
  badge: {ru: ["пропуск", "удостоверение"], en: ["badge", "pass", "id"]},
  person: {ru: ["человек", "пользователь"], en: ["person", "user"]},
  group: {ru: ["группа", "люди"], en: ["group", "people"]},
  groups: {ru: ["группы", "сообщество"], en: ["groups", "community"]},
  account_circle: {ru: ["профиль", "аккаунт"], en: ["account", "profile"]},
  manage_accounts: {ru: ["управление", "пользователями"], en: ["manage", "accounts", "users"]},
  supervisor_account: {ru: ["руководитель", "команда"], en: ["supervisor", "team"]},
  contacts: {ru: ["контакты"], en: ["contacts"]},
  school: {ru: ["обучение", "школа"], en: ["school", "learning"]},
  menu_book: {ru: ["книга", "справочник"], en: ["book", "manual"]},
  assignment: {ru: ["задание"], en: ["assignment"]},
  task: {ru: ["задача"], en: ["task"]},
  description: {ru: ["документ", "описание"], en: ["document", "description"]},
  article: {ru: ["статья"], en: ["article"]},
  note_alt: {ru: ["заметка"], en: ["note"]},
  edit_note: {ru: ["правка", "заметки"], en: ["edit", "note"]},
  draft: {ru: ["черновик"], en: ["draft"]},
  receipt: {ru: ["чек", "квитанция"], en: ["receipt"]},
  receipt_long: {ru: ["счёт", "чек"], en: ["bill", "receipt"]},
  request_quote: {ru: ["смета", "предложение"], en: ["quote", "estimate"]},
  inventory_2: {ru: ["архив", "склад"], en: ["archive", "inventory"]},
  category: {ru: ["категории"], en: ["category"]},
  label: {ru: ["метка", "ярлык"], en: ["label", "tag"]},
  sell: {ru: ["цена", "продажа"], en: ["price", "sell"]},
  local_offer: {ru: ["скидка", "предложение"], en: ["offer", "discount"]},
  shopping_cart: {ru: ["корзина"], en: ["shopping", "cart"]},
  shopping_bag: {ru: ["покупки", "сумка"], en: ["shopping", "bag"]},
  payments: {ru: ["оплата", "деньги"], en: ["payments", "money"]},
  savings: {ru: ["сбережения", "копилка"], en: ["savings"]},
  credit_card: {ru: ["карта", "оплата"], en: ["credit", "card"]},
  account_balance: {ru: ["банк"], en: ["bank", "account"]},
  calculate: {ru: ["калькулятор", "расчёт"], en: ["calculator"]},
  percent: {ru: ["процент"], en: ["percent"]},
  trending_up: {ru: ["рост", "тренд"], en: ["trend", "growth"]},
  analytics: {ru: ["аналитика"], en: ["analytics"]},
  insights: {ru: ["выводы", "инсайты"], en: ["insights"]},
  monitoring: {ru: ["мониторинг"], en: ["monitoring"]},
  bar_chart: {ru: ["диаграмма", "график"], en: ["bar", "chart"]},
  pie_chart: {ru: ["круговая", "диаграмма"], en: ["pie", "chart"]},
  table_chart: {ru: ["таблица"], en: ["table"]},
  schedule: {ru: ["время", "часы", "расписание"], en: ["time", "clock", "schedule"]},
  event: {ru: ["событие"], en: ["event"]},
  today: {ru: ["сегодня"], en: ["today"]},
  calendar_month: {ru: ["календарь"], en: ["calendar"]},
  date_range: {ru: ["период", "даты"], en: ["date", "range"]},
  history: {ru: ["история"], en: ["history"]},
  alarm: {ru: ["будильник", "напоминание"], en: ["alarm"]},
  timer: {ru: ["таймер"], en: ["timer"]},
  update: {ru: ["обновление"], en: ["update"]},
  hourglass_top: {ru: ["ожидание", "песочные", "часы"], en: ["hourglass", "waiting"]},
  mail: {ru: ["почта", "письмо"], en: ["mail", "email", "letter"]},
  outgoing_mail: {ru: ["исходящие", "отправка"], en: ["outgoing", "mail"]},
  chat: {ru: ["чат", "сообщение"], en: ["chat", "message"]},
  forum: {ru: ["обсуждение", "форум"], en: ["forum", "discussion"]},
  sms: {ru: ["смс", "сообщение"], en: ["sms", "text"]},
  call: {ru: ["звонок", "телефон"], en: ["call", "phone"]},
  phone_in_talk: {ru: ["разговор"], en: ["phone", "call", "talk"]},
  contact_support: {ru: ["поддержка"], en: ["support", "help"]},
  campaign: {ru: ["рассылка", "объявление"], en: ["campaign", "announcement"]},
  notifications: {ru: ["уведомления"], en: ["notifications"]},
  language: {ru: ["язык", "мир"], en: ["language", "world"]},
  public: {ru: ["сайт", "мир", "интернет"], en: ["public", "web", "world"]},
  place: {ru: ["место"], en: ["place"]},
  map: {ru: ["карта"], en: ["map"]},
  location_on: {ru: ["адрес", "место"], en: ["location", "address"]},
  travel_explore: {ru: ["поиск", "по", "миру"], en: ["travel", "explore"]},
  flight: {ru: ["перелёт", "самолёт"], en: ["flight", "plane"]},
  local_shipping: {ru: ["доставка"], en: ["shipping", "delivery"]},
  route: {ru: ["маршрут"], en: ["route"]},
  directions: {ru: ["направление"], en: ["directions"]},
  settings: {ru: ["настройки"], en: ["settings"]},
  tune: {ru: ["фильтр", "параметры"], en: ["tune", "filter"]},
  build: {ru: ["инструменты", "сборка"], en: ["build", "tools"]},
  construction: {ru: ["стройка"], en: ["construction"]},
  handyman: {ru: ["ремонт", "мастер"], en: ["handyman", "repair"]},
  code: {ru: ["код"], en: ["code"]},
  terminal: {ru: ["терминал", "консоль"], en: ["terminal", "console"]},
  data_object: {ru: ["объект", "данные"], en: ["data", "object"]},
  api: {ru: ["интерфейс", "api"], en: ["api"]},
  bug_report: {ru: ["ошибка", "баг"], en: ["bug"]},
  database: {ru: ["база", "данных"], en: ["database"]},
  storage: {ru: ["хранилище"], en: ["storage"]},
  cloud: {ru: ["облако"], en: ["cloud"]},
  backup: {ru: ["резервная", "копия"], en: ["backup"]},
  sync: {ru: ["синхронизация"], en: ["sync"]},
  folder_zip: {ru: ["архив", "zip"], en: ["zip", "archive"]},
  upload_file: {ru: ["загрузка", "файла"], en: ["upload", "file"]},
  download: {ru: ["скачать"], en: ["download"]},
  attach_file: {ru: ["вложение", "скрепка"], en: ["attach", "file"]},
  link: {ru: ["ссылка"], en: ["link"]},
  lock: {ru: ["замок", "доступ"], en: ["lock"]},
  lock_open: {ru: ["открытый", "доступ"], en: ["unlock", "open"]},
  shield: {ru: ["защита"], en: ["shield", "protection"]},
  verified_user: {ru: ["проверено", "безопасность"], en: ["verified", "user"]},
  key: {ru: ["ключ"], en: ["key"]},
  admin_panel_settings: {ru: ["администрирование"], en: ["admin"]},
  policy: {ru: ["правила", "политика"], en: ["policy"]},
  gavel: {ru: ["закон", "право"], en: ["law", "gavel"]},
  fingerprint: {ru: ["отпечаток"], en: ["fingerprint"]},
  visibility: {ru: ["видимость", "просмотр"], en: ["visibility", "view"]},
  palette: {ru: ["палитра", "цвет"], en: ["palette", "colour", "color"]},
  format_paint: {ru: ["оформление", "кисть"], en: ["format", "paint"]},
  image: {ru: ["картинка", "изображение"], en: ["image", "picture"]},
  photo_library: {ru: ["фото", "галерея"], en: ["photos", "gallery"]},
  collections: {ru: ["коллекции"], en: ["collections"]},
  movie: {ru: ["видео", "фильм"], en: ["movie", "video"]},
  play_circle: {ru: ["воспроизведение"], en: ["play"]},
  mic: {ru: ["микрофон"], en: ["microphone"]},
  headphones: {ru: ["наушники", "звук"], en: ["headphones", "audio"]},
  brush: {ru: ["кисть", "рисование"], en: ["brush"]},
});

// The words of any glyph name: the choice's words, or the name read as words
// (folder_open -> folder open) for a glyph outside the choice.
export function iconWords(name) {
  const key = String(name || '').trim();
  const words = Object.hasOwn(ICON_CHOICE_WORDS, key) ? ICON_CHOICE_WORDS[key] : null;
  const own = key.split('_').filter(Boolean);
  return {ru: words ? [...words.ru] : [], en: [...new Set([...(words ? words.en : []), ...own])]};
}

export const ICON_CHOICES = Object.freeze(Object.defineProperty([
    "folder", "folder_open", "topic", "home", "dashboard",
    "apartment", "store", "storefront", "business_center", "work",
    "badge", "person", "group", "groups", "account_circle",
    "manage_accounts", "supervisor_account", "contacts", "school", "menu_book",
    "assignment", "task", "description", "article", "note_alt",
    "edit_note", "draft", "receipt", "receipt_long", "request_quote",
    "inventory_2", "category", "label", "sell", "local_offer",
    "shopping_cart", "shopping_bag", "payments", "savings", "credit_card",
    "account_balance", "calculate", "percent", "trending_up", "analytics",
    "insights", "monitoring", "bar_chart", "pie_chart", "table_chart",
    "schedule", "event", "today", "calendar_month", "date_range",
    "history", "alarm", "timer", "update", "hourglass_top",
    "mail", "outgoing_mail", "chat", "forum", "sms",
    "call", "phone_in_talk", "contact_support", "campaign", "notifications",
    "language", "public", "place", "map", "location_on",
    "travel_explore", "flight", "local_shipping", "route", "directions",
    "settings", "tune", "build", "construction", "handyman",
    "code", "terminal", "data_object", "api", "bug_report",
    "database", "storage", "cloud", "backup", "sync",
    "folder_zip", "upload_file", "download", "attach_file", "link",
    "lock", "lock_open", "shield", "verified_user", "key",
    "admin_panel_settings", "policy", "gavel", "fingerprint", "visibility",
    "palette", "format_paint", "image", "photo_library", "collections",
    "movie", "play_circle", "mic", "headphones", "brush",
], 'words', {value: ICON_CHOICE_WORDS, enumerable: false}));

// Core publishes the list; a component bundle that carries its own copy reuses
// the published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  globalThis.SF.icons = globalThis.SF.icons || {};
  if (!globalThis.SF.icons.choices) globalThis.SF.icons.choices = ICON_CHOICES;
}

export default ICON_CHOICES;
