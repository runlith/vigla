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
      },
      {
        "at": "attributes.ts"
      },
      {
        "at": "context.ts"
      },
      {
        "at": "events.ts"
      },
      {
        "at": "props.ts"
      },
      {
        "at": "swap.ts"
      },
      {
        "at": "bindings.ts"
      },
      {
        "at": "select.ts"
      },
      {
        "at": "boundary.ts"
      },
      {
        "at": "async.ts"
      },
      {
        "at": "styles.ts"
      },
      {
        "at": "html.ts"
      },
      {
        "at": "list.ts"
      },
      {
        "at": "attachments.ts"
      },
      {
        "at": "head.ts"
      },
      {
        "at": "await.ts"
      },
      {
        "at": "targets.ts"
      },
      {
        "at": "element.ts"
      },
      {
        "at": "hot.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "inspect.ts"
      }
    ],
    "id": "dom",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/dom
---
Client rendering: cloning compiled templates into the page's document or, while hydrating, claiming the server's nodes with the same navigation; attributes, classes, styles and events, delegated to the mount target where upstream delegates; inserting, moving and removing node ranges; the branch and list blocks that build new content off-screen and swap it in at commit; component props and component context; and mounting, hydrating and unmounting a component tree.