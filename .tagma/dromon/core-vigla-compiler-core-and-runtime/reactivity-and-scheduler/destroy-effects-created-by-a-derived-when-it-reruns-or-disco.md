---
id: 01a193e7-b8d8-74a9-9509-eecedc7f7aeb
title: Destroy effects created by a derived when it reruns or disconnects
ord: 8
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a187ef-87f1-7eba-ae15-b2dd82502fc0
---
Effects created while a derived evaluates are currently linked directly to the derived's declaration owner and survive recomputation and disconnect. Retained normalized list collections expose the leak in each-updates-9 (dom/hydrate): replacing a derived MyStore leaves its createSubscriber subscription alive and never logs cleanup. Give the derived ownership of effects created by its runs, dispose them at rerun and disconnect, and keep explicit detached roots independent.