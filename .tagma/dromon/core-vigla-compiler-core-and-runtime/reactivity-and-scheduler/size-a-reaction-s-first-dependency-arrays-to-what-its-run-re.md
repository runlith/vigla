---
id: 01a19f74-037c-73e8-ac50-b96f2ef30ae8
title: Size a reaction's first dependency arrays to what its run read
ord: 53
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
edges:
  - kind: relates
    to: 01a19ea4-93d1-7012-b8ba-fb652f376240
  - kind: relates
    to: 01a19f4b-ca38-7994-ba82-53c242b00569
---
A reaction's first run collected its reads with `[]` and `push`, and `extend` built its `slots` the same way, so a derived or effect with one dependency kept two arrays reserved for 17 entries. With deriveds kept and read from effects (`own/create_kept_1to*`), Vigla retained 1040 B per derived against upstream's 790 B at fan-out 8 and trailed by 1.03–1.22.

The first read now starts the read list as `[source]`, and the first subscription builds `slots` with `new Array(count)`, filled by index. Building `slots` as an `[x]` literal instead lets V8 tenure that allocation site, and the arrays then land away from their effects: `unmount_readers_100000` became 30% slower with pretenuring on, and faster with `--no-allocation-site-pretenuring`.