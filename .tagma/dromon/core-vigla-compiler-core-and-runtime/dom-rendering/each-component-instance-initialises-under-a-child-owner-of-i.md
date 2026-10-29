---
id: 01a187de-146f-7c0b-b195-0439440c12a8
title: Each component instance initialises under a child owner of its own, which carries its context for good
ord: 10
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/context.ts
---
A component has no effect of its own: it renders inline inside the caller's effect. `push` therefore creates a child owner under the caller — a root effect with no function, linked under it — sets its `context` to the component's layer for good, and makes it the owner for the rest of the component's initialisation; `pop` hands ownership back to the caller. Everything the component creates — effects, deriveds, blocks, an async script's continuation, `onDestroy` teardowns — is owned by that child, so a `$derived` that reruns later, or a continuation after an `await`, reads the component's own context and `svelte`'s projection still sees a component (`set_context_after_init` rather than `lifecycle_outside_component`). The child is destroyed with the caller's branch, its teardowns in creation order with its siblings.

The rejected alternative attached the layer to the caller's effect during initialisation and restored it in `pop`: anything that captured the owner to run later then saw the restored context, which is how `derived-get-context` and `async-context-throws-after-await` failed. The cost is one effect object per component instance, the counterpart of upstream's per-instance component context.
