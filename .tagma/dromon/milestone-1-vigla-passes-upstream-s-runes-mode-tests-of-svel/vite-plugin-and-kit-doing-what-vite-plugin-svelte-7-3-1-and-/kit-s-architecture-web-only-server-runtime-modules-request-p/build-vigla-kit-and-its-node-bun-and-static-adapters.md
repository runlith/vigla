---
id: 01a193e1-7874-7e93-a8a0-d5f7479de14c
title: Build @vigla/kit and its node, bun and static adapters
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e2-1f81-73bf-bca7-d1170e1158da",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fafe34c15e3
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
  - kind: waits-on
    to: 01a19cb4-7737-744d-8996-7a50adbf9921
---
Kit as [[e34c15e3]] states it: a Web-only `Request → Response` server runtime gated against Node built-ins, the Kit 3 configuration inside the Vite plugin, remote functions with no flag, the app seams of [[8191e72f]], and the harness's Kit part switched from upstream Kit to `@vigla/kit`.