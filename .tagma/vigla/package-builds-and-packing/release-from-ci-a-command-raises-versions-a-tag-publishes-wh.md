---
id: 01a1cd55-f4f3-7285-9cf2-e87d5b32ec55
title: "Release from CI: a command raises versions, a tag publishes what the registry lacks"
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1b8c8-2a1b-7b1c-a07e-d8bb06298c96",
    "status": "in_work"
  }
---
Tagma's move onto Vigla pins published versions, and fixes found on Tagma must reach npm often. Versions were raised by hand and published from the operator's terminal, and GitHub lagged the registry. Add `raise` (changed packages and everything pinning them, their `VERSION` literals, the lockfile) and `publish` (dependency order, skipping held versions, dry-run first) to `release`, and a `release` workflow that on a `release/*` tag runs the harness on that commit and publishes through npm trusted publishing.