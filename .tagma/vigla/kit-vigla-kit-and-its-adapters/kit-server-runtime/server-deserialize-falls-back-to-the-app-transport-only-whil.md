---
id: 01a19ea3-e909-7a7a-a198-d77bf9e740fe
title: Server `deserialize` falls back to the app transport only while one is configured in the realm
ord: 22
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193ff-f879-7e28-88cb-81227bef7fb4
sources:
  - kind: file
    ref: packages/kit/src/server/transport.ts
---
Server `$app/forms` `deserialize` decodes with the transport of the request carried across `await`. Without a platform async store, no request can be found after `await`. Upstream's built-server test initializes `Server` exactly that way and then decodes a custom type after awaiting a fetch. The decoder therefore falls back to the transport that `Server.init` configured. Several applications can share one realm, and the module slot cannot tell them apart. So the slot answers only while every configuration it has seen is the same transport, a configuration without a transport included. Once a second, different one arrives it answers `undefined` for good: decoding a custom type then fails rather than running another app's decoders.