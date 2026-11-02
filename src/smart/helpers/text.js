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
    const words = normalizeInitialsWords(value);
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
