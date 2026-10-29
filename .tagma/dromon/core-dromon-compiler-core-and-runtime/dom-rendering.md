---
id: 01a18680-7dc0-713c-85e6-a5df365e9754
title: DOM rendering
ord: 7
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "blocks.ts"
      },
      {
        "at": "mount.ts"
      },
      {
        "at": "template.ts"
      }
    ],
    "id": "dom"
  }
edges:
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
sources:
  - kind: dir
    ref: packages/dromon/src/runtime/dom
---
Client rendering: cloning compiled templates, inserting, moving and removing node ranges, the branch and keyed-list blocks that build new content off-screen and swap it in at commit, and mounting and unmounting a component tree.