---
id: 01a19451-06af-7dde-89ad-4337713cf802
title: The listener counts response lifetimes through shutdown and socket activation
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-node/src/handler.ts
  - kind: file
    ref: packages/adapter-node/src/server.ts
---
Finishing the incoming upload does not finish a response: streaming application work can outlive it. Shutdown and activation-idle accounting therefore follow response completion or disconnection, so a slow response is neither mistaken for an idle server nor left outside the shutdown deadline. The platform's async store is handed over unwrapped. It is created once per process, because the core admits one store per realm ([[fc8a77b5]]).