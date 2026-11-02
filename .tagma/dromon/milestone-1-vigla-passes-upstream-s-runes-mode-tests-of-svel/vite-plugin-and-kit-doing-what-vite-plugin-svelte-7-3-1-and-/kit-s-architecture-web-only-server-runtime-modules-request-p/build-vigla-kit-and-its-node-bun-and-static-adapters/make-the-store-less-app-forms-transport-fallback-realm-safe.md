---
id: 01a19e9f-6bf4-721a-b635-045e4c4354ef
title: Make the store-less `$app/forms` transport fallback realm-safe
ord: 8
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e65-9012-7d67-b88e-092e51101662",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e65-500e-7822-bece-d796410d878d
---
Server `deserialize` reads the transport of the request carried across `await`. Without a platform async store no request is findable after `await` (upstream's built-server `server.spec.js` initializes without one), so it falls back to the app's transport: a module slot set in `Server.init`. That slot must never hand one app another app's decoders. It answers only while exactly one transport has been configured in the realm, and `undefined` once a different one is configured. Keep basics build-2 and dev-2 `deserialize works on the server` green.