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
// component imports ICON_CHOICES; a page reads SF.icons.choices. The choice
// itself is drawn by sf-dropdown with options of kind icon (layout grid,
// search), as sf-view-properties and sf-admin-menu do.
export const ICON_CHOICES = Object.freeze([
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
]);

// Core publishes the list; a component bundle that carries its own copy reuses
// the published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  globalThis.SF.icons = globalThis.SF.icons || {};
  if (!globalThis.SF.icons.choices) globalThis.SF.icons.choices = ICON_CHOICES;
}

export default ICON_CHOICES;
