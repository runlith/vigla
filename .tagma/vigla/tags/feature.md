---
id: 01a1d78b-bba4-7529-a95b-4767016d87fe
title: "#feature"
ord: 13
tags: ["tag"]
fields:
  {
    "body": {
      "shape": "content"
    },
    "contracts": {
      "core/feature": {
        "slots": {
          "state": "state"
        },
        "words": {
          "live": "live"
        }
      }
    },
    "edges": [
      "validates",
      "relates"
    ],
    "fields": {
      "state": {
        "type": "enum",
        "values": [
          "live",
          "partial",
          "dormant",
          "promised"
        ]
      }
    },
    "gates": [],
    "id": "feature",
    "identity": {
      "shipped": {
        "export": "feature",
        "library": "software-development"
      }
    },
    "roles": {},
    "sections": [
      {
        "key": "feature",
        "text": "A #feature is one thing the product gives its user, said in the user's words — \"a customer pays by card\", not \"payment endpoint\" — so the product is read without its code. The user is whoever receives the product's result: a person at a screen, a developer calling a library, another program; the title names them and what they get. One record is one thing a user could say they need: a detail is a sentence of its record, a title listing several things is several records, a related feature a `relates` edge. The body, short: **Value** — opens with the complaint the user would make without it, in their words; **How** — what reaches it, named, not specified; **Behaviour** — the non-obvious conditions; **Limits** — where it ends. Parameters, refusal codes, interface strings and numbers stay with their owner. `state` reads the product: live; partial — the gap named; dormant — built, unreachable; promised — said, not done. Sources name the code carrying it: a change that breaks its words or moves its code corrects the record in the same work, and a discrepancy with the code is named, never smoothed over. Whoever builds a capability writes its record in that work. It stands under the page of its subject, never under the module of its code: the list is flat while it fits one screen, a page past a screen is divided by what the user gets, and each page says in a paragraph what the user gets there."
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
A #feature is one thing the product gives its user, said in the user's words — "a customer pays by card", not "payment endpoint" — so the product is read without its code. The user is whoever receives the product's result: a person at a screen, a developer calling a library, another program; the title names them and what they get. One record is one thing a user could say they need: a detail is a sentence of its record, a title listing several things is several records, a related feature a `relates` edge. The body, short: **Value** — opens with the complaint the user would make without it, in their words; **How** — what reaches it, named, not specified; **Behaviour** — the non-obvious conditions; **Limits** — where it ends. Parameters, refusal codes, interface strings and numbers stay with their owner. `state` reads the product: live; partial — the gap named; dormant — built, unreachable; promised — said, not done. Sources name the code carrying it: a change that breaks its words or moves its code corrects the record in the same work, and a discrepancy with the code is named, never smoothed over. Whoever builds a capability writes its record in that work. It stands under the page of its subject, never under the module of its code: the list is flat while it fits one screen, a page past a screen is divided by what the user gets, and each page says in a paragraph what the user gets there.