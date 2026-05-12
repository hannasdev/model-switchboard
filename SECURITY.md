# Security Policy

## Supported Versions

The latest published release receives security updates.

## Secure Development Practices

This project is committed to secure software development. The following practices are implemented:

### Development Knowledge
- Primary developers are expected to apply secure software design practices, including:
  - Secure architecture and threat modeling
  - Input validation and sanitization
  - Authentication and authorization patterns
  - Secure API design principles
  - OWASP Top 10 awareness and mitigation strategies

### Common Vulnerability Awareness
- Project developers are familiar with common vulnerability classes and their mitigations:
  - **Injection attacks**: Validated via input sanitization and parameterized operations
  - **Credential exposure**: Private keys and secrets never committed; use environment variables and git hooks to prevent leaks
  - **Unsafe deserialization**: JSON parsing only; no eval-like operations
  - **Dependency vulnerabilities**: Regular dependency audits via `npm audit` and CI checks
  - **Code execution vulnerabilities**: Strict control over subprocess execution with validated arguments
  - **Path traversal**: Path operations validated and restricted to intended directories

### Security Assurance Measures
- **Automated code analysis**: ESLint with security plugin (`eslint-plugin-security`) checks for common vulnerabilities in CI on pull requests and pushes to `main`
- **Dependency scanning**: `npm audit` integrated into CI pipeline on pull requests and pushes to `main`; Snyk scans run on pushes to `main` and a daily schedule when `SNYK_TOKEN` is configured
- **Test coverage**: Comprehensive test suite validates security-relevant code paths
- **Code review**: All changes reviewed before merge to `main`
- **Git hooks**: When installed, local validation enforces semantic commit messages and helps block direct commits to `main`

## Secrets and Credentials Management Policy

This project manages secrets and credentials using a least-privilege, no-hardcoded-secrets policy.

### Scope

Secrets and credentials include, at minimum:

- CI/CD and automation secrets (for example: `NPM_TOKEN`, `RELEASE_DEPLOY_KEY`, `RELEASE_DEPLOY_KNOWN_HOSTS`, `SNYK_TOKEN`)
- API keys used for local development or integration checks
- Any credential that grants access to source, artifacts, release systems, or security tooling

### Storage Requirements

- Production and CI/CD secrets must be stored in GitHub Actions Secrets (repository or environment secrets), not in source files.
- Local developer secrets must be stored in environment variables or local `.env` files that are excluded from version control.
- Secrets must never be committed to Git history, hard-coded in source code, or included in PR descriptions/issues.
- `.env` and `.env.*` are ignored by Git; `.env.example` must contain placeholders only.

### Access Control Requirements

- Access to secrets is limited to maintainers with a task-based need.
- CI workflows must use least-privilege permissions and only expose required secrets to jobs that need them.
- Secrets inventory and maintainers with sensitive access are tracked in this document under "Project Members with Access to Sensitive Resources".
- When possible, prefer short-lived credentials and OIDC-based federation over long-lived static credentials.

### Rotation and Update Requirements

Secrets and credentials must be rotated or replaced when any of the following occurs:

- A maintainer with access is removed or changes role.
- Suspected or confirmed credential exposure.
- Upstream provider revocation, expiry, or incident response guidance.
- Material pipeline or permission model changes that alter trust boundaries.

Operational rotation process:

1. Create a replacement credential with minimum required scope.
2. Update GitHub Actions Secrets (and environment secrets where used).
3. Revoke or delete the previous credential.
4. Run CI preflight and relevant release/publish checks to verify the new credential.
5. Update this policy and related docs if secret names, ownership, or access boundaries changed.

### Verification and Guardrails

- CI preflight validates required release/publish secrets in a dedicated workflow before release/publish operations.
- Repository policy requires avoiding secret values in logs, comments, and documentation.
- Security issues involving credentials must follow the private disclosure process below.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately by opening a GitHub Security Advisory draft:

- New advisory draft: [Open draft advisory](https://github.com/hannasdev/model-switchboard/security/advisories/new)
- Repository security page: [Security overview](https://github.com/hannasdev/model-switchboard/security)
- Published advisories: [Advisory list](https://github.com/hannasdev/model-switchboard/security/advisories)

1. Go to the repository Security tab.
2. Choose Advisories.
3. Click New draft security advisory.

If you cannot use advisories, contact the maintainer directly through GitHub and avoid posting vulnerability details in public issues.

## Disclosure Process

- We will acknowledge receipt as soon as possible (target: within 14 days of receipt).
- We will investigate and validate the report.
- We will work on a fix and coordinate a responsible disclosure timeline.
- We will publish a security release note after a fix is available.

## Project Members with Access to Sensitive Resources

| Member | Role | Sensitive Access |
|--------|------|-----------------|
| [@hannasdev](https://github.com/hannasdev) | Maintainer | Repository admin, npm publish token (`NPM_TOKEN`), release deploy key (`RELEASE_DEPLOY_KEY`), Snyk token (`SNYK_TOKEN`) |
