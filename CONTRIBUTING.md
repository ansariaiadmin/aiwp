# Contributing — aiwp

## Quick Start
See README quickstart.

## Development
1. Fork + clone
2. `cp .env.example .env` and fill
3. Install deps (see README)
4. Run tests (see README)
5. Lint: 0 errors required

## PR Guidelines
- Tests must be green (0 fail)
- Linter 0 errors
- Update CHANGELOG.md
- Update ROADMAP.md if v2 scope changes
- Add evidence: command output in PR description

## Code Quality
- No deprecated `datetime.utcnow()` — use `datetime.now(timezone.utc)`
- No TODO without v2 explicit or ticket
- Secret scan 0: no hardcoded keys
- Docker compose must be valid with healthcheck where applicable

## Release
- Maintainer creates tag: `git tag v1.0.0 && git push origin v1.0.0` (public) or v0.9.0 (private)
- GitHub Release with changelog
- Update fleet HANDOFF.md in ~/pub/HANDOFF.md

## Reporting
- For TASK #8 REPORT: include scorecard repo×10, evidence snippets, Release tags list, v2 sections, fleet table
