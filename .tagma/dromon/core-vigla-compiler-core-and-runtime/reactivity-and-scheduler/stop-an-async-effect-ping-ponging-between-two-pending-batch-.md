---
id: 01a19eb9-f6d4-7cec-a8ea-06d34c1d2bdf
title: Stop an async effect ping-ponging between two pending batch views
ord: 35
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e9c-75e8-7fbb-a31a-95fc00484936
---
Kit apps/async `query redirects on page load (query in common layout)` (test-build-2/chromium-build) livelocks the main thread; dev and no-JS pass. The layout runs `{await layoutRedirect(page.url.pathname)}`. The query redirects and Kit awaits `goto` before throwing `Redirect`, as upstream does, so the navigation batch for `/from-common-layout` stays pending while the batch for `/redirected` processes. The scheduler then re-runs the layout's async effect alternately under each batch's view (`process` → `viewOf`). Each view reads a different pathname, so each run reads a different remote cache key. The run tears down the other key's `createSubscriber` render effect; its microtask release drops the last reader and bumps that subscriber's version, which dirties the effect for the other batch. No write repeats per source and no network request repeats; neither batch settles. Found by pausing the built page over CDP and counting `run` and `write` calls in a private build. Expected: a superseded batch's async effect does not re-run under its stale view in a way that disturbs the newer batch's subscriptions, or the older batch is abandoned once a newer navigation supersedes it.