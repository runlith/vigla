---
id: 01a19c2f-7484-74b7-a5d4-99f8100b97ba
title: A departing-owned derived and its transitive reads use the last-selected view
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
  - kind: relates
    to: 01a18769-e4ee-7426-8e95-a833a8171ace
  - kind: relates
    to: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/leaving.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/proxy.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: destroy
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: get
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/reads.ts
    symbol: refresh
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/scheduler.ts
    symbol: apply
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/scheduler.ts
    symbol: write
---
A derived declared under a departing branch evaluates against that branch's last-selected source view; its synchronous transitive reads, including deriveds declared outside the branch, share that view and a local cache. Direct source, prop and outside-owned-derived reads outside the computation keep their normal current batch view. New state created by the computation remains local and reads its own writes. The isolated evaluation leaves committed derived caches, subscriptions and evaluation resources intact, so a later current reader cannot inherit an outgoing result or lose its abort signal when an outgoing cache ends. Proxy key enumeration uses the selected membership view without adding property-value dependencies to a key-only read.

The nearest independently outgoing ancestor chooses the view. A speculative held or fork batch that explicitly selects the branch may evaluate its own running reactions in that batch's view while unowned callbacks keep the outgoing one. Real reactivation retires the outgoing view before callbacks; completion retires it after the final tick and outroend but before stashing or destruction. Destruction retires it before descending to cleanup, preserving the ordinary teardown/current onDestroy distinction. A completion token owns only its leave run, so reentrant reselection cannot let an old completion destroy a replacement run.

History is shared by source and epoch, rather than copied or updated for each outgoing branch. Actual writes and fork application retain at most one old value per source per epoch interval; the batch actually being processed takes precedence over an unrelated restored continuation when seeding prewrite values and concealed source values, resolving merged aliases and excluding computed-derived caches. A live source's retained values can hold other objects until the oldest outgoing view ends, even when the view never reads that source: this accepted retention permits a late first read without write fanout across outros. Weak source indexes prune expired intervals as views end, and ending the final view drops the history. Retiring membership keeps any active historical computation and its local state alive until it returns; the final reader then releases the view-local cache, owned effects and epoch.
