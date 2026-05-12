# Contributing to Model Switchboard

Thank you for your interest in contributing to Model Switchboard! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/model-switchboard.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Install git hooks: `npm run hooks:install`

## Development Workflow

### Before You Start

- Ensure your local git hooks are installed: `npm run hooks:doctor` should return `.githooks`
- Install dev dependencies: `npm ci`

### Making Changes

1. **Write code** following Node.js and JavaScript best practices
2. **Add tests** for new functionality to `test/` directory
3. **Run tests locally**: `npm test`
4. **Lint your code**: `npm run lint` (also runs on CI)
5. **Commit with semantic messages**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)

### Test Policy

This project follows a **test-first policy**:
- **New features** must include corresponding test coverage
- **Bug fixes** should include tests that demonstrate the fix
- **Refactoring** should maintain or improve existing test coverage
- All tests must pass before opening a PR

Tests are automatically verified in CI on every push to `main` and on all pull requests. See [CI-CD.md](docs/CI-CD.md) for details on the automated release process.

### Code Quality

**Static Analysis:**
- ESLint runs automatically on all commits (via git hooks) and in CI
- Security plugin (`eslint-plugin-security`) checks for common vulnerabilities
- Fix linting issues: `npm run lint -- --fix`

**Testing:**
- Unit tests: `npm test`
- Fuzz testing: `npm run test:fuzz`
- Integration testing: `npm run switchboard:continuity` (local validation)

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run full test suite: `npm test`
3. Run linter: `npm run lint`
4. Open a PR with a clear description of changes
5. Reference any related issues
6. Wait for CI to pass (tests, lint, build checks)
7. Address any review feedback

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build, CI, or dependency changes

**Examples:**
```
feat(router): add classifier-based routing decision
fix(cli): handle missing session files gracefully
docs: update installation instructions
test: add edge case coverage for session resumption
```

Commit messages are validated by git hooks locally, and CI will reject non-semantic commits.

## Security

If you discover a security vulnerability, please follow the process in [SECURITY.md](SECURITY.md) rather than opening a public issue.

## Code of Conduct

This project is committed to creating a welcoming environment. Please be respectful and professional in all interactions.

## Questions?

- Check existing [documentation](docs/)
- Review [ARCHITECTURE-SPEC.md](docs/ARCHITECTURE-SPEC.md) for system design
- Look at [decision-log.md](docs/decision-log.md) for design rationale

Thank you for contributing!
