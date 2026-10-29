---
id: 01a18775-90f3-77c6-8c19-9387d8fd28aa
title: A template's reactive updates share one effect; expressions holding a call are memoized as deriveds
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/compiler/client/template.ts
  - kind: file
    ref: packages/dromon/src/compiler/client/element.ts
---
All reactive text and attribute updates of one template run in a single `content` effect, so a template costs one effect however many holes it has. Grouping would rerun every expression when any one dependency changes; values merely re-set are cheap because `text`, `attr` and the other setters compare with what they last wrote, but a call may be expensive or observable — samples count how often a function in the template runs. So each expression containing a call becomes a derived passed to the effect as a parameter and reruns only when its own dependencies change, matching upstream's call counts. Expressions with no reactive reference are set once at creation instead. A spread's attribute object gets an effect of its own, created in place: its setters run before the grouped effect, the order upstream's attribute effects take.