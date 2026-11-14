---
id: 01a18510-8258-7bcb-96dd-89ffc1f38b48
title: "#spec"
ord: 5
tags: ["tag"]
fields:
  {
    "body": {
      "shape": "content"
    },
    "edges": [
      "validates",
      "relates",
      "changes"
    ],
    "fields": {
      "status": {
        "type": "enum",
        "values": [
          "open",
          "closed"
        ]
      }
    },
    "gates": [
      {
        "field": "status",
        "from": "open",
        "gate": "transition",
        "to": "closed"
      },
      {
        "field": "status",
        "from": "closed",
        "gate": "transition",
        "to": "open"
      },
      {
        "gate": "open-children",
        "tag": "task"
      }
    ],
    "id": "spec",
    "identity": {
      "shipped": {
        "export": "spec",
        "library": "work"
      }
    },
    "roles": {
      "spec": true,
      "status": {
        "closed": "closed",
        "field": "status",
        "initial": "open"
      }
    },
    "sections": [
      {
        "key": "spec",
        "text": "A #spec agrees a change the operator asks to have specified, before it is built. It thinks through what stands and what will stand: outcome, owners and boundaries touched, reason for the choice, checkable acceptance criteria. Split independent specs into children. Edit it in place when what is wanted changes: it always says what is wanted now. Closing its tasks does not close it: whoever ends its last task, or led its work, closes it once built, or once no longer wanted — the answer of finish_block, close_block or apply_batch that ends a task names the spec left with no open work, in this project or another. A closed spec is history, never current knowledge."
      },
      {
        "key": "software-development",
        "text": "A spec that changes what the user gets links each feature it changes with `changes`. Whoever builds it keeps those features true and records each new capability in its own feature."
      },
      {
        "edits": [
          "append"
        ],
        "key": "project",
        "text": ""
      }
    ],
    "sources": [
      "file",
      "dir",
      "symbol"
    ]
  }
---
A #spec agrees a change the operator asks to have specified, before it is built. It thinks through what stands and what will stand: outcome, owners and boundaries touched, reason for the choice, checkable acceptance criteria. Split independent specs into children. Edit it in place when what is wanted changes: it always says what is wanted now. Closing its tasks does not close it: whoever ends its last task, or led its work, closes it once built, or once no longer wanted — the answer of finish_block, close_block or apply_batch that ends a task names the spec left with no open work, in this project or another. A closed spec is history, never current knowledge.

A spec that changes what the user gets links each feature it changes with `changes`. Whoever builds it keeps those features true and records each new capability in its own feature.