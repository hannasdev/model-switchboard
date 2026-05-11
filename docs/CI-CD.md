# CI/CD and Release Flow

This repository now uses a three-stage flow:

1. Feature branches open PRs into main.
2. Merges to main create an automated version/tag/GitHub release.
3. Pushed tags publish the package to npm.

A preflight workflow also runs on `main` pushes (and manual dispatch) to validate required CI/CD secrets before release and publish steps fail later.

## Branch and PR Model

- Branch from `main` using `feature/<name>`.
- Open a PR to `main`.
- CI runs tests on PRs and on pushes to `main`.

Workflow: [ci.yml](../.github/workflows/ci.yml)

## Automated Releases

On every merge to `main`, release automation:

- Computes semver bump from commits since last tag.
- Updates version and changelog.
- Commits release changes.
- Tags `vX.Y.Z`.
- Creates GitHub release notes.

Workflow: [release.yml](../.github/workflows/release.yml)
Config: [.release-it.json](../.release-it.json)

Semver rules:

- `BREAKING CHANGE` or `!:` -> major
- `feat:` -> minor
- everything else -> patch

## npm Publish on Tags

Any pushed tag matching `v*.*.*` triggers npm publish with provenance.

Workflow: [publish.yml](../.github/workflows/publish.yml)

## Preflight Checks

Workflow: [preflight.yml](../.github/workflows/preflight.yml)

Preflight validates:

- `RELEASE_DEPLOY_KEY`
- `NPM_TOKEN`

## Required GitHub Secrets

Set these repository secrets before enabling releases:

- `RELEASE_DEPLOY_KEY`: private SSH key for a write-enabled deploy key.
- `RELEASE_DEPLOY_KNOWN_HOSTS` (optional): strict known hosts entries.
- `NPM_TOKEN`: npm automation token for publish.

## Required Repository Settings

- Allow the deploy-key actor to bypass branch protections for automated release commits/tags.
- Create an `npm` environment in Actions for deployment visibility (optional but recommended).

## Release Runbook

For each release:

1. Merge a PR into `main` with conventional commit text (`feat:`, `fix:`, or `!`/`BREAKING CHANGE`).
2. Release workflow creates a `Release x.y.z` commit and `vX.Y.Z` tag.
3. Publish workflow runs on the new tag and publishes to npm.

## Local Hook Guardrails

To reduce accidental non-semantic commit messages locally, this repo includes git hooks under `.githooks`:

- `commit-msg` enforces semantic commit format (`type(scope): subject`).
- `pre-commit` blocks direct commits to `main` and reminds that semantic validation runs at commit message time.

Install once per clone:

```bash
npm run hooks:install
```

Verify current hook path:

```bash
npm run hooks:doctor
```
