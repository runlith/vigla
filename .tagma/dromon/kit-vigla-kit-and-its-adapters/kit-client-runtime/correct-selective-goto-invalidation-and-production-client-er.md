---
id: 01a19c84-048b-7457-8a11-a38283f001fe
title: Correct selective goto invalidation and production client errors
ord: 15
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193f9-8b76-7543-92f4-24aa31ce74ab",
    "status": "in_work"
  }
---
Restore frozen public navigation and fallback behavior for the retained basics production failures, with minimal public red→green regressions and separate commits for independent producers. Distinguish endpoint setup failures from client invalidation and preserve preload, navigation, cache and remote hydration contracts; production ids require a separately authorized first-attempt browser pass.