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
- **Dependency scanning**: `npm audit` integrated into CI pipeline on pull requests and pushes to `main`; Snyk scans run on pushes to `main` and a daily schedule
- **Test coverage**: Comprehensive test suite validates security-relevant code paths
- **Code review**: All changes reviewed before merge to `main`
- **Git hooks**: When installed, local validation enforces semantic commit messages and helps block direct commits to `main`

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
