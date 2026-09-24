# AGENTS — aiwp

## Roles
- **Owner**: Final approval, release tags, roadmap decisions
- **Maintainer**: PR review, CI green, code quality 0 lint
- **Contributor**: Feature PRs, tests, docs
- **CI**: Automated lint+test+build on every push

## Workflow
1. Branch from main: `feat/<name>` or `fix/<name>`
2. Implement with tests (0 fail required)
3. Run lint + tests locally: see README quickstart
4. Push, ensure CI green (GitHub Actions)
5. PR with description + evidence (command output)
6. Maintainer review, merge to main
7. Release: tag v1.0.0 (public) or v0.9.0 (private) + GitHub Release

## Env
- See `.env.example` for required env vars — never commit .env
- Copy: `cp .env.example .env` then fill values
- Secret scan: `grep -r -E "sk-|ghp_|API_KEY.*=.*[A-Za-z0-9]{20}" --exclude-dir=node_modules --exclude-dir=.git || echo "0 secrets"`

## One-line Run
- See README quickstart for repo-specific run command

## Quality Gates (10/10 rubric)
1. TESTS green 0 fail
2. CI workflow valid (lint+test+build)
3. DOCS README badge+mermaid+quickstart + CHANGELOG + ROADMAP
4. SECURITY secret scan 0 + .env.example complete
5. DOCKER compose healthy with healthcheck
6. CODE QUALITY linter 0 + no deprecated utcnow
7. DEMO quickstart reproducible + sample output
8. RELEASE tag + GitHub Release
9. HANDOFF via AGENTS.md/CONTRIBUTING.md + CHANGELOG
10. HONEST SCOPE v2 explicit

## Constraints
- Visibility: Do not change public/private — 4 public v1.0.0, 7 private v0.9.0 (but all private in current org per user request)
- No force push to main
- No secrets in repo
- Evidence required: command+output for REPORT
