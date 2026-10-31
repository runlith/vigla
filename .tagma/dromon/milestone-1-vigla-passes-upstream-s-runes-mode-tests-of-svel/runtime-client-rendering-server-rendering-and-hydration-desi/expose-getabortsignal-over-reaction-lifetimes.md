---
id: 01a19403-7ea3-73b1-8c07-1c43daf51243
title: Expose getAbortSignal over reaction lifetimes
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Provide the core's `getAbortSignal()` through its public runtime and the Svelte adapter, using the existing reaction-lifetime hooks so async work is aborted when its owning reaction reruns or is destroyed. Match Svelte 5.57.3's runes-mode behavior and diagnostics, and record the currently unpassed runtime-runes entries that depend on it.