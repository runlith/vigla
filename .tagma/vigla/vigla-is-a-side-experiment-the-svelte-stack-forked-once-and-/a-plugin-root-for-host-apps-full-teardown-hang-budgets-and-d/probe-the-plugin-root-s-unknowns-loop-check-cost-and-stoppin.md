---
id: 01a1b93f-3d4c-7d83-bb93-773263043407
title: "Probe the plugin root's unknowns: loop-check cost and stopping an async root mid-`await`"
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a1ad24-1b9f-7217-bf32-00026b792682
---
The two unknowns [[6b792682]] names decide whether a plugin root's hang budget is buildable; a spec waits for them.

1. **Loop-check cost.** Insert a budget check into every loop of the benchmark sources ([[cab271de]]) and compare against the same sources without it: ten alternating runs per variant, medians compared, on the client and server benchmarks.
2. **Stopping an async root.** Show what happens when a root over its budget is stopped while one of its async segments is suspended: its pending units, the batch they hold, `settled()`, and the segment that resumes later.

Record the numbers, the probe code's location and the conclusion on the idea; no product code lands from this task.
