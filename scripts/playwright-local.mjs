// The browser probes import `playwright`, and Node resolves a bare import by
// walking up from the importing file. A worktree under ../.worktrees or
// ../.artifacts holds no node_modules of its own, so the walk used to end in a
// shared ~/node_modules copy that nobody declared -- and when that copy vanished
// every probe failed with ERR_MODULE_NOT_FOUND, which reads exactly like a hundred
// product failures. Playwright is a devDependency of this repository now; this
// makes the probes resolve it from the repository's own node_modules and refuse
// any other copy.
//
// A git worktree without node_modules borrows the main checkout's: the link is
// made only when the worktree has none at all, and the main checkout must hold the
// declared version (`yarn install --frozen-lockfile` there).
//
// Browsers are not downloaded with the package: they live in
// PLAYWRIGHT_BROWSERS_PATH (the release route uses <GitHub>/.playwright-browsers,
// because the shared ~/Library/Caches/ms-playwright is garbage-collected by other
// tools' installs).
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, realpathSync, symlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve, sep} from 'node:path';

const mainCheckout = (root) => {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return common ? dirname(common) : null;
  } catch {
    return null;
  }
};

// Returns {version, path} of the playwright the probes will import, or throws a
// sentence saying what to do.
export const ensureLocalPlaywright = (root) => {
  const declared = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies?.playwright;
  if (!declared) throw new Error('package.json declares no playwright devDependency');
  const modules = join(root, 'node_modules');
  if (!existsSync(modules)) {
    const main = mainCheckout(root);
    if (main && resolve(main) !== resolve(root) && existsSync(join(main, 'node_modules', 'playwright', 'package.json'))) {
      symlinkSync(join(main, 'node_modules'), modules, 'dir');
    }
  }
  if (!existsSync(join(modules, 'playwright', 'package.json'))) {
    throw new Error(`playwright ${declared} is not installed in ${modules}: run \`yarn install --frozen-lockfile\` in this checkout (or in the main checkout a worktree borrows from)`);
  }
  const found = createRequire(join(root, 'package.json')).resolve('playwright/package.json');
  const own = realpathSync(modules) + sep;
  if (!realpathSync(found).startsWith(own)) {
    throw new Error(`playwright resolves to ${found}, outside this repository's node_modules (${own})`);
  }
  const {version} = JSON.parse(readFileSync(found, 'utf8'));
  if (version !== declared) {
    throw new Error(`playwright ${version} is installed, package.json declares ${declared}: run \`yarn install --frozen-lockfile\``);
  }
  return {version, path: dirname(found)};
};
