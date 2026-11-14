---
id: 01a1d810-371d-778f-9b2c-36dbd78e5d31
title: "`watch` answers a change of one named source, and its handler subscribes to nothing"
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19e73-9448-7fa1-ba9a-8d536077256f
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/public.ts
    symbol: watch
---
`watch(source, changed, options?)` is for an act that answers one named change — a request, a navigation, a hold, a focus — where an effect would have to list its dependencies by reading them and wrap the rest of its body in `untrack`. The source is the whole dependency list: the handler runs untracked, so nothing it reads or calls can subscribe it, and it may write what it reads without rerunning itself. A value computed from other values stays a derived; a watch that copies state into state is the loop an effect writing state is, with better syntax.

**Built from a derived and an effect.** The source is a derived carrying the watch's equality, read by one effect. The effect reruns only when that derived's value changes, so the cleanup the handler returned and the abort signal `getAbortSignal()` answers inside it follow answers, never re-evaluations of the source that produced an equal value. Holding the handler's cleanup by hand inside a plain effect would have had to tell a rerun from the end of the watch.

**Silent at creation unless asked.** The value before the first answer is read when the watch is created, untracked, so a write between creation and the first flush is answered against it. `immediate: true` answers the first value too, with `previous` undefined. `watch` runs when `$effect` does and `watch.pre` when `$effect.pre` does; a pre effect first runs during its own creation, so an immediate `watch.pre` answers before the call returns. There is no synchronous mode: several writes in one flush are answered once, with the last value and the value before the first of them.

**Equality.** `Object.is`, and two arrays of one length element by element: a source naming several dependencies returns a new tuple on every evaluation, and a tuple of computed members would otherwise answer changes none of its members shows. `equals` replaces it for a source that rebuilds an equal object. A source returning the same reactive object never changes: it reads the fields it means.

**After the first run every rerun answers.** The derived has already decided the value changed. Comparing again with a value remembered beside the effect would let a run whose batch was later discarded silence the committed change; as written, such a run can leave only a wrong `previous`.

A watch needs an owner and refuses `effect_orphan` without one, as an effect does. On the server it reads no source and answers nothing, as server effects do, `immediate` included.
