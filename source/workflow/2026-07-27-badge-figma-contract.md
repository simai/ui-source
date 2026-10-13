# Badge Figma contract correction

Date: 2026-07-27
Status: implementation_in_progress
Owner repository: `ui-loader`
Branch: `codex/badge-figma-contract-20260727`

## Goal

Align the Core and Smart Badge renderers with the accepted SIMAI Framework
Figma component while preserving the existing CSS token contract.

## Done when

- Core and Smart renderers use `sf-badge--<type>` consistently;
- the exact 42 supported type/scheme/size combinations are machine checked;
- invalid enum values fall back deterministically;
- unsupported `tonal + on-surface` resolves to `main + on-surface`;
- icon containers do not grow with `flex-1`;
- icon-only badges do not render an empty text container;
- source documentation and the public demonstrations describe the same matrix;
- generated `ui` and `ui-smart` outputs are produced only through `ui-builder`;
- the existing LTR/RTL generated candidate is not overwritten.

## Scope

- `src/component/badges`
- `src/smart/badges`
- focused contract tests
- Badge documentation and demonstrations in consumer repositories through
  isolated worktrees

## Non-goals

- no new `inverse` scheme;
- no change to the accepted Badge colors, typography or size tokens;
- no manual editing of generated `ui` or `ui-smart` files;
- no release, tag or production deployment.

## Evidence

- exact Figma node: `10904:58971` in `SF-UI-Kit-v.2.6.0`;
- `npm test` in the source candidate;
- reproducible builder evidence for the generated pair;
- consumer static and browser checks.
