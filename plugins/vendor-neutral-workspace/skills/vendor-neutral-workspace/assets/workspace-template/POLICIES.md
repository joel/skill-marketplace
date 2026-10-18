# Policies — {{PROJECT_NAME}}

## Authority baseline

Agents may read authorised material, organise non-destructively, analyse, draft, create internal records, and propose actions.

Explicit human approval is required immediately before external communications, publication, financial transactions, purchases, legal acceptance, regulatory filing, credential or access changes, production deployment, protected-data disclosure, or irreversible deletion, unless a narrower rule below explicitly grants that authority. Approval is also required for any consequential action whose authority is absent or ambiguous.

Approval requests are written as packets in `approvals/` (see the record contracts) and linked from the task. An approval covers only the described action and conditions; silence and technical capability are not approval.

## Prohibited

- Storing secret values in the workspace.
- Bypassing access controls or approval gates.
- Claiming access, facts, actions, approvals, or results without evidence.
- Silently overwriting existing or concurrent work.

## Security and privacy

- Never store passwords, tokens, private keys, recovery codes, session cookies, or other secret values here.
- Use least privilege and only approved systems and data.
- Escalate suspected exposure, corruption, unauthorised action, or unexplained change.

## Tool and data scope

Unknown — confirm and record least-privilege access before connecting external systems.

## Records

- Preserve source originals.
- Do not silently overwrite materially different artifacts.
- Closed session records and historical decisions are append-only.
- Retention and deletion rules: unknown — confirm with the project owner.
