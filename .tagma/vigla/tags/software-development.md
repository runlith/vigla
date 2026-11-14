---
id: 01a18510-8288-724a-bab1-2c5931211509
title: software-development
ord: 11
tags: ["catalog"]
fields:
  {
    "id": "software-development",
    "release": {
      "guidance": "The software-development catalog connects product understanding, accepted changes and the work realizing them.\n\nA subtree offered as an example for other work is first read against the code by someone who did not write it: a qualified body does not repair an overbroad title.\n\nWrite for a competent reader only the distinctions, conditions and reasons they cannot reliably infer — never what code or structure already says; write from the code, never its comments: the graph cuts prose, it does not move it. An orientation body is as short as its reason; a spec, research reading or rule takes the space its complete subject needs. One subject's conditions stay together. Examples earn their place by resolving ambiguity. An explicit data constraint names the real consuming contract requiring it; the reason, not a character cap, measures quality. Precision is judged per sentence: a title or body promising more than the code holds is a defect.",
      "profile": {
        "checks": {
          "code": true
        }
      },
      "revision": "074b9292d2855c91dbe3d5769f36fe2d46fa303d9f2367faff89a872e3d7dae8",
      "tags": [
        {
          "body": {
            "shape": "orientation"
          },
          "contracts": {
            "core/module": {
              "slots": {
                "entries": "entries",
                "id": "id",
                "order": "order"
              },
              "words": {}
            }
          },
          "edges": [
            "validates",
            "relates",
            {
              "kind": "imports",
              "to": [
                "module"
              ]
            },
            {
              "kind": "imports-tests",
              "to": [
                "module"
              ]
            }
          ],
          "fields": {
            "entries": {
              "name": "moduleEntries",
              "type": "schema"
            },
            "id": "string",
            "kind": {
              "type": "enum",
              "values": [
                "kit",
                "product",
                "surface",
                "substrate"
              ]
            },
            "order": {
              "name": "moduleOrder",
              "type": "schema"
            }
          },
          "gates": [
            {
              "gate": "source-required",
              "kinds": [
                "dir",
                "file"
              ]
            }
          ],
          "id": "module",
          "prompt": "A #module owns a part of the product and its dependency boundary, kept on its card: `id` keys its violations and debt, its one directory source is the root, a file source a file it owns outside it, `entries` what other modules may import of it, `imports` and `imports-tests` what its code and test code may import, `order` its floors, bottom first. Every commit's import check reads the cards; set_module writes them, measuring every enforced rule the change moves; title, body and kind are edited freely. A module stands under the area of what the user gets, wherever its code lies; one making up an application as a whole stands under that application's card, a group with no code of its own. Draw boundaries where dependency boundaries are real, by product meaning, never by copying the directory tree. The body is one paragraph in the product's words — why the product has it, what it owns, what it leaves to callers, a sentence each — never what fields and edges carry. Kind is its primary responsibility: kit — imported by other code; product — delivered to a user; surface — how a user or agent reaches the product; substrate — what the rest runs on. Obligations on anyone working inside it are rules. Write its subtree after reading its code, never a sample — every file whole if the module is small enough, else its exported surface — the module first, then an #explanation per lasting part needing one. An existing subtree's affected owners are read and revised, never recreated; where code contradicts the module or its explanations, correct the module first.",
          "roles": {
            "container": true
          },
          "sections": [
            {
              "key": "module",
              "text": "A #module owns a part of the product and its dependency boundary, kept on its card: `id` keys its violations and debt, its one directory source is the root, a file source a file it owns outside it, `entries` what other modules may import of it, `imports` and `imports-tests` what its code and test code may import, `order` its floors, bottom first. Every commit's import check reads the cards; set_module writes them, measuring every enforced rule the change moves; title, body and kind are edited freely. A module stands under the area of what the user gets, wherever its code lies; one making up an application as a whole stands under that application's card, a group with no code of its own. Draw boundaries where dependency boundaries are real, by product meaning, never by copying the directory tree. The body is one paragraph in the product's words — why the product has it, what it owns, what it leaves to callers, a sentence each — never what fields and edges carry. Kind is its primary responsibility: kit — imported by other code; product — delivered to a user; surface — how a user or agent reaches the product; substrate — what the rest runs on. Obligations on anyone working inside it are rules. Write its subtree after reading its code, never a sample — every file whole if the module is small enough, else its exported surface — the module first, then an #explanation per lasting part needing one. An existing subtree's affected owners are read and revised, never recreated; where code contradicts the module or its explanations, correct the module first."
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
            "dir",
            "file"
          ]
        },
        {
          "body": {
            "shape": "content"
          },
          "contracts": {
            "core/explanation": {
              "slots": {},
              "words": {}
            }
          },
          "edges": [
            "validates",
            "relates"
          ],
          "fields": {},
          "gates": [],
          "id": "explanation",
          "prompt": "An #explanation states a lasting part of the code a reader cannot recover from it: a contract several files or modules keep, an invariant and what breaks without it, a format, or a choice and the alternative it rejected. Its sources name the narrowest code that could contradict it; each session receives it once, on first reading or writing that code. The title states the fact and reads alone. The body holds only the reason, boundary, failure prevented or trade — never the code read back: no walk through functions, no list of fields or parameters, no constant's value — say what the constant must outlast. Measurements and how it was built belong to the task that did the work. A word of totality — every, only, never — is written after reading each place it covers: a universal statement the code breaks is worse than silence. A change breaking an explanation corrects it in the same change. A plain note may also name code with sources; this tag adds delivery on code reads and writes.",
          "roles": {},
          "sections": [
            {
              "key": "explanation",
              "text": "An #explanation states a lasting part of the code a reader cannot recover from it: a contract several files or modules keep, an invariant and what breaks without it, a format, or a choice and the alternative it rejected. Its sources name the narrowest code that could contradict it; each session receives it once, on first reading or writing that code. The title states the fact and reads alone. The body holds only the reason, boundary, failure prevented or trade — never the code read back: no walk through functions, no list of fields or parameters, no constant's value — say what the constant must outlast. Measurements and how it was built belong to the task that did the work. A word of totality — every, only, never — is written after reading each place it covers: a universal statement the code breaks is worse than silence. A change breaking an explanation corrects it in the same change. A plain note may also name code with sources; this tag adds delivery on code reads and writes."
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
        },
        {
          "body": {
            "shape": "content"
          },
          "contracts": {
            "core/feature": {
              "slots": {
                "state": "state",
                "verified": "verified"
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
            },
            "verified": "string"
          },
          "gates": [],
          "id": "feature",
          "prompt": "A #feature is one thing the product gives its user, said in the user's words — \"a customer pays by card\", not \"payment endpoint\" — so the product is read without its code. The user is whoever receives the product's result: a person at a screen, a developer calling a library, another program; the title names them and what they get. One record is one thing a user could say they need: a detail is a sentence of its record, a title listing several things is several records, a related feature a `relates` edge. The body, short: **Value** — opens with the complaint the user would make without it, in their words; **How** — what reaches it, named, not specified; **Behaviour** — the non-obvious conditions; **Limits** — where it ends. Parameters, refusal codes, interface strings and numbers stay with their owner. `state` reads the product: live; partial — the gap named; dormant — built, unreachable; promised — said, not done. Sources name the code carrying it: a change that breaks its words or moves its code corrects the record in the same work, and a discrepancy with the code is named, never smoothed over. `verified` is the code commit its words were last true at, set by writing the title or body, by landing work its last writer worded, and by `confirm_block`: after rereading a record against the code and finding every word true, `confirm_block` settles it. Whoever builds a capability writes its record in that work. It stands under the page of its subject, never under the module of its code: the list is flat while it fits one screen, a page past a screen is divided by what the user gets, and each page says in a paragraph what the user gets there.",
          "roles": {},
          "sections": [
            {
              "key": "feature",
              "text": "A #feature is one thing the product gives its user, said in the user's words — \"a customer pays by card\", not \"payment endpoint\" — so the product is read without its code. The user is whoever receives the product's result: a person at a screen, a developer calling a library, another program; the title names them and what they get. One record is one thing a user could say they need: a detail is a sentence of its record, a title listing several things is several records, a related feature a `relates` edge. The body, short: **Value** — opens with the complaint the user would make without it, in their words; **How** — what reaches it, named, not specified; **Behaviour** — the non-obvious conditions; **Limits** — where it ends. Parameters, refusal codes, interface strings and numbers stay with their owner. `state` reads the product: live; partial — the gap named; dormant — built, unreachable; promised — said, not done. Sources name the code carrying it: a change that breaks its words or moves its code corrects the record in the same work, and a discrepancy with the code is named, never smoothed over. `verified` is the code commit its words were last true at, set by writing the title or body, by landing work its last writer worded, and by `confirm_block`: after rereading a record against the code and finding every word true, `confirm_block` settles it. Whoever builds a capability writes its record in that work. It stands under the page of its subject, never under the module of its code: the list is flat while it fits one screen, a page past a screen is divided by what the user gets, and each page says in a paragraph what the user gets there."
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
      ]
    },
    "tags": [
      "52657ed5",
      "5cff29d3",
      "016d87fe"
    ]
  }
---
The software-development catalog connects product understanding, accepted changes and the work realizing them.

A subtree offered as an example for other work is first read against the code by someone who did not write it: a qualified body does not repair an overbroad title.

Write for a competent reader only the distinctions, conditions and reasons they cannot reliably infer — never what code or structure already says; write from the code, never its comments: the graph cuts prose, it does not move it. An orientation body is as short as its reason; a spec, research reading or rule takes the space its complete subject needs. One subject's conditions stay together. Examples earn their place by resolving ambiguity. An explicit data constraint names the real consuming contract requiring it; the reason, not a character cap, measures quality. Precision is judged per sentence: a title or body promising more than the code holds is a defect.