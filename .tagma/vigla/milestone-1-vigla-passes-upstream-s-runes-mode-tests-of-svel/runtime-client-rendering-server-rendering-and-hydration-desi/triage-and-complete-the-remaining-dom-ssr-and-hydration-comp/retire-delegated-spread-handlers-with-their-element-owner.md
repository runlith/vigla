---
id: 01a1959a-8995-756e-867f-bfe3b2b1ab3d
title: Retire delegated spread handlers with their element owner
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19488-5276-72f9-88d9-6b219044bf53",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19486-c7ef-73d4-95e3-4249e2b4aa3f
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
  - kind: relates
    to: 01a18680-7dc0-713c-85e6-a5df365e9754
---
Release delegated handlers assigned by spread attributes and dynamic elements when their element owner ends, without treating a repeating spread update as that lifetime. Preserve replacement and static-handler ownership; prove retained removed nodes cannot invoke the closed handler after reattachment.