---
id: 01a18791-075e-7a25-bfe1-31157dfaafb9
title: Rename the project from Dromon to Vigla across packages, specifiers, targets, checks and the graph
ord: 2
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
---
The operator renamed the project to Vigla. Packages `dromon` → `vigla`, `@dromon/*` → `@vigla/*`; directories `packages/dromon` → `packages/vigla`, `targets/dromon` → `targets/vigla`; every specifier, script, environment key, check and copied sample naming the old name; module sources moved with reanchor_path; every graph block's title and body naming Dromon. One commit set landed while the core agents stand at a boundary, with `harness:passing` green on the renamed target before and after. The repository, folder and Tagma project renames wait for the operator.