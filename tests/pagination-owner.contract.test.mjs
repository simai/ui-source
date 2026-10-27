/* global URL */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Pagination exposes a named navigation list with one current page", async () => {
  const [runtime, template] = await Promise.all([
    read("src/smart/pagination/index.js"),
    read("src/smart/pagination/js/templates/default.js"),
  ]);

  assert.match(runtime, /attribute: "aria-label"/);
  assert.match(runtime, /get ariaLabel\(\)/);
  assert.match(template, /<nav[\s\S]*aria-label=\$\{context\.ariaLabel\}/);
  assert.match(template, /<ol class="sf-pagination-list/);
  assert.match(template, /<li class="sf-pagination-item/);
  assert.match(template, /aria-current=\$\{item\.selected \? "page" : nothing\}/);
  assert.doesNotMatch(template, /aria-current=.*"false"/);
});

// The gap between the numbers is gone. It was first required to be an
// aria-hidden span with no action, then on 2026-10-03 a button that named the
// page it jumped to, and on 2026-10-04 the owner of the consumer replaced the
// whole scheme with a window around the current page plus a number field. There
// is nothing left to disclose, so what this test guards now is that the gap does
// not come back without the scheme that needed it.
test("Pagination has no gap between the numbers to disclose", async () => {
  const template = await read("src/smart/pagination/js/templates/default.js");
  const styles = await read("src/component/pagination/scss/_css__page_number.scss");

  assert.doesNotMatch(template, /ellipsis/);
  // The component layer keeps its ellipsis modifier: nothing in the Framework
  // forbids a host from writing a page number row of its own.
  assert.match(styles, /\.sf-page-number--ellipsis/);
});

