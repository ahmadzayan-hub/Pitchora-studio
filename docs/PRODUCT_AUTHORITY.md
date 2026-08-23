# Product Authority — Pitchora

## Primary User

The person who has to stand in front of a board, a committee or a client
and defend what is on the slide.

## Job To Be Done

Turn a rough idea, a document or a dataset into a **boardroom-ready,
evidence-backed, on-brand deck** — and be able to show where every claim
came from when someone in the room asks.

## System of Record

Presentation narrative, storyboard, slides, speaker notes, brand kit,
review and approval state, and the exported PPTX.

## System of Intelligence

Narrative construction from source material, slide composition, evidence
linkage, brand-conformance checking, and readiness scoring of the deck.

## Primary Workflow

```
Start from idea · document · data · existing PPTX · URL
  → Storyboard: Context, Problem, Why now, Evidence, Options,
    Recommendation, Decision
  → Every factual claim linked to its source
  → Brand kit applied
  → Review and approval
  → Editable PPTX out
```

## Human Decision Boundary

- Pitchora composes; the presenter decides what to say.
- A factual claim on a slide must be able to show its source. A claim
  with no source is marked as unsupported, not quietly presented as
  fact.
- Charts and tables stay editable. A chart pasted as a screenshot cannot
  be checked, so it is not an acceptable output.
- Pitchora does not mint evidence. It references evidence produced by
  Mutabasir by `evidence_id`, or clearly marks a claim as unsourced.

## Measurable Outcome

**North star:** board-ready cited decks produced with minimal manual
fixing.

Supporting: share of claims with a source, brand-conformance pass rate,
time from source material to approved deck, edits required after export.

## Explicit Non-Goals

- Not a document-understanding product → **Mutabasir**
- Not a contract-compliance product → **VERTEX**
- Not a prompt-management product → **PromptOps**
- Not a learning platform → **Maktab**
- Not a general design tool

## External Systems

- **Mutabasir** — evidence objects referenced by id
- **VERTEX** and **Annual Plan** — results a deck may present
- PowerPoint / Office as the export target
- **AI Assurance Lab (44)** — evaluates model-backed composition

## Data Ownership

Pitchora owns its decks, storyboards and brand kits. Evidence stays owned
by its producer and is referenced by id, never copied and edited. Other
products receive decks and their metadata through APIs, not by reading
these tables.

## Known boundary debt

This repository currently also contains a full copy of **Maktab's**
application routes and the **ZAIan Studio** desktop, extension and mobile
clients, inherited from the original monorepo. They are not Pitchora's
authority and are duplicated in `maktab` and `promptops` respectively.
Resolving that split is tracked separately; nothing new should be built
on top of those directories here.
