# Third-party notices

The Apache License 2.0 in this repository (LICENSE, NOTICE) applies to
project-owned SIMAI Framework code. The ordinary Framework runtime and its checked-in assets are project-owned.

The exact, version-pinned notice bundle lives at
`src/core/contracts/third-party-notices.v1.json` and is built into every
distribution as `core/contracts/third-party-notices.v1.json`, so the notices
travel with the files they describe. `scripts/render-third-party-notices.mjs`
renders the human-readable `THIRD-PARTY-NOTICES.md` from it for a repository
root, and `tests/third-party-notices.contract.test.mjs` holds the versions
against `yarn.lock`.

| Component | Use | License |
| --- | --- | --- |
| Lit 3.3.3 (with lit-html 3.3.3, lit-element 4.2.2, @lit/reactive-element 2.1.2) | Smart components | BSD-3-Clause |
| @floating-ui/dom 1.8.0 (with @floating-ui/core 1.8.0 and @floating-ui/utils 0.2.12) | Core anchored positioning (`SF.Position`) | MIT |
| @material-symbols/font-400 0.47.0 | Icon faces of the icons component | Apache-2.0 |
| flag-icons 7.5.0 | 37 flags the Figma set did not cover | MIT |
| Inter (src/core/fonts/inter, with its OFL.txt) | The Framework's text face | OFL-1.1 |
| @material/material-color-utilities 0.4.0 (eight HCT files under src/core/js/vendor/material-color-utilities) | A theme made from one colour (`sf-theme-generator`, core/js/theme-palette.js) | Apache-2.0 |

## Font Awesome

Font Awesome Pro 5.15.3 was carried by `src/component/icon` and published with
every build of the generated distribution, which is a public repository. Its
licence is commercial and does not allow the files to be redistributed. The
component was removed on 2026-10-02; nothing used it, it was absent from the
component manifest and the loader had no rule for it. Files already pushed
remain in the history of the generated repository.

## Historical releases

Framework 4 vendor sources are not included in this repository. Existing
immutable release archives retain the notices that shipped with those versions.
