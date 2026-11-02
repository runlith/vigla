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
Resolve the four routed server-side-rendering variants through render results, owner context and adapter lifecycle projection. All four were unrecorded progress at baseline: context (async-ssr), async-context-throws-after-await (async-ssr), constructor-prefer-passed-context (ssr)/(async-ssr). Preserve general Core owners and isolate explicit context maps; prove the exact cases and affected regressions, then land producer changes with sorted passing rows.