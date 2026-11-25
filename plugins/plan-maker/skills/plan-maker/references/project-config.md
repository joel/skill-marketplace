# Project configuration

plan-maker is generic. Repository-specific values live in the project's workflow doc
(`AGENTS.md` or `CLAUDE.md`), which plan-maker reads first and which overrides
anything here. It shares plan-implementation's configuration block ("Execution plan
configuration"): Repository, Labels, Kanban, Branch prefixes, CI path-ignores and
Merge policy are read from there. A "Plan maker configuration" block adds the
values below; every one has a default, so neither block is required.

| Key | Used in | Default |
|-----|---------|---------|
| Plans directory | Sections 4, 6 | `docs/plans/` |
| Plan branch | Section 6 | `docs/plans-<issue>-<slug>` |
| Issue types or labels per outcome | Section 4 | the repository's issue types, else its labels |
| Assignee, milestone and iteration | Section 2 | asked every run; milestone and iteration skipped when the project uses neither |
| Risk signals | Sections 2, 3 | the list in `levels.md`; a project may add paths or areas |
| Docs-only pull request convention | Section 6 | ordinary review; the project's own rule for docs PRs that run no checks |
| Merge policy (shared) | Section 6 | `human`: stop at PR-ready |

## Template block for a project's AGENTS.md

```markdown
## Plan maker configuration

- Plans directory: docs/plans/
- Plan branch: docs/plans-<issue>-<slug>
- Issue types: Bug for defects, Task for technical work, Feature for user-facing outcomes
- Planning fields: assignee; milestone <used | not used>; iteration <field name | not used>
- Risk signals, in addition to levels.md: <paths or areas, for example src/billing/>
- Docs-only pull requests: <ordinary review | admin merge when no checks run>
```

## Precedence

1. Explicit instruction from the user in this session.
2. The project's workflow doc.
3. This skill's defaults.

When the project doc and this skill disagree, the project doc wins; say so in one
line rather than silently diverge.
