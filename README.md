# SIMAI Framework source

`ui-source` is the editable source repository for SIMAI Framework. It owns Core,
the Loader, utilities, components, Smart Components, their contracts, and source
tests.

Most projects should install a fixed release from [`simai/ui`](https://github.com/simai/ui),
which carries Core, rules, components, utilities and Smart Components
(`distr/smart`). [`simai/ui-smart`](https://github.com/simai/ui-smart) was a
byte-identical mirror of `distr/smart` while consumers moved; it is archived,
read-only, with its history kept. `simai/ui` holds generated output and is not
edited directly.

Documentation (Russian): https://ui.simai.io/

The Framework is extended through component packages: a component lives with
its owner. The SIMAI Framework Pro components (`sf-view-table`, `sf-view`,
`sf-view-properties`, `sf-admin-menu` and the rest) are the package `pro` (until
2027-01-01 also loadable under its former name `larena`), built from the
component folder of `simai/ui-pro` against a pinned revision of this
repository and published as releases of `simai/ui-pro`; see
[docs/developer/component-packages.md](docs/developer/component-packages.md)
and the standard `simai.component-package`.

## Repository roles

- `simai/ui-source` — editable Framework source;
- `simai/ui-builder` — deterministic build system;
- `simai/ui` — generated Framework distribution (Core, utilities, components, Smart Components);
- `simai/ui-smart` — archived: it mirrored `ui/distr/smart` while consumers moved;
- `simai/ui-pro` — the SIMAI Framework Pro components, the component package `pro` (Larena is one of its consumers); `simai/ui-source-pro` and `simai/ui-pro-history` are archived;
- `simai/ui-doc` — public documentation.

The Loader is one module inside this repository. The previous repository name
`simai/ui-loader` is retained by GitHub redirects for compatibility.

## Local checks

Use the Node.js version accepted by the current build contract, install the
locked dependencies, and run:

```bash
yarn install --frozen-lockfile
yarn test:unit
```

### Browser probes

The probes in `tests/browser/` drive Chromium through `playwright`, a pinned
devDependency. They resolve it from this repository's own `node_modules` and
nowhere else: `scripts/run-browser-probes.mjs` stops before the first probe when
playwright is missing, resolves outside the repository or differs from the
declared version. A git worktree without `node_modules` borrows the main
checkout's through a symlink, so install there first.

#### Working in a git worktree

Each worktree needs the declared playwright before its first probe or
first-paint run, in one of two ways:

- Borrow (no install): keep the main checkout at a `main` that declares
  playwright and run `yarn install --frozen-lockfile` there once. A worktree
  with no `node_modules` of its own then links the main checkout's on its first
  probe run. The link is made only when the main checkout holds exactly the
  declared version; a main checkout from before the devDependency (or behind a
  version bump) has none to lend, and the run stops with what to do.
- Install (about a second from the yarn cache, about 70 MB):

  ```bash
  yarn install --frozen-lockfile --prefer-offline --ignore-scripts
  ```

  `--ignore-scripts` is safe here: no dependency needs an install script for
  the checks, and playwright downloads no browser anyway. The folder goes with
  the worktree when it is removed.

Do not run `yarn install` in a worktree whose `node_modules` is a borrowed
link: it would rewrite the main checkout's `node_modules` to the worktree's
lockfile. Remove the link first (`rm node_modules`, a symlink, not the folder
it points to), then install.

Installing the package downloads no browser. Point `PLAYWRIGHT_BROWSERS_PATH`
at a folder holding the build the pinned version wants (the release route uses
`<GitHub>/.playwright-browsers`, because the shared
`~/Library/Caches/ms-playwright` is pruned by other tools' installs), and add a
missing build there with:

```bash
PLAYWRIGHT_BROWSERS_PATH=<folder> node node_modules/playwright/cli.js install chromium-headless-shell
```

Then run every probe against a build output:

```bash
PLAYWRIGHT_BROWSERS_PATH=<folder> node scripts/run-browser-probes.mjs <build output root>
```

Build release artifacts through `simai/ui-builder`; do not commit generated
`ui` output here.

## License

Project-owned SIMAI Framework source is available under the
[Apache License 2.0](LICENSE); see also [NOTICE](NOTICE). Code published before
the change was released under the MIT License, and copies taken under it keep
those terms. Bundled third-party code and fonts remain under their original
licences; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Smart component terminology

[Composite Smart Component / составной смарт-компонент](docs/developer/smart-component-terminology.md) describes components that coordinate their children. Public identifiers and schemas are unchanged.
