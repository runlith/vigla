---
id: 01a18790-2367-7d82-b0d1-acbe100d1dd6
title: The scoping class name is the caller's; the core only hashes
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/compiler/css/hash.ts
---
The core takes the class as `css.hash` and names no scheme, so an adapter keeps its own: the `.svelte` adapter applies `cssHash` and otherwise uses `svelte-` and the core's `hash` of the root-relative filename, or of the sheet text when there is no filename. A client and a server compile of one component must receive the same name, since hydration claims server markup whose classes the client then updates.

`hash` drops `\r` before hashing, so a checkout with CRLF line endings yields the same class as one with LF; its output is upstream's bit for bit, because published class names and custom `cssHash` callbacks that call it depend on that value.
