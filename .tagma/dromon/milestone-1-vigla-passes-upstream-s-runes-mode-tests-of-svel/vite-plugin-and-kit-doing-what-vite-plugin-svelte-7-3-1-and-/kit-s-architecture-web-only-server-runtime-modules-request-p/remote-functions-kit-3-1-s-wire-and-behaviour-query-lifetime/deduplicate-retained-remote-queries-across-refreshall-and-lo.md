---
id: 01a19598-1509-77ef-aa0b-407a7adf7ac8
title: Deduplicate retained remote queries across refreshAll and load reruns
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "in_work"
  }
---
Find the extra request in the async remote refreshAll entry, preserve upstream deduplication between retained queries and rerun loads, and prove the client contract with a focused regression. Verify the remaining remote entries in approved groups of at most twenty and record first-attempt passes with the fix.