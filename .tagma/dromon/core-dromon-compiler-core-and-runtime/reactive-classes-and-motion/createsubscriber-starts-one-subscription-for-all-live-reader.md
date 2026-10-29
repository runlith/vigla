---
id: 01a18792-e2b4-7313-b618-b180007898da
title: createSubscriber starts one subscription for all live readers and stops it a microtask after the last reader's effect is destroyed
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/runtime/classes/subscriber.ts
---
A read subscribes only while a reaction tracks it and an owner stands (an effect, or a derived owned by one): it reads the subscriber's version and creates a child template effect under the current owner whose creation counts a reader and whose teardown uncounts it. Readers outside any owner — a derived read from plain code, a read under `untrack` — get the value with no subscription, since nothing would ever tear one down.

The count drops a microtask after the teardown, not at it: an effect that reruns destroys its children before running again, so counting down at once would reach zero, stop the source and restart it in the same rerun — and a leak once the old stop was lost. When the count reaches zero the stop runs and the version is bumped, so a derived that cached a value while unsubscribed re-reads it when a reader subscribes again. Because the subscription is an effect under the reader's owner, it lives in services and detached roots exactly as in components.