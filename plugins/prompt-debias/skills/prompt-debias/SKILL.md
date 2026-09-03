---
name: prompt-debias
description: >-
  Rewrite a draft prompt before it is sent so the answering model cannot
  silently inherit the asker's frames. Models refute what you assert but
  inherit what you assume: a chosen decomposition, an implied cause, a time
  horizon, a definition of success, an "also consider X" emphasis. This skill
  inventories every frame in the draft, keeps genuine constraints and stated
  expertise, quarantines the rest as hypotheses to test, states the core
  question neutrally, and adds instructions that force competing framings,
  disagreement conditions, and odds-backed conclusions. Returns the rewritten
  prompt in a copy-paste block plus a table of what changed and why. Use when
  the user asks to debias, harden, neutralise, or rewrite a prompt, to stop
  the model being a yes-man, or invokes /prompt-debias with a prompt or file
  path. Do not engage on ordinary requests; only when a prompt is handed over
  for rewriting.
metadata:
  version: "1.0.0"
  inspired-by: "https://techintrospect.substack.com/p/ai-bullshit-fixer-prompt"
---

# Prompt Debias

Take the prompt the user is about to send, find the frames it injects, and rewrite it
so the answering model tests those frames instead of building its answer around them.

**Announce the skill at the start of every run:**

> **USING PROMPT DEBIAS** — inventory → rewrite → what changed

## The problem this solves

Modern models push back on false statements. They do not push back on the *shape* of a
question. A frame is not a proposition, so it never triggers the machinery that checks
propositions. Say "consider whether our slow deploys are why we are losing customers"
and the answer will be organised around deploy speed, whether or not deploy speed
matters. The frame arrived first and the analysis grew around it.

Frames enter at many levels: the choice of question, the decomposition into
sub-questions, the implied causal model, what counts as evidence, the time horizon, the
reference class, the definition of success, and the throwaway "also think about X". Any
of them can be injected by one sentence and inherited by the whole output.

## Two disciplines

**Your own inventory comes first.** The user may tell you where they think the bias is.
Take that seriously, but it is one input among several. Run the full inventory before
reading their suspicion, then address what they flagged, and say explicitly when your
findings diverge from theirs. A debiaser that lets the user choose which bias to find has
fixed nothing.

**Reflexive stripping is also bias.** Not every frame is contamination. Some are right,
often because the user has domain knowledge the model lacks. Judge frames on merit, not
provenance. If a draft has no meaningful frame injection, say so and return it nearly
unchanged. A debiaser that always finds something is uninformative.

## Input

The draft prompt arrives inline, as a pasted block, as the argument to `/prompt-debias`,
or as a file path (read the file). Optionally the user adds a suspicion ("I think the
problem is that I mentioned X"). If no prompt is present, ask for it and stop.

## Method

### 1. Inventory the draft

Read the whole draft. Sort every content item into one of three bins. Only the first
bin gets rewritten.

| Bin | What it is | What happens to it |
|-----|-----------|-------------------|
| **Frames and emphases** | Choice of question, decomposition, implied cause, evidence selection, horizon, reference class, success definition, "also consider X", embedded claims, leading language, presupposed conclusions | Moved out of the question into a labelled hypotheses block |
| **Genuine constraints** | Audience, format, length, deadline, hard requirements, scope exclusions, tools available | Kept verbatim in a constraints block |
| **Stated expertise or evidence** | "I have run this team for five years", "our logs show", a number the user measured | Kept, labelled as the asker's evidence so the model weighs it rather than inherits or discards it |

Use [frame-types.md](references/frame-types.md) as the checklist. For each frame,
note where it appears in the draft and what type it is. This is a suspect list, not a
verdict.

### 2. Address the user's suspicion

If they named a suspected bias, compare it with your inventory. Confirm it, refine it,
or say it is not the main problem and what is. Record the divergence for the output.

### 3. Restate the core question

Write the question the user is actually trying to answer, with no embedded answer, no
presupposed cause, and no chosen decomposition. If the draft contains several
independent questions, restate each. If the draft's question presupposes a conclusion
("give me a migration plan to microservices"), step up one level to the question that
conclusion was answering ("how do we fix slow deploys").

### 4. Rewrite

Fill the skeleton in [prompt-template.md](assets/prompt-template.md):

- **Question**: the neutral restatement from step 3.
- **Constraints**: the second bin, verbatim.
- **Inputs from the asker**: every frame from the first bin, each restated as a
  testable hypothesis (`H1: deploy speed is the main driver of churn`), plus the third
  bin labelled as the asker's evidence.
- **How to work**: instructions that force the model to propose competing framings
  before analysing, weight the asker's inputs as one source among several, name the
  factors the answer actually hinges on, state what would make the asker's framing
  wrong, and verify only load-bearing claims.
- **Output**: best direct answer first, then the claims it rests on as bettable
  propositions with odds, then where it kept or departed from the asker's framing.

Strip leading language while rewriting: "obviously", "clearly", "the key issue is",
rhetorical questions, adjectives that pre-judge, and "confirm that" asks become open
asks. Keep the user's voice and any domain vocabulary.

### 5. Check you did not over-strip

Re-read the rewritten prompt against the draft. Every hard requirement still present?
Every piece of stated evidence still present and labelled? Nothing the user knows
better than the model has been demoted to a mere hypothesis without saying so? If the
inventory found nothing in the first bin, return the draft with at most the output
instructions added, and say why.

### 6. Output

```
## Rewritten prompt
<fenced block, ready to paste into any model>

## What changed
| # | In your draft | Frame type | What I did | Why |
|---|---------------|------------|------------|-----|

## Kept as-is
- <constraints, expertise, evidence>

## Divergence from your suspicion
<only when the user gave one>

Caveat: this reduces frame inheritance; it does not guarantee the answer. If a frame
is genuinely load-bearing, the answer will still hinge on it, and should.
```

The table is half the value. Seeing their own frame injection teaches the user to
write the next prompt without it.

## Edge cases

- **No frames found**: say so in one line, return the draft with the output
  instructions appended, and skip the table.
- **Constraint-only prompt** ("summarise this in five bullets for a non-technical
  reader"): nothing to debias. Return it unchanged.
- **Prompt is a question about facts** ("what year did X happen"): no frame to
  quarantine; at most strip leading language.
- **Several entangled questions**: restate each; keep one hypotheses block; note which
  hypotheses attach to which question.
- **The user's expertise contradicts a frame you would otherwise quarantine**: keep it
  in the evidence bin and say so in the table. Do not silently demote it.
- **The draft is already neutral because the user wrote it with this skill**: say so.
  Do not invent frames to justify the run.

See [worked-example.md](references/worked-example.md) for one full run and one null
run.
