---
id: 01a19f13-477f-712f-86c4-75e7ecd7ba50
title: Release the drafts of a fork that is never committed or discarded
ord: 49
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19ed2-030c-7d67-b970-41b1432b9946
---
A fork dropped without commit or discard keeps its drafts, together with their effects, subscriptions and signals, for as long as anything holds the fork. Decide the fork's lifetime owner, for example the owner that created it, so that the drafts end with that owner. Prove it red first through public `vigla`.