test("Pagination renders source-driven summary and localized control labels", async () => {
  const [runtime, template] = await Promise.all([
    read("src/smart/pagination/index.js"),
    read("src/smart/pagination/js/templates/default.js"),
  ]);

  for (const attribute of [
    "selected-count",
    "pages-label",
    "page-label",
    "previous-label",
    "next-label",
    "last-label",
    "total-label",
    "selected-label",
    "actions-label",
  ]) {
    assert.match(runtime, new RegExp(`attribute: "${attribute}"`));
  }
  // Round four took the marked count out of the footer; the band of bulk
  // controls is where it is said, and only while something is marked.
  assert.doesNotMatch(template, /context\.selectedCount\}\/\$\{context\.total/);
  // The total as shown: N, or «~N» while it is an estimate (gate 29).
  assert.match(template, /context\.totalLabel\} \$\{context\.shownTotal/);
  assert.match(runtime, /get shownTotal\(\) \{\s*return this\.totalExact \? String\(this\.total\) : `~\$\{this\.total\}`;/);
  assert.doesNotMatch(template, /0\/10|Показать количество/);
  // Greyed controls were the earlier answer here. The consumer's owner replaced
  // it on 2026-10-03: a direction that leads nowhere is not shown, and neither
  // is Show more when there is no next portion. A disabled control still reads
  // as a promise, and the row of controls changed shape anyway as pages ran out.
  assert.match(template, /\$\{context\.hasPrev\s*\?\s*html`/);
  assert.match(template, /\$\{context\.top && context\.hasNext\s*\?\s*html`/);
  assert.doesNotMatch(template, /\?disabled=\$\{!context\.has(Prev|Next)\}/);
});

test("Pagination handles an empty set without a fake page action", async () => {
  const runtime = await read("src/smart/pagination/index.js");

  // The guards are about a count that is known to be zero. When the host sends
  // no count at all there is no empty set to answer: it has said there are
  // records and whether more follow.
  assert.match(runtime, /get pageItems\(\) \{[\s\S]*?if \(this\.exactCount && this\.total === 0\) \{\s*return \[\]/);
  // The action go-to-page answers an outcome (standard 1.3.8 §4.4).
  assert.match(runtime, /goToPage\(page\) \{\s*if \(this\.exactCount && this\.total === 0\) \{\s*return \{ outcome: "refused", reason: "empty" \}/);
  assert.match(await read("src/smart/pagination/js/templates/default.js"), /!context\.countKnown \|\| context\.total > 0/);
  assert.match(runtime, /getBooleanAttr\("show-page-size", true\)/);
});

test("Pagination geometry uses semantic tokens and keyboard-only focus", async () => {
  const [pagination, pageNumber] = await Promise.all([
    read("src/component/pagination/scss/_css__pagination.scss"),
    read("src/component/pagination/scss/_css__page_number.scss"),
  ]);
  const styles = `${pagination}\n${pageNumber}`;

  assert.match(styles, /var\(--sf-radius--ui\)/);
  assert.match(styles, /display: inline-flex/);
  assert.match(styles, /text-decoration: none/);
  assert.match(styles, /var\(--sf-a1\)/);
  assert.match(pageNumber, /:focus-visible/);
  assert.doesNotMatch(pageNumber, /:focus(?!-visible)/);
  assert.match(pageNumber, /transition-property: background-color, border-color, box-shadow, color/);
  assert.match(pageNumber, /prefers-reduced-motion: reduce/);
  assert.match(pageNumber, /forced-colors: active/);
  assert.match(pagination, /map\.get\(bp\.\$breakpoint-array, md\)/);
  assert.doesNotMatch(styles, /\b\d+(?:\.\d+)?(?:px|rem|em)\b/);
});

test(
  "Pagination reverses only directional icons in RTL and keeps one-line page controls",
  async () => {
    const [template, styles] = await Promise.all([
      read("src/smart/pagination/js/templates/default.js"),
      read("src/component/pagination/scss/_css__pagination.scss"),
    ]);

    // All four ends are icons with tooltips now: first, previous, next, last.
    assert.match(template, /kind: "first"/);
    assert.match(template, /kind: "prev"/);
    assert.match(template, /kind: "next"/);
    assert.match(template, /kind: "last"/);
    assert.match(template, /sf-pagination-direction--\$\{kind\}/);
    assert.doesNotMatch(template, /<span class="sf-pagination-last">/);
    assert.match(template, /item\.edge \? "sf-pagination-item--edge"/);
    assert.match(
      styles,
      /\[dir="rtl"\] \.sf-pagination \.sf-pagination-direction \.sf-icon/,
    );
    assert.match(styles, /\.sf-pagination-direction sf-icon/);
    assert.match(styles, /transform: scaleX\(-1\)/);
    assert.match(styles, /white-space: nowrap/);
    // A narrow screen keeps every place: the window is five numbers wide by
    // design, and the ends and the field are how a person leaves it.
    assert.doesNotMatch(styles, /\.sf-pagination-item--ellipsis[\s\S]{0,200}display: none/);
    assert.match(styles, /\.sf-pagination \.sf-pagination-pages-label \{\s*display: none;/);
  },
);

// A page size list is a list of positive whole numbers.
// The parser used to turn an absent attribute into a single size of zero:
// splitting "" yields one empty segment, Number("") is 0, and 0 is finite, so the
// list was never empty and the default was never reached. A consumer that omitted
// `page-sizes` got one option reading "0", and the rows-per-page dropdown looked
// empty.
test("an absent, blank or invalid page-sizes attribute falls back to the default", async () => {
  const source = await read("src/smart/pagination/index.js");
  const start = source.indexOf("function parsePageSizes");
  const end = source.indexOf("function parseActions");
  assert.ok(start >= 0 && end > start, "the page size parser is still where the rule looks");
  const parsePageSizes = new Function(`${source.slice(start, end)}\nreturn parsePageSizes;`)();

  const fallback = [10, 20, 30, 40];
  for (const absent of [null, undefined, "", "   ", " , ", ",,"]) {
    assert.deepEqual(parsePageSizes(absent), fallback, `${JSON.stringify(absent)} is not a list of sizes`);
  }
  for (const invalid of ["0", "-1", "20.5", "x", [0], [-1], [], ["x"]]) {
    assert.deepEqual(parsePageSizes(invalid), fallback, `${JSON.stringify(invalid)} carries no usable size`);
  }
  assert.deepEqual(parsePageSizes("25,50"), [25, 50]);
  assert.deepEqual(parsePageSizes(" 10 , 20 "), [10, 20]);
  assert.deepEqual(parsePageSizes([5, "7"]), [5, 7]);
  assert.deepEqual(parsePageSizes("25,abc,50"), [25, 50], "a bad segment does not take the good ones with it");
});
