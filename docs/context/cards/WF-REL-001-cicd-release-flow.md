# WF-REL-001 — CI/CD and Release Flow

## Type

workflow-context

## Priority

high

## Applies when

* creating commits
* opening PRs
* changing `.github/workflows/**`
* changing `.release-it.json`
* changing `package.json`
* changing release, versioning, changelog, npm, or publishing behavior
* diagnosing CI/CD or npm publish failures
* preparing release-related documentation

## Relevant paths

* `.github/workflows/ci.yml`
* `.github/workflows/preflight.yml`
* `.github/workflows/release.yml`
* `.github/workflows/publish.yml`
* `.release-it.json`
* `.githooks/**`
* `package.json`
* `CHANGELOG.md`

## Summary

This repository uses a three-stage release flow:

1. Feature branches open PRs into `main`.
2. Merges to `main` create an automated version, tag, and GitHub release.
3. Pushed `v*.*.*` tags publish the package to npm.

A preflight workflow validates required CI/CD secrets before release and publish steps fail later.

## Branch and PR model

* Branch from `main` using `feature/<name>`.
* Open PRs into `main`.
* CI runs on PRs and pushes to `main`.

## Release behavior

On every merge to `main`, release automation:

* computes a semver bump from commits since the last tag
* updates version and changelog
* commits release changes
* tags `vX.Y.Z`
* creates GitHub release notes

Semver rules:

* `BREAKING CHANGE` or `!:` → major
* `feat:` → minor
* everything else → patch

## Publish behavior

Any pushed tag matching `v*.*.*` triggers npm publish with provenance.

## Required secrets

* `RELEASE_DEPLOY_KEY`
* `RELEASE_DEPLOY_KNOWN_HOSTS` optional
* `NPM_TOKEN`

## Required repository settings

* Deploy-key actor must be allowed to bypass branch protections for automated release commits/tags.
* `npm` Actions environment is optional but recommended.

## Local guardrails

Git hooks live under `.githooks`.

* `commit-msg` enforces semantic commit format.
* `pre-commit` blocks direct commits to `main`.

Install once per clone:

```bash
npm run hooks:install
```

Verify hook path:

```bash
npm run hooks:doctor
```

## Stop and ask if

* changing release semantics
* changing semver bump behavior
* changing npm publish behavior
* changing required secrets
* bypassing CI/CD guardrails
* committing directly to `main`
* adding a new release workflow
* changing branch protection assumptions

## Enforcement

* GitHub Actions
* release-it config
* git hooks
* branch protection settings
* npm provenance publishing
