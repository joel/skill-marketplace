---
name: skill-name
description: >-
  What this skill does, in one or two sentences. Then the trigger phrases the
  agent should react to, e.g. "do X", "set up Y", "review Z". Then the scope
  guard: name the repository, directory, or context it applies to, and tell the
  agent to stay silent everywhere else (user-scope plugins are active in every
  repo you open).
---

# Skill Name

One paragraph on the outcome this skill produces and when it is engaged.

**Announce the skill at the start of every run** so it is visible that it is
engaged, e.g.:

> **USING SKILL NAME** — short summary of what is about to happen

## Scope guard

Engage only when: <condition, e.g. the working directory is a checkout of
`owner/repo`, or a `foo.config.js` exists at the repo root>. Otherwise do
nothing and do not mention this skill.

## Workflow

1. Step one.
2. Step two.
3. Step three.

## Rules

- Rule the agent must follow.
- Another rule.

## References

- Link to any doc, ticket, or page that gives the human-facing context.
