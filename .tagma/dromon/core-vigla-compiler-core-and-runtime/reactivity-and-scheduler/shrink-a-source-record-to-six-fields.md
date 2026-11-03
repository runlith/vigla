---
id: 01a19f02-d1ff-7dc7-b530-be54934cfb81
title: Shrink a source record to six fields
ord: 44
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
---
A source carries eight fields where upstream's carries six: `logged` and `slot` locate its prior value in the newest history that recorded it, and `links` keeps O(1) removal from its readers. `sbench_create_signals` allocates 100,000 sources per sample and spends most of its time in allocation and GC, so the two extra fields cost 1.19× there. The history position can verify itself against the log it points into, and each reader's link can sit beside the reader in `reactions`, keeping O(1) removal and dropping the `links` array per subscribed source.