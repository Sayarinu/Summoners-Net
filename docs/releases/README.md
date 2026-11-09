# Branches and releases

SummonersNet is local-first: a release is a Git tag with GitHub release notes. Nothing is deployed,
packaged or uploaded.

## Channels

| Branch         | Publishes                                              | Version        | Tag             |
| -------------- | ------------------------------------------------------ | -------------- | --------------- |
| `experimental` | a GitHub prerelease on every push, never marked Latest | `X.Y.Z-beta.N` | `vX.Y.Z-beta.N` |
| `main`         | the stable release on every push                       | `X.Y.Z`        | `vX.Y.Z`        |

Every change starts from an issue in your tracker, identified by its key (for example `ABC-123`).
Ticket branches are named exactly after that identifier and created from `origin/experimental`, and
commit subjects and PR titles start with it: `ABC-123 - Add player search`. Ticket PRs target
`experimental` and are squash-merged; each merge publishes an experimental build. When experimental
is ready, open a PR from `experimental` into `main` and merge it with a **merge commit** (not squash
or rebase) so both branches keep the same commits. That push publishes the stable release. An urgent
fix may target `main` directly; merge `main` back into `experimental` afterwards.

`.github/workflows/ci.yml` (`pnpm verify` with PostgreSQL, then `pnpm browser:test`) runs on every
PR. `.github/workflows/release.yml` runs the same checks on each push to `main` or `experimental`
and publishes only after they pass.

## Versions

`scripts/release.mjs` finds the newest stable `vX.Y.Z` tag merged into `main` and bumps it by the
largest change merged since:

| Label on a merged PR | Bump                | Example       |
| -------------------- | ------------------- | ------------- |
| none (default)       | small change, patch | 0.1.1 → 0.1.2 |
| **Feature**          | feature, minor      | 0.1.7 → 0.2.0 |
| **Major Release**    | major               | 0.4.2 → 1.0.0 |

An experimental build's `X.Y.Z` is the stable version its changes are heading for: the newest stable
tag, bumped by the largest label among commits on `experimental` but not yet on `main`. `N` counts
that version's builds. SemVer sorts `0.7.0 < 0.7.1-beta.1 < 0.7.1-beta.2 < 0.7.1`.

To jump to a specific version, raise `version` in the root `package.json`; a declared version higher
than the computed one wins. The "Release size" check on every PR shows the bump the merge will
cause. It warns, without blocking, when a title that reads like a feature has no label.

Release notes list the titles of PRs merged since the previous release of that channel: **New** for
Feature and Major Release PRs, **Improvements and fixes** for the rest. Published releases are never
overwritten. Main and experimental releases run one at a time.
