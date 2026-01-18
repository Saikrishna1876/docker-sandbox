# Contributing to Docker Sandbox

Thank you for your interest in contributing! We welcome contributions from everyone.

## Table of Contents
- [Reporting Issues](#reporting-issues)
- [Pull Requests](#pull-requests)
- [Code Style](#code-style)
- [Development Workflow](#development-workflow)

## Reporting Issues

Before opening a new issue, please perform the following checks:

1.  **Search for existing issues:** Is this related to an old or existing issue? Check both open and closed issues to avoid duplicates.
2.  **Is it a good fit for GitHub?** GitHub issues are for bug reports, feature requests, and technical discussions. For general support or "how-to" questions, please check the documentation or use other community channels.
3.  **Provide context:** If you're reporting a bug, include steps to reproduce, expected behavior, and actual behavior. Include your environment details (OS, Node/Bun version, Docker version).

When creating an issue, please use the provided templates if available.

## Pull Requests

We welcome pull requests for bug fixes and new features. To ensure a smooth process:

1.  **Open an issue first:** For significant changes, please open an issue to discuss the proposal before starting work.
2.  **Branch naming:** Use descriptive branch names (e.g., `fix/docker-timeout` or `feat/new-sandbox-option`).
3.  **Keep it focused:** Each PR should address a single concern. Large, sweeping changes are harder to review and more likely to be rejected.
4.  **Tests:** Include tests for any new features or bug fixes. Ensure all existing tests pass.
5.  **Documentation:** Update the `README.md` or other documentation if your changes affect how the project is used.

### Pull Request Checklist
- [ ] Branch is up-to-date with `main`.
- [ ] Tests pass locally.
- [ ] New functionality is covered by tests.
- [ ] Documentation is updated.
- [ ] The PR title and description clearly explain the changes.

## Code Style

- We use TypeScript. Ensure your code is properly typed.
- Follow the existing formatting and naming conventions in the project.
- Use `npm run lint` or `bun run lint` (if available) to check for style issues.

## Development Workflow

1. Fork the repository.
2. Clone your fork locally.
3. Install dependencies: `bun install` or `npm install`.
4. Create a feature branch.
5. Make your changes and add tests.
6. Verify changes: `bun test` or `npm test`.
7. Push to your fork and submit a Pull Request.

---

By contributing, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
