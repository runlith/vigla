---
id: 01a19e45-3265-7288-baa6-0fae193a6cdf
title: In DEV, a read after a plain await in an async function is checked against the async run that called it
ord: 27
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18779-64fa-78e2-a5ec-458f1a1dd2a2
  - kind: relates
    to: 01a19562-da29-716c-baa8-d5d4fbee9bcb
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/loss.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/loss.ts
---
A value read after a plain `await` inside an async function is no dependency of the async expression that called the function: nothing restores the run's reading there, so a later change to it never reruns the expression. DEV client output therefore wraps each `await` and `for await` inside an async function body with `trackLoss` and `trackLossEach`, unless a `save` already resumes it or a `svelte-ignore await_reactivity_loss` span in the unit's ignore map covers it. Awaits outside function bodies — template expressions, `$derived`, top-level script — stay plain: what follows them is resumed with `save` and tracked, and wrapping would only add a microtask turn to every DEV await.

The wrapper captures the async run whose synchronous part is executing, or the run an earlier wrapped await of the same chain restored, and restores it only for the resumed synchronous segment: it is cleared at the next microtask, so a reader that runs later — an event handler, an unrelated continuation — is never blamed. Inside that window a read with no tracking frame, made outside any batch, of a source the run did not read warns `await_reactivity_loss` once per run, naming the source's DEV label and followed by a `traced at` stack. The run's reads include its resumed `save` segments, a superset of upstream's synchronous-only set, so this can stay silent where upstream would warn, never the reverse. `untrack` suspends the check, as it suspends tracking. The warning keeps upstream's code and text and leaves through the reporter like every runtime diagnostic.
