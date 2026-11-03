---
id: 01a19f37-25ac-793f-8c0b-864715a9d440
title: Let a held batch publish the async result a newer batch's hidden-view commit overtook
ord: 51
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19f13-4772-7bd1-ae6c-1e55dc9eb5a2
---
A held batch's pending async run is ordered before a newer batch's run of the same expression. When the newer batch commits a result it computed hiding the held batch's writes, the held run can no longer publish, and the forced recheck that follows finds it not stale, because it read nothing the newer batch changed. The held batch then commits without ever publishing, so the expression shows a value computed for state that no longer holds, such as the old route's data after navigation. A pending run that a commit has overtaken must count as stale, so that its batch reruns it. Prove it red first through public `vigla`.