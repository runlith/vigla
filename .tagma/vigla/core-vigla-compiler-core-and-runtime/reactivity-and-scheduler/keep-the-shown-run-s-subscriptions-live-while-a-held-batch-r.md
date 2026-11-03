---
id: 01a19f13-4772-7bd1-ae6c-1e55dc9eb5a2
title: Keep the shown run's subscriptions live while a held batch reruns
ord: 48
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19ed2-030c-7d67-b970-41b1432b9946
---
A held real batch, such as a pending navigation, replaces the shown run's children when it reruns, so the shown key's subscription stops until the batch commits. The page on screen shows stale data for the whole navigation. Upstream behaves the same; the committed world should keep what it shows alive until a batch replaces it by committing. Prove it red first through public `vigla`.