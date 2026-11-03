---
id: 01a19ed2-030c-7d67-b970-41b1432b9946
title: Keep a fork's rerun of an effect from taking the real run's children, teardown and signal
ord: 37
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19eb9-f6d4-7cec-a8ea-06d34c1d2bdf
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
A fork that reruns an effect — an async expression preloading new inputs — destroys what the effect's last real run owns: the children it created, its teardown, its owned deriveds and its abort signal. The fork's own children outlive a discard. A `createSubscriber` read directly in a `resource` therefore loses the committed key's subscription and keeps the fork's key subscribed, so the committed value goes stale. A fork started while a real batch's request is in flight aborts that request; the batch never commits and `settled()` never resolves. A fork run must leave the real run's state alone, discard its own state when the fork is discarded, and replace the real run's state only when the fork commits with its run still the effect's latest.