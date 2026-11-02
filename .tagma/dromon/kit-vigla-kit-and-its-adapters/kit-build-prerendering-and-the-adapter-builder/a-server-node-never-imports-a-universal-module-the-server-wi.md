---
id: 01a19e5c-530d-7495-9152-95d693c7350a
title: A server node never imports a universal module the server will not run
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/build/manifest.ts
    symbol: writeNodes
---
A universal module of a node rendered with `ssr = false`, or under hash routing without its own `ssr`, may touch browser globals (`document`, `indexedDB`) at evaluation; importing it into the built server would crash analysis and prerendering, which load every node. Such a node's server entry carries the page options sync read statically instead, `load` standing as `null` so analysis still sees that a universal load exists. A node whose options cannot be read statically keeps importing the module, as upstream does.