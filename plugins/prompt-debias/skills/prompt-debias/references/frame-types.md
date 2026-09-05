# Frame types: how they show up, and the rewrite move

Checklist for the inventory step. For each type: how it appears in a draft, what the
answering model does with it if left alone, and how to rewrite it. The before/after
lines are minimal; the [worked example](worked-example.md) shows a full prompt.

| Type | How it shows up | What the model inherits | Rewrite move |
|------|----------------|-------------------------|--------------|
| **Choice of question** | The asker asks a narrower or adjacent question instead of the one they care about | Answers the narrow question well, never surfaces the real one | Step up one level: state the goal, put the narrow question in the hypotheses block as "H: the goal is best served by answering Q" |
| **Presupposed conclusion** | "Give me a plan to do X" where X is itself the decision | Executes X; never asks whether X | Restate as the question X was answering; X becomes "H: X is the right approach" |
| **Decomposition** | "Break it into cost, speed, and risk" | Analyses only those three axes; misses the fourth | Move the axes into the hypotheses block; ask the model to propose its own decomposition first |
| **Implied causal model** | "Since our slow deploys are hurting retention" | Treats the cause as given; analyses effects only | "H: slow deploys are a material cause of the retention drop"; ask for competing causes |
| **Evidence selection** | "Based on the survey results" when other evidence exists | Weighs only the named evidence | Label the named evidence as the asker's input; ask what other evidence would bear on the question |
| **Time horizon** | "over the next 12 months" chosen without reason | Optimises for that window; ignores what the window hides | Keep it as a constraint only if it is a real deadline; otherwise "H: 12 months is the right horizon" and ask what changes at other horizons |
| **Reference class** | "like other SaaS startups" | Compares to that class only | "H: the right comparison class is SaaS startups"; ask the model to name the class it would choose and why |
| **Definition of success** | "success means hitting 10k MAU" | Optimises for that metric; never questions it | Keep if the user owns the metric; otherwise "H: MAU is the right success measure" |
| **Emphasis** | "also think about X", "make sure to consider Y" | X becomes the organising principle of the answer | "H: X is a material factor"; instruct the model to weight it as one input among several |
| **Embedded factual claim** | "our churn is 8%" stated in passing | Accepts it as true and builds on it | Keep as asker's evidence; instruct the model to verify only if the conclusion flips when it is wrong |
| **Leading language** | "obviously", "clearly", "the real issue is", "surely" | Reads the adjective as a conclusion already reached | Delete the adverb; keep the claim as a hypothesis |
| **Confirmation ask** | "confirm that our approach is sound", "sanity-check my plan" | Confirms | "Evaluate the approach; state the strongest case against it before the case for it" |
| **False dichotomy** | "should we do A or B" | Picks one of two; never proposes C | "H: the realistic options are A and B"; ask the model to add options before choosing |
| **Scope exclusion that hides the question** | "ignore pricing for now" when pricing is the answer | Obeys | Keep as a constraint but ask the model to say in one line if the excluded area is where the answer lives |
| **Requested format that presupposes the answer** | "five slides showing why we should expand" | Produces five slides for expansion | Keep the format; change the content ask to "whether", and require the strongest opposing slide |
| **Tone request that suppresses disagreement** | "be encouraging", "keep it positive" | Softens or omits the negative finding | Keep tone as a constraint on delivery, add: "tone must not remove any finding" |

## Things that look like frames but are not

- **Real deadlines, audiences, formats, length limits, available tools**: constraints.
  Keep verbatim.
- **Measured numbers and first-hand observations**: evidence. Keep, labelled.
- **Stated domain expertise**: evidence about the asker's reliability. Keep, labelled.
- **Explicit scope decisions the user has already made and owns** ("we are not
  hiring this year"): constraints. Keep; the model may note the cost of the constraint
  in one line but must respect it.

When a frame and a constraint are tangled ("we need microservices by Q3"), split them:
"by Q3" is a constraint, "microservices" is a hypothesis.
