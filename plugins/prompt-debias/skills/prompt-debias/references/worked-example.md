# Worked examples

## Example 1: a full run

### The draft

> Our small team of six is losing customers because deploys take forty minutes and we
> can only ship twice a week. We should break the Rails monolith into microservices so
> each team can deploy independently. Give me a 6-month migration plan. Keep it under
> two pages, it is for the CTO. Also think about how Kubernetes fits in.

### Inventory

| # | In the draft | Bin | Type |
|---|--------------|-----|------|
| 1 | "losing customers because deploys take forty minutes" | Frame | Implied causal model |
| 2 | "we should break the monolith into microservices" | Frame | Presupposed conclusion |
| 3 | "give me a 6-month migration plan" | Frame | Choice of question (asks for the plan, not whether) |
| 4 | "so each team can deploy independently" | Frame | Decomposition (team-per-service is assumed) |
| 5 | "also think about how Kubernetes fits in" | Frame | Emphasis |
| 6 | "6-month" | Frame unless it is a real deadline | Time horizon |
| 7 | "small team of six", "deploys take forty minutes", "ship twice a week" | Evidence | Measured facts |
| 8 | "under two pages", "for the CTO" | Constraint | Format, audience |
| 9 | "Rails monolith" | Evidence | Current state |

### Rewritten prompt

```
## Question
We are losing customers. How should we change how we build and ship software to
address that, given our current setup?

## Constraints (hard requirements)
- Audience: the CTO.
- Length: under two pages.

## Inputs from the asker — treat as hypotheses to test, not as the structure of the answer
- H1: deploy time (forty minutes) and cadence (twice a week) are a material cause of
  the customer loss.
- H2: splitting the monolith into microservices is the right fix.
- H3: independent deploys per team is the mechanism by which the fix would work.
- H4: six months is the right horizon for whatever change is chosen.
- H5: Kubernetes is a material part of the answer.
- Asker's evidence: team of six engineers; Rails monolith; deploys take forty
  minutes; two deploys per week; customer loss is observed.

## How to work
1. Before analysing, propose two or three framings of the question that differ from
   H1–H5 (for example: the customer loss has a cause unrelated to deploys; the deploy
   problem is fixable inside the monolith; the team size makes service ownership
   impossible). Pick the one that best fits the evidence and say why. It is allowed
   to be mine; if mine survives, say it survived and why.
2. Weight my inputs as one source among several. Do not organise the analysis around
   them.
3. Name the one to three factors the answer actually hinges on. If one of them is a
   hypothesis I supplied, say so and test it rather than assume it.
4. State what would have to be true for my framing to be wrong.
5. Verify a claim only where being wrong about it would flip the conclusion.

## Output
- Best direct answer first, including a plan if a plan is the answer. No hedging
  theatre.
- Then the two to four claims it rests on, each as a bettable proposition with the
  odds you would accept with your own money at stake.
- Then where you departed from my framing and why, or that you kept it and why.
```

### What changed

| # | In your draft | Frame type | What I did | Why |
|---|---------------|------------|------------|-----|
| 1 | "losing customers because deploys take forty minutes" | Implied cause | Split into an observation (customers lost) and H1 | The model would otherwise analyse deploy speed only and never ask whether it is the cause |
| 2 | "we should break the monolith into microservices" | Presupposed conclusion | Became H2; the question moved up to "how should we change how we ship" | A migration plan answers "how", not "whether" |
| 3 | "give me a 6-month migration plan" | Choice of question | Plan kept as an allowed output, not the question | Same |
| 4 | "so each team can deploy independently" | Decomposition | Became H3 | A six-person team may not have "teams" to own services |
| 5 | "also think about Kubernetes" | Emphasis | Became H5, weighted as one input | An "also consider" routinely becomes the spine of the answer |
| 6 | "6-month" | Time horizon | Became H4 | No deadline was stated; if there is one, it belongs in constraints |

### Kept as-is

- Audience (CTO) and length (two pages) as constraints.
- Team size, stack, deploy time, cadence, and the observed customer loss as evidence.

Caveat: this reduces frame inheritance; it does not guarantee the answer. If deploy
speed really is the cause, the answer will still hinge on it, and should.

## Example 2: a null run

### The draft

> Summarise the attached incident report in five bullets for a non-technical
> executive. Do not include names.

### Result

No frame injection found. Every item is a constraint (format, length, audience,
exclusion) or the task itself. Returned unchanged with no hypotheses block.

## Example 3: the user names a suspected bias

Same draft as Example 1, plus: "I think the bias is that I mentioned Kubernetes."

The inventory still runs first. Kubernetes is one frame (H5), and a minor one. The
larger injections are the presupposed conclusion (microservices) and the implied cause
(deploys drive churn). The output's divergence section says so:

> Your suspicion is partly right: the Kubernetes mention would have pulled the answer
> toward infrastructure. But it is the smallest of the injected frames. The two that
> would shape the whole answer are the assumption that deploy speed causes the churn,
> and that microservices is the fix. Both are now hypotheses.
