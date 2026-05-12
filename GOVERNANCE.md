# Governance

This document describes the roles, responsibilities, and decision-making process for the Model Switchboard project.

## Roles

### Maintainers

Maintainers are responsible for the overall direction and health of the project.

**Current maintainers:** [@hannasdev](https://github.com/hannasdev)

**Responsibilities:**

- Setting project direction and priorities.
- Reviewing and merging pull requests.
- Cutting releases and publishing to npm.
- Managing sensitive CI/CD credentials and repository secrets.
- Responding to security vulnerability reports (see [SECURITY.md](SECURITY.md)).
- Maintaining CI/CD pipelines and repository configuration.
- Enforcing the contribution guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).

### Contributor

A contributor is anyone who submits a pull request, opens an issue, or otherwise participates in the project.

**Responsibilities:**

- Following the contribution guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).
- Writing tests for new features and bug fixes.
- Using conventional commit messages.
- Reporting security issues privately via the process in [SECURITY.md](SECURITY.md) rather than opening public issues.

## Decision Making

Maintainers have final decision-making authority over the project, including architecture, releases, and acceptance of contributions. For significant changes, maintainers may seek input through GitHub issues or PR discussion before deciding. When there are multiple maintainers, decisions are made by consensus; unresolved disagreements are escalated to the senior maintainer.

## Adding New Maintainers

New maintainers may be added at the discretion of the current maintainer. When a new maintainer is added:

1. They are granted the appropriate repository role on GitHub.
2. They are added to the sensitive resources table in [SECURITY.md](SECURITY.md).
3. This file is updated to reflect the new maintainer.
4. The `.github/CODEOWNERS` file is updated accordingly.
