// The one table of retired class names (owner decision C187 (1),
// 2026-11-14), read by the Loader (utility-class-aliases.js), by the C187
// contract test and by the docs. Data only: it stays a plain module so the
// browser bundle and node read the same object.
export default {
  "schema": "simai.framework.retired-classes",
  "schema_version": 1,
  "summary": "The one table of retired class names (owner decision C187 (1), 2026-11-14). A retired class keeps drawing what it drew until remove_after: its sheet stays in the distribution and in utility.full.css, and the Loader notes the first use of each name on a page in SF.deprecations (src/core/js/utility-class-aliases.js reads this table). Each record names its change-journal entry (contracts/changes/journal.json) and retires names (an exact class), patterns (a family of classes; to may refer to the pattern's groups as $1) or sheets (every class of a utility folder, at every breakpoint and state). A variant prefix (md:, hover:, focus-visible:) is kept on both sides. to is the name to write instead, or null where the job leaves the utilities (the record's note says where it went). extended lists the names that stay but are documented on one «extended» page instead of a page each. Nothing here is deleted before remove_after, and nothing is deleted without checking the built sheets, the ui-doc examples, the products and the Loader's Tailwind-name conversion.",
  "records": [
    {
      "journal": "class-table-sm-to-density",
      "decision": "C185 (2)",
      "component": "table",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "A table's row follows the density of its area: data-sf-density=\"compact\" on the table or an ancestor. table-sm and table-small keep drawing a row of the size-1/2 step until the date (utility.table 1.6.0).",
      "names": {
        "table-sm": "data-sf-density=\"compact\"",
        "table-small": "data-sf-density=\"compact\""
      }
    },
    {
      "journal": "class-text-flow-utility-aliases",
      "decision": "C186 (8)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "One text-* family for how a line breaks.",
      "names": {
        "wrap-none": "text-nowrap",
        "text-break-word": "text-break",
        "text-break-all": "text-break",
        "t-ellipsis": "truncate",
        "t-clip": "truncate"
      }
    },
    {
      "journal": "utility-c187-retired-sheets",
      "decision": "C187 (2)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "The raw spacing ladders and the extended translate and background-size ladders: space comes from the space steps and the C105/C173 roles (m-*, p-*, gap-*, scroll-m-*, scroll-p-*, translate-* steps).",
      "sheets": {
        "margin-ext": null,
        "padding-ext": null,
        "scroll-margin-ext": null,
        "scroll-padding-ext": null,
        "background-size-ext": null,
        "transform-translate-ext": null
      }
    },
    {
      "journal": "class-c187-utility-renames",
      "decision": "C187 (3)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Ring widths are 0, 1, 2 (C173 (6)); the ring's colour is a role at full strength, not a tenth step of the alpha scale (C41).",
      "names": {
        "ring-3": "ring-2",
        "ring-4": "ring-2"
      }
    },
    {
      "journal": "utility-c187-retired-sheets",
      "decision": "C187 (3)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Ring widths are 0, 1, 2 (C173 (6)); the ring's colour is a role at full strength, not a tenth step of the alpha scale (C41).",
      "sheets": {
        "ring-opacity": null
      }
    },
    {
      "journal": "utility-c187-divide-spelling",
      "decision": "C187 (4)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "One spelling of the row dividers, divide-* (the Tailwind spelling); the divider's colour is a role (divide-outline-variant), not a tenth step of the alpha scale.",
      "patterns": [
        {
          "from": "divider-*",
          "pattern": "^divider-((?:x|y)-(?:0|1|2|3|4|reverse)|solid|dashed|dotted|double|hidden|none|current|error|info|outline|outline-variant|primary|secondary|success|tertiary|transparent|warning)$",
          "to": "divide-$1"
        }
      ]
    },
    {
      "journal": "utility-c187-retired-sheets",
      "decision": "C187 (4)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "One spelling of the row dividers, divide-* (the Tailwind spelling); the divider's colour is a role (divide-outline-variant), not a tenth step of the alpha scale.",
      "sheets": {
        "divider-opacity": "divide-outline-variant"
      }
    },
    {
      "journal": "utility-c187-retired-sheets",
      "decision": "C187 (5)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Of the effects the utilities keep blur-*, backdrop-blur-* and opacity-*; filters, backdrop filters, masks and blend modes leave (no use in the Framework, the docs examples or the products, 2026-11-14).",
      "sheets": {
        "mix-blend-mode": null,
        "filter-brightness": null,
        "filter-contrast": null,
        "filter-grayscale": null,
        "filter-hue-rotate": null,
        "filter-invert": null,
        "filter-opacity": null,
        "filter-saturate": null,
        "filter-sepia": null,
        "backdrop-filer-hue-rotate": null,
        "backdrop-filter-brightness": null,
        "backdrop-filter-contrast": null,
        "backdrop-filter-grayscale": null,
        "backdrop-filter-invert": null,
        "backdrop-filter-opacity": null,
        "backdrop-filter-saturate": null,
        "backdrop-filter-sepia": null,
        "mask-clip": null,
        "mask-composite": null,
        "mask-mode": null,
        "mask-origin": null,
        "mask-position": null,
        "mask-repeat": null,
        "mask-size": null,
        "mask-type": null
      }
    },
    {
      "journal": "class-c187-utility-renames",
      "decision": "C187 (6)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Motion by role: ease-enter, ease-exit, ease-move, ease-linear on --sf-ease-*. A delay lives inside the component that needs it (C130 (8)); will-change and the slide-in animations leave.",
      "names": {
        "ease-in": "ease-exit",
        "ease-out": "ease-enter",
        "ease-in-out": "ease-move"
      }
    },
    {
      "journal": "class-c187-retired-classes",
      "decision": "C187 (6)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Motion by role: ease-enter, ease-exit, ease-move, ease-linear on --sf-ease-*. A delay lives inside the component that needs it (C130 (8)); will-change and the slide-in animations leave.",
      "names": {
        "animation-from-bottom": null,
        "animation-from-left": null,
        "animation-from-right": null
      }
    },
    {
      "journal": "utility-c187-retired-sheets",
      "decision": "C187 (6)",
      "component": "utility",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Motion by role: ease-enter, ease-exit, ease-move, ease-linear on --sf-ease-*. A delay lives inside the component that needs it (C130 (8)); will-change and the slide-in animations leave.",
      "sheets": {
        "transition-delay": null,
        "will-change": null
      }
    },
    {
      "journal": "class-c187-retired-parts",
      "decision": "C187 (8)",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Small parts: the single legacy tab joins sf-tabs; emoji, the heading outline (its name clashes with the colour role --sf-outline) and hide-show leave.",
      "names": {
        "sf-tab": {
          "to": "sf-tabs",
          "component": "tab"
        },
        "sf-emoji": {
          "to": null,
          "component": "emoji"
        },
        "sf-outline": {
          "to": null,
          "component": "outline"
        },
        "sf-hide-show": {
          "to": null,
          "component": "hide-show"
        }
      }
    },
    {
      "journal": "class-c187-doc-to-docara",
      "decision": "C187 (8)",
      "component": "doc",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "The documentation helpers (sample frame, pair, source, lead, code, checkerboard and stripes) belong to the documentation site: Docara draws them (D20 already holds the example frame). The Framework keeps the sheet until the date.",
      "names": {
        "sf-doc-example": null,
        "sf-doc-pair": null,
        "sf-doc-source": null,
        "sf-doc-lead": null,
        "sf-doc-code": null,
        "sf-doc-checkerboard": null,
        "sf-doc-stripes": null
      }
    },
    {
      "journal": "class-editor-utility-retired",
      "decision": "C170",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "src/utility/editor held one rule, .editor--default.active on the popover layer, and no Loader rule or build ever shipped it. An editor's layers belong to sf-editor-overlay (C170); the folder leaves after the date.",
      "names": {
        "editor--default": "sf-editor-overlay"
      }
    },
    {
      "journal": "class-c96-tabs-looks",
      "decision": "C96 (1)",
      "component": "sf-tabs",
      "since": "2026-11-14",
      "remove_after": "2027-01-01",
      "note": "Two looks of the tabs: the line (default, no modifier) and the plate (sf-tabs--pills). sf-tabs--full draws the line with the tabs sharing the row equally until remove_after.",
      "names": {
        "sf-tabs--full": "sf-tabs"
      }
    },
    {
      "journal": "utility-c208-scrollbar-retired-sheets",
      "decision": "C208 (2), (3)",
      "component": "utility",
      "since": "2026-11-15",
      "remove_after": "2027-01-01",
      "note": "The scrollbar has no palette and no thickness of its own: the thumb takes the place's boundary at rest and its text under the pointer, track 14 and thumb 6 at every density. The thumb colour utilities (scroll-primary ..., scroll-thumb-*), the thumb width utilities (scroll-0 ... scroll-4) and the track width utilities (scroll-bg-1 ... scroll-bg-4) leave; a quieter bar is scroll-subtle.",
      "sheets": {
        "scroll-slider-color": null,
        "scroll-slider-width": null,
        "scroll-backdrop-width": null
      }
    },
    {
      "journal": "class-c212-hide-print",
      "decision": "C212 (6)",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One set to hide: hidden, invisible, sr-only (in the core sheet) and on paper print-hidden, print-only, print-invisible. print-block, print-inline, print-inline-block, print-flex, print-inline-flex and print-table hid an element on screen and set its display on paper: print-only hides it on screen and leaves the display its own classes give it on paper. print-visible-none is print-invisible (invisible on paper, its room kept). print-hidden removes the element on paper (display: none); use print-invisible to keep the space. The old names keep drawing what they drew until remove_after.",
      "names": {
        "print-block": "print-only",
        "print-inline": "print-only",
        "print-inline-block": "print-only",
        "print-flex": "print-only",
        "print-inline-flex": "print-only",
        "print-table": "print-only",
        "print-visible-none": "print-invisible"
      }
    },
    {
      "journal": "class-ut1-layout-col-auto",
      "decision": "C212",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "layout-col-auto wrote column-count: auto; without a column width, which no utility gives, a block with it is always one column, so the class did nothing. Write layout-col-<n> for n columns. It keeps drawing what it drew until remove_after.",
      "names": {
        "layout-col-auto": null
      }
    },
    {
      "journal": "class-ut1-grid-row",
      "decision": "C212",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One set per job (C212): rows are row-*, as columns are col-*. grid-row-auto and grid-row-span-* were one rule with row-auto and row-span-*. They keep drawing until remove_after.",
      "names": {
        "grid-row-auto": "row-auto",
        "grid-row-span-1": "row-span-1",
        "grid-row-span-2": "row-span-2",
        "grid-row-span-3": "row-span-3",
        "grid-row-span-4": "row-span-4",
        "grid-row-span-5": "row-span-5",
        "grid-row-span-6": "row-span-6",
        "grid-row-span-full": "row-span-full"
      }
    },
    {
      "journal": "class-ut1-negative-auto",
      "decision": "IN-4 (RG-UT-L)",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "A negative margin takes a step away; auto has none. -m-auto, -m-top-auto and the other negative auto classes wrote calc(0rem - auto), which the browser drops, so they drew nothing; the sheets no longer write them (utility.margin 1.1.0). Remove the class, or write m-*-auto for an auto margin.",
      "names": {
        "-m-auto": null,
        "-m-top-auto": null,
        "-m-bottom-auto": null,
        "-m-inline-start-auto": null,
        "-m-inline-end-auto": null,
        "-m-inline-auto": null,
        "-m-block-auto": null
      }
    },
    {
      "journal": "class-ut1-bg-position",
      "decision": "C212",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One set per job (C212): the background position is written with the logical sides, bg-inline-start* and bg-inline-end*, which follow dir=\"rtl\" (utility.background-position 1.1.0). bg-left, bg-right and their -top/-bottom forms keep drawing their physical side until remove_after; the Loader's Tailwind conversion already writes the logical names.",
      "names": {
        "bg-left": "bg-inline-start",
        "bg-left-top": "bg-inline-start-top",
        "bg-left-bottom": "bg-inline-start-bottom",
        "bg-right": "bg-inline-end",
        "bg-right-top": "bg-inline-end-top",
        "bg-right-bottom": "bg-inline-end-bottom"
      }
    },
    {
      "journal": "class-ut1-blur",
      "decision": "C212",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One name per job (C212): blur and backdrop-blur drew the same 4 px as blur-medium and backdrop-blur-medium. They keep drawing until remove_after.",
      "names": {
        "blur": "blur-medium",
        "backdrop-blur": "backdrop-blur-medium"
      }
    },
    {
      "journal": "class-ut1-radius-square",
      "decision": "C212",
      "component": "utility",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One name per job (C212): radius-square and its side forms drew the same 0 as radius-0 (--sf-radius-square is 0). They keep drawing until remove_after.",
      "names": {
        "radius-square": "radius-0",
        "radius-top-square": "radius-top-0",
        "radius-bottom-square": "radius-bottom-0",
        "radius-inline-start-square": "radius-inline-start-0",
        "radius-inline-end-square": "radius-inline-end-0",
        "radius-top-inline-start-square": "radius-top-inline-start-0",
        "radius-top-inline-end-square": "radius-top-inline-end-0",
        "radius-bottom-inline-start-square": "radius-bottom-inline-start-0",
        "radius-bottom-inline-end-square": "radius-bottom-inline-end-0"
      }
    }
  ],
  "extended": {
    "decision": "C187 (2), (3)",
    "note": "Kept, documented together on one «extended» page, not a page per class.",
    "sheets": [
      "width-ext",
      "height-ext",
      "max-width-ext",
      "max-height-ext",
      "flex-basis-ext",
      "element-position-ext"
    ],
    "patterns": [
      {
        "family": "border-width 3-10",
        "pattern": "^border-(?:(?:top|bottom|x|y|inline-start|inline-end)-)?(?:[3-9]|10)$"
      },
      {
        "family": "outline-width 3-4",
        "pattern": "^outline-[34]$"
      },
      {
        "family": "outline-offset 3-4",
        "pattern": "^outline-offset-[34]$"
      },
      {
        "family": "ring-offset-width 3-4",
        "pattern": "^ring-offset-[34]$"
      },
      {
        "family": "divide widths 3-4",
        "pattern": "^divide-[xy]-[34]$"
      },
      {
        "family": "ring-offset-color strong and overlay",
        "pattern": "^ring-offset-[a-z-]+-(?:container-strong|transparent-overlay)$"
      }
    ]
  }
};
