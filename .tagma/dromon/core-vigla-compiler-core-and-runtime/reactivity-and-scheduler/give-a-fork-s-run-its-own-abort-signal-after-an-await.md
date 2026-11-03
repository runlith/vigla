---
id: 01a19f13-476c-705b-8b6a-15c0b490f5aa
title: Give a fork's run its own abort signal after an await
ord: 47
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19ed2-030c-7d67-b970-41b1432b9946
---
The signal swap in a fork's run covers only its synchronous part: `getAbortSignal()` called after an `await` returns the committed run's signal. A discarded fork then cannot abort the work it started after its first await, and disposing the committed run aborts the fork's work. The run's signal must follow its continuation. Prove it red first through public `vigla`.