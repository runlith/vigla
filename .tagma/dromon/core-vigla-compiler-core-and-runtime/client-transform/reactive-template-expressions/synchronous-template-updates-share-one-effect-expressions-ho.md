---
id: 01a18775-90f3-77c6-8c19-9387d8fd28aa
title: Synchronous template updates share one effect; expressions holding a call are memoized as deriveds
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/element.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/template.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/asynchronous.ts
    symbol: asyncSetup
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/async.ts
    symbol: prepareAsync
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/async.ts
    symbol: startAsync
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/hydration.ts
    symbol: overwriting
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: awaitedContent
---
Synchronous reactive text and attribute updates of one template run in a single `content` effect, however many synchronous holes it has. Grouping would rerun every expression when any one dependency changes; values merely re-set are cheap because `text`, `attr` and the other setters compare with what they last wrote, but a call may be expensive or observable — samples count how often a function in the template runs. So each expression containing a call becomes a derived passed to the effect as a parameter and reruns only when its own dependencies change, matching upstream's call counts. Expressions with no reactive reference are set once at creation instead. A spread's attribute object gets an effect of its own, created in place: its setters run before the grouped effect, the order upstream's attribute effects take.

Setters of an attribute, class or style whose own expression awaits form a second effect after the grouped one, `awaitedContent`, and a spread element holding such an expression makes its own effect one. Its first run still hydrates — setters seed their caches from the claimed node, network attributes keep the server's value, input defaults get their cleanup — but under `overwriting` the setters write a value equal to the server's instead of adopting it: an awaited value is applied, as upstream's `async-hydration-attribute-unchanged` pins with its mutation records, while synchronous setters in the same async part keep skipping unchanged values. Turning hydration off instead, which upstream's after-hydration effect amounts to, compares against an empty cache: a value the client resolves to `undefined` then leaves the server's attribute or style in place, and a spread input loses its SSR-default cleanup (own sample `awaited-attribute-hydration`).

Async text parks and claims its hydration range during navigation, but registers its expressions after the fragment's structural initializers, before the grouped content effect. Registering them at the text's DOM position can reverse observable request order relative to a later branch. Awaited declarations and structural expressions retain their initialization order.