# Project configuration contract

This skill is generic. Everything stack-specific or repo-specific lives in the
project's own workflow doc (`AGENTS.md` or `CLAUDE.md`), which the skill reads first
and which overrides anything here. If the project has no such block yet, propose the
template below in the first run and fill it from what you discover; mark unknowns as
`unknown` rather than guessing.

## What the project doc supplies

| Key | Used in | Example |
|-----|---------|---------|
| Repository | Steps 1, 9, 11 | `acme/widgets` |
| Issue labels | Step 1 | `bug`, `enhancement`, `cleanup`, `documentation` |
| Kanban board | Steps 2, 3, 10, 14 | project number, project ID, status field ID, option IDs per status |
| Branch prefixes | Step 4 | `feature/`, `fix/`, `docs/`, `refactor/` |
| Conventions doc | Step 5 | where real-time updates, boundaries, naming rules live |
| Module boundary and type gates | Steps 5, 6 | commands that are merge-blocking but not run by the default test task |
| Seed task and reset command | Step 5b | `bin/rails db:seed`, `bin/reset` |
| Security-review triggers | Step 5d | paths that count as auth, authz, tenancy, uploads, external calls |
| Security model or review rubric doc | Step 5d | `doc/project/security-model.md` |
| Lint, test, system-test commands | Step 6 | `make check`, `bundle exec rake`, `npm test` |
| Tests that only run in CI | Step 6 | browser-driven specs without a local driver |
| Pre-commit hook framework and skip syntax | Step 7 | overcommit `SKIP=<hook>`, lefthook `LEFTHOOK_EXCLUDE`, pre-commit `SKIP=` |
| `[skip ci]` policy | Step 7 | forbidden when squash merge + deploy reads markers; unnecessary when CI path-ignores docs |
| Run, rebuild, and asset commands | Step 8 | `bin/cli app restart`, `docker compose up`, `npm run dev` |
| Dev login recipe | Step 8 | demo account, magic-link mint, seeded password |
| Live-verification skill or tool | Step 8 | `/product-review`, `/verify`, an agent browser, a browser MCP |
| Docs to keep in sync | Step 8b | architecture doc, setup recipe, design-system doc, diagrams directory |
| CI path-ignore rules | Steps 8b, 10b | `**/*.md`, `doc/**`, `.claude/**` |
| Automated reviewer bot | Step 10b | login name, trigger comment, clean-verdict text |
| Merge policy | Step 12 | `agent` or `human` |
| Release policy | Step 13 | tag format, changelog file, who cuts releases |
| Audit log | Steps 1–15 | path pattern for the per-effort log, or none |

## Template block for a project's AGENTS.md

```markdown
## Execution plan configuration

- Repository: <owner>/<repo>
- Labels: bug, enhancement, cleanup, documentation
- Kanban: project <number>, project ID <PVT_...>, status field <PVTSSF_...>
  - Backlog <id> · Ready <id> · In progress <id> · In review <id> · Done <id>
- Branch prefixes: feature/, fix/, docs/, refactor/
- Validate: `<lint command>` · `<test command>` · `<system test command>`
- Extra merge-blocking gates: `<boundary check>` · `<type check>`
- CI-only tests: <pattern>, treat local driver errors as environmental
- Hooks: <framework>; skip one hook with `<syntax>`; never disable the framework
- `[skip ci]`: <never | unnecessary | allowed for docs>
- Seeds: `<seed command>`; reset with `<reset command>`
- Run app: `<start>` · rebuild `<rebuild>` · assets `<asset build>`
- Dev login: <recipe or pointer>
- Live verification: <skill or tool>
- Security review mandatory for: <paths>; threat model doc: <path>
- Docs to sync: <architecture doc>, <setup recipe>, <design-system doc>, <diagrams>
- CI path-ignores: <globs>
- Automated reviewer: <bot login>; trigger `<comment>`; clean verdict text "<...>"
- Merge policy: <agent | human>
- Releases: <none | tag format, changelog path, policy>
- Audit log: <none | path pattern>
```

## Precedence

1. Explicit instruction from the user in this session.
2. The project's workflow doc block above.
3. This skill's defaults.

When the project doc and this skill disagree, the project doc wins, and the skill
should say so in one line rather than silently diverge.
