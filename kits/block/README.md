# SIMAI Framework block author kit

What a developer needs to add a block of their own to the SIMAI Framework's
layout and content editors, in the formats the SIMAI Framework already has:
the Composition type manifest, the editor manifest, a registered renderer and
the structured-content conformance cases. The guide is
[docs/developer/block-author-guide.md](../../docs/developer/block-author-guide.md).

| Path | What it is |
|:---|:---|
| `template/` | the block a developer copies: `product.block-name` |
| `new.mjs` | `node kits/block/new.mjs <product>.<name> <folder>`: the template under the block's name |
| `check.mjs` | `node kits/block/check.mjs <folder> [--framework <dir>] [--json] [--update]`: the conformance check |
| `../../src/core/kits/block/sample-quote/` | `sample.quote`, a block made from the kit alone |
| `../../src/core/kits/block/sample-cards/` | `sample.cards`, a data block: catalogue place, variants, layout parameters as utilities per screen, a named place and a host binding |

`--framework <dir>` names the SIMAI Framework the block is checked against:
its `src/` folder, or a built `distr/` (the folder that holds
`core/js/composition/index.mjs`), not a checkout root. A checkout root is read
as its `src/`; a folder that holds neither is refused
(`block_check_framework_missing`, exit code 2). Without it the check uses
this checkout's `src/`.

The kit stands outside the SIMAI Framework source tree (`src/`): it is not
built into the distribution and moves no unit's version. Its tests are
`tests/block-author-kit.test.mjs`.
