---
id: 01a193b7-44fd-7c50-a6db-7c8961dd69b6
title: Legacy mode as an opt-in layer of `@vigla/svelte` after the first milestone
ord: 4
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e6011655b8
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a187b8-c48a-789f-9abb-a30452a01275
---
**Question.** Should `@vigla/svelte` compile Svelte 4 syntax (legacy mode) after the first milestone, so apps not yet migrated to runes switch to Vigla too?

**Decided for now.** Not in the first milestone: legacy syntax stays a compile error, and Kit's test apps are converted to runes. Upstream's `runtime-legacy` suite holds 1209 samples against runtime-runes' 1098, so taking it now would roughly double the runtime work and delay Kit (an estimate, not measured).

**Why later costs no more.** The parser already answers legacy syntax in upstream's AST; the front end rejects it instead of lowering it. Most of legacy mode is compiler sugar over primitives Vigla has: `export let` → props, `$:` → pre effects ordered at compile time, `<slot>` → snippets, `on:` → listeners and callback props, `new Component({ target })` → a wrapper over `mount`. Legacy and runes components meet only at the props boundary, so mixed apps work per component. As an opt-in layer, runes-only apps would not ship it.

**The one non-additive part.** A legacy mutation (`obj.x = 1`, `arr.push(4)`) must notify readers while the variable still holds the same object. The scheduler skips a write whose value is `Object.is`-equal on the write path and in held and fork batches (`batch.ts`, `held.ts`). Legacy mode needs a write that notifies without a value change, inside the scheduler's hottest path and its held-batch invariants; reworking the write path should keep room for it.

**What would inform the choice.** Demand from apps still on Svelte 4 syntax, and the cost of the notifying write once the write path is settled.
