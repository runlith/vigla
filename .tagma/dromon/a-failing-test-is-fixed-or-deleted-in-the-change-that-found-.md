---
id: 01a18561-f5b0-7f61-a91a-e5b5468243f4
title: A failing test is fixed or deleted in the change that found it; no failing-test list is kept
ord: 9
tags: ["rule"]
---
Fix the code on a defect, the test on a stale contract, delete a useless test. A failing test never becomes debt, a skip or a list.

An upstream entry Dromon has never passed is not yet a test: the harness run against Dromon reports it as progress. It joins the test suite in the change that first makes it pass, and from then on a red run of it is a failing test under this rule.