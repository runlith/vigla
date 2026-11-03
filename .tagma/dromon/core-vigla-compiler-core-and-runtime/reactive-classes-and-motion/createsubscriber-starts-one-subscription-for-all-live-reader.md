---
id: 01a18792-e2b4-7313-b618-b180007898da
title: createSubscriber starts one subscription for all live readers and stops it a microtask after the last reader's effect is destroyed
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/classes/subscriber.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: expire
---
A read subscribes only while a reaction tracks it: it reads the subscriber's version and creates a template effect under the current owner whose creation counts a reader and whose teardown uncounts it. A read under `untrack` or from plain code gets the value with no subscription. A derived with no owner — one declared at module level — subscribes under no owner, so its subscription never stops, as upstream's does; without it an effect reading such a derived would never see the source change.

The count drops a microtask after the teardown, not at it: an effect that reruns destroys its children before running again, so counting down at once would reach zero, stop the source and restart it in the same rerun — and a leak once the old stop was lost. When the count reaches zero the stop runs and the deriveds reading the version are marked stale, so a derived that cached a value while subscribed re-reads it when a reader subscribes again. The release is no write and schedules no reaction. An effect still listed as a reader then holds no subscription: its latest run did not subscribe, and it keeps the version only as a dependency retained for another batch's view, as a pending async rerun or a run under a view does ([[1a1dd2a2]], [[aa9fb09b]]). Upstream bumps the version there, which reaches only deriveds, since its reactions replace their dependencies on every run. Bumping it here dirtied such an effect for that other view. Rerunning it there tore down the newer run's subscription, whose release dirtied it back, so two views of one async expression reran each other forever. Because the subscription is an effect under the reader's owner, it lives in services and detached roots exactly as in components.