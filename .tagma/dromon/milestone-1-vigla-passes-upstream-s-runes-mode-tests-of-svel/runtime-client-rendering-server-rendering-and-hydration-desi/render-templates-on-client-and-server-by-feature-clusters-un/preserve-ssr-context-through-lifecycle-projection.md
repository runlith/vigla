---
id: 01a19c26-cda8-7f61-bbcd-98addc4057b6
title: Preserve SSR context through lifecycle projection
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c27-068d-7f8e-b1a2-52c63bba6c90",
    "status": "in_work"
  }
---
Resolve the routed context async-SSR, async-context-throws-after-await async-SSR and constructor-prefer-passed-context SSR/async-SSR cases through the complete server render, owner/context and adapter lifecycle path. Preserve general Core context ownership; keep component-only lifecycle restrictions in the adapter. Establish recorded status, prove the exact scoped cases and affected regressions, then land producer changes with exact newly passing rows.