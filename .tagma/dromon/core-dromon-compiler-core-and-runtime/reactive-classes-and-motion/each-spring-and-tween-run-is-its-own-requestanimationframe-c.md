---
id: 01a18792-e2e2-7b61-ab29-dc74cfea1755
title: Each Spring and Tween run is its own requestAnimationFrame chain, timed from its first frame
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/runtime/classes/frames.ts
---
The runtime spec binds animation time to `requestAnimationFrame`: `loop` reads it at every request and takes time only from the timestamps it passes, so a tween's start is its first frame's timestamp plus its delay, and a spring's first frame measures no elapsed time. A test faking `requestAnimationFrame` alone therefore fakes all motion time; where it does not exist, as on the server, a run never steps and its promise stays pending.

A run is a chain of its own rather than one task in a shared loop: there is no module-level queue or pending-frame flag, so a run that never gets its frame — the harness clock's `reset` drops queued callbacks, a server has none — leaves no state that stalls later runs, and an aborted run cancels only its own frame. Callbacks still fire in the order runs were requested, as a shared loop would step them.