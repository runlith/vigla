---
id: 01a1a174-be18-7174-bd37-2c24085ca6b3
title: Startup removes a SOCKET_PATH file only when nothing answers on it
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-node/src/server.ts
---
A socket left by an unclean shutdown blocks `listen` with EADDRINUSE, but a file's type and size cannot tell it from a live one. Under Node's cluster module every worker runs this startup while the primary holds the one listening socket, so removing a live file leaves the server listening with no path to reach it (Kit #16230). A connection attempt decides: refused means stale and the file is removed; answered means a sibling serves it and the worker binds beside it.