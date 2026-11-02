---
id: 01a19c20-e030-7adc-918c-afe4f1723ee6
title: Keep component bindings authoritative over prop spreads
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c21-860c-7039-adc1-0eb2aca9a83f",
    "status": "in_work"
  }
---
Fix the client and server component-prop lowering for bind-and-spread-precedence: an explicit component binding must win over spreads regardless of its source position. Preserve spread-only ordering and two-way setters, prove the routed four modes and scoped related regressions, and land manually added passing rows with the supporting source.