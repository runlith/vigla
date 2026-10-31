---
id: 01a19414-f737-713e-9e8d-08890330b9f9
title: Only the app-hook boundary selects generated event defaults
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/hooks.ts
---
The runtime handles routes together and retains matcher outputs as `ParamValue`, including numbers and bigints. App-authored hooks are checked against that app's generated public event defaults, which the runtime package cannot know. The one projection at the hook call boundary changes no value; processing and serialization stay route-agnostic rather than pretending parameters are strings.