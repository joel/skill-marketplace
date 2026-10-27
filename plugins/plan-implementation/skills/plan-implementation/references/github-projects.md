# GitHub Projects (Kanban) commands

Only applies when the project config names a board. All IDs are project-specific.

## Discover the IDs once

```bash
gh project list --owner <owner>                                   # project number
gh project view <project-number> --owner <owner> --format json | jq -r .id   # project ID (PVT_...)
gh project field-list <project-number> --owner <owner> --format json \
  | jq '.fields[] | select(.name == "Status") | {id, options: [.options[] | {name, id}]}'
```

Record the project ID, the status field ID, and the option ID per status in the
project's workflow doc so future runs do not rediscover them.

## Add an issue (idempotent)

```bash
gh project item-add <project-number> --owner <owner> --url <issue-url> --format json | jq -r .id
```

Capture the item ID from this output. Re-running for an already-added issue returns
the same ID, so this is also the lookup command when the ID is lost. Avoid
`gh project item-list | jq 'select(.content.number == N)'`: its default page misses
freshly added items on a large board and returns nothing for an item that exists.

## Move between statuses

```bash
gh project item-edit \
  --project-id <project-id> \
  --id <ITEM_ID> \
  --field-id <status-field-id> \
  --single-select-option-id <option-id>
```

Typical sequence: Backlog (default on add) → In Progress (Step 3) → In Review
(Step 10) → Done (Step 14). Use the Ready hop only when the issue will sit queued
before someone picks it up.
