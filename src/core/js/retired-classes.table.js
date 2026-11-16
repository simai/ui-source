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
      "journal": "class-page-number-circle-retired",
      "decision": "C237",
      "component": "pagination",
      "since": "2026-11-16",
      "remove_after": "2027-01-01",
      "note": "One shape for a page number, the square of the button (sf-pagination has no round numbers, and the plain component follows it, C224); the dots and the picture counter belong to sf-gallery and sf-slider (C97 (7)). sf-page-number--circle draws the square until the date.",
      "names": {
        "sf-page-number--circle": "sf-page-number--square"
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
