---
id: 01a18752-ff03-7988-bdb3-d50c19ff4ec0
title: Report progress on targets/dromon and keep Dromon's passing set as its test suite
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
---
Build what the spec's report and passing set ask: the progress report against Dromon, the recorded passing set per suite with the command that records newly passing entries, the run of the recorded set alone and the run of one suite or sample. Then run `harness:upstream` once as one command and fix what only that combined run breaks. Every core agent records entries through it, so it lands first.