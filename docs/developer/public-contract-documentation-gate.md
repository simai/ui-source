# Public contract documentation gate

Every first-party Framework change that adds or changes a public token,
component behavior, authoring contract, compatibility alias or supported state
must update the public documentation in the same owner delivery contour.

The source repository remains authoritative. Public documentation does not
maintain a second handwritten value table.

## Required delivery chain

1. Change the owner JSON/schema or another canonical machine contract.
2. Generate a content-addressed documentation projection from that source.
3. Copy the exact projection into `ui-doc` and update the authored explanation,
   examples, compatibility notes and navigation.
4. Run the source repository freshness check against a detached checkout of the
   exact pinned `ui-doc` revision. The required CI entrypoint is
   `scripts/run-content-spacing-ci-gate.sh`; a mutable branch or neighboring
   worktree is not an acceptance input.
5. Run the `ui-doc` integrity/build checks and preserve the command results in
   the immutable owner packet.
6. Obtain independent owner acceptance before repinning a consumer.

For the content-spacing contract the commands are:

```sh
npm run adaptive-sizing:check
UI_DOC_ROOT=/absolute/path/to/ui-doc npm run test:public-docs

cd /absolute/path/to/ui-doc
npm run docs:integrity
```

The source check compares the projection byte-for-byte and verifies each public
guide table record as one exact tuple: token, semantic role, mobile value and
desktop value. Values found in another row or in prose do not satisfy the
contract. The `ui-doc` check independently applies the same tuple boundary and
fails closed when its projection and visible guide diverge.

The mandatory automation contour is GitHub Actions
(`.github/workflows/validation.yml`). It uses Node 20.19.5, runs the ordinary
Framework test entrypoint, checks out the exact immutable `ui-doc` revision in
detached state, verifies its clean status, and then runs the direct projection
validator. It contains no publish, SSH, release or deploy operation. A pinned
revision is not considered available to hosted CI until it is reachable from
the configured GitHub repository; local repository overrides are evidence for
local reproduction only.

## Boundaries

- Do not edit a generated distribution to document a source change.
- Do not invent a public token or default only in prose.
- Compatibility aliases must be described separately from canonical names.
- Consumer-specific usage guidance may live in the consumer, but the shared
  Framework contract and its general guidance belong in `ui-doc`.
- A missing documentation update is a release blocker for a public contract
  change, not follow-up housekeeping.
