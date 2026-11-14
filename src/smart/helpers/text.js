const INITIALS_SKIP_WORDS = new Set([
    "а",
    "без",
    "в",
    "во",
    "для",
    "до",
    "за",
    "из",
    "из-за",
    "из-под",
    "и",
    "к",
    "ко",
    "между",
    "на",
    "над",
    "о",
    "об",
    "от",
    "по",
    "под",
    "при",
    "про",
    "с",
    "со",
    "у",
    "через",
    "the",
    "a",
    "an",
    "and",
    "for",
    "from",
    "in",
    "of",
    "on",
    "to",
]);

// Words a name carries that are not the person's or the organisation's own
// (owner decision C152 (3), 2026-11-14): legal forms (ООО «Ромашка» → Р),
// titles (Dr. John Smith → JS) and name particles (Мария фон Штейн → МШ) are
// skipped wherever they stand. Compared without case and without the dots
// around them (normalizeInitialsWords strips those).
const INITIALS_SERVICE_WORDS = new Set([
    // legal forms
    "ооо", "оао", "зао", "пао", "ао", "нао", "ип", "нко", "ано", "гуп", "муп", "фгуп", "гбу", "мбу", "чоп",
    "llc", "inc", "ltd", "gmbh", "ag", "corp", "co", "llp", "plc", "lp", "bv", "oy", "ab", "srl", "sarl",
    // titles
    "dr", "prof", "mr", "mrs", "ms", "mx", "miss", "sir", "jr", "sr", "phd",
    "д-р", "проф", "акад", "г-н", "г-жа", "доц",
    // particles
    "фон", "ван", "дер", "де", "ди", "да", "дю", "ла", "ле", "ибн", "бен", "оглы", "кызы",
    "von", "van", "der", "den", "de", "di", "da", "du", "del", "della", "la", "le", "ten", "ter", "bin", "ibn",
]);

export function normalizeInitialsWords(value = "") {
    return String(value || "")
        .trim()
        .split(/[\s/|]+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter(Boolean);
}

// The first character a reader sees: a whole grapheme, so a letter written
// with a combining accent («E» + U+0301) or outside the basic plane keeps all
// of its code points. Array.from alone splits surrogate pairs correctly but
// not combining marks; Intl.Segmenter does both where the platform has it.
function firstGrapheme(word) {
    const Segmenter = globalThis.Intl?.Segmenter;
    if (typeof Segmenter === "function") {
        for (const {segment} of new Segmenter(undefined, {granularity: "grapheme"}).segment(word)) {
            return segment;
        }
        return "";
    }
    return Array.from(word)[0] || "";
}

// The one rule for initials (reuse audit 2026-11-02, finding 10): sf-avatar,
// the context menu, the admin menu and the chat drew them by five rules that
// disagreed on a hyphen, an empty name and a letter outside the basic plane.
//
//   «Анна Смирнова»        → «АС»   the first letters of the first two words
//   «Отдел по работе»      → «ОР»   a preposition after the first word is skipped
//   «Жан-Поль»             → «ЖП»   one hyphenated word reads as its parts
//   «Анна-Мария Смирнова»  → «АС»   ...but a name of several words by its words
//   «Анна»                 → «А»
//   «ООО «Ромашка»»        → «Р»    legal forms, titles, particles skipped (C152)
//   «Мария фон Штейн»      → «МШ»
//   «Dr. John Smith»       → «JS»
//   «anna@simai.ru»        → «A»    an address: the first letter before «@»
//   «»                     → ''     or `fallback`: '?' where text must stand
//
// `maxLetters` caps the letters (two), `skipWords` replaces the skipped words,
// `locale` capitalises by a locale's rule.
export function getInitials(value = "", options = {}) {
    const {
        maxLetters = 2,
        skipWords = INITIALS_SKIP_WORDS,
        fallback = "",
        locale,
    } = options;
    let source = String(value ?? "").trim();
    // An address reads by the name before «@»: one letter (C152 (3)),
    // anna@simai.ru → A, not the letters of its parts.
    if (/^[^\s@]+@[^\s@]+$/u.test(source)) {
        const local = normalizeInitialsWords(source.slice(0, source.indexOf("@")).replace(/[._+-]+/gu, " "));
        if (!local.length) return String(fallback);
        const letter = firstGrapheme(local[0]);
        return (locale ? letter.toLocaleUpperCase(locale) : letter.toUpperCase()) || String(fallback);
    }
    const allWords = normalizeInitialsWords(source);
    // Legal forms, titles and particles go first; a name made of them alone
    // keeps them, so it still has initials.
    const ownWords = allWords.filter((word) => !INITIALS_SERVICE_WORDS.has(String(word).toLowerCase()));
    const words = ownWords.length ? ownWords : allWords;
    let significantWords = words.filter(
        (word, index) =>
            index === 0 || !skipWords.has(String(word).toLowerCase()),
    );

    // One word written with a hyphen or a dash is a compound name: its parts
    // are its words. Split before the skip list, «из-за» would be two words.
    if (significantWords.length === 1) {
        const parts = significantWords[0].split(/[-\u2010-\u2015]+/u).filter(Boolean);
        if (parts.length > 1) significantWords = parts;
    }

    if (!significantWords.length) {
        return String(fallback);
    }

    const letters = significantWords.length > 1
        ? significantWords.slice(0, Math.max(1, maxLetters)).map(firstGrapheme).join("")
        : firstGrapheme(significantWords[0]);

    return (locale ? letters.toLocaleUpperCase(locale) : letters.toUpperCase()) || String(fallback);
}
