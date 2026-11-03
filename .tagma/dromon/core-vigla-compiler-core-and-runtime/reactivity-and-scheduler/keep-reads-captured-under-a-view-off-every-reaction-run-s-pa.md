---
id: 01a19f02-d1ff-7dc7-b530-be5374667a89
title: Keep reads captured under a view off every reaction run's path
ord: 43
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
---
Every tracked run pays three weak-table operations for value captures that only runs under a batch's view make: `retain` looks up the frame's captures and deletes the reaction from `observed` and `viewed`, `finished` deletes the frame's entry, and every MAYBE staleness check asks `viewed`. Profiles of `kairo_deep`, `kairo_mux` and `kairo_avoidable` put `retain`, `viewedReads` and `finished` at 5–12% of Vigla's time, with no counterpart upstream. The captures belong on the frame that collects them and on the reaction whose last run they describe, so a run outside any view touches two null fields.