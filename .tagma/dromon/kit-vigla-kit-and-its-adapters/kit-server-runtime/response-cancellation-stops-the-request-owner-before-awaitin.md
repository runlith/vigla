---
id: 01a1942a-8b6e-728e-9675-fa8769f0caf1
title: Response cancellation stops the request owner before awaiting its stream producer
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/scope.ts
  - kind: file
    ref: packages/kit/src/server/stream.ts
  - kind: file
    ref: packages/kit/src/server/data.ts
---
A deferred load value may never settle. Waiting for its iterator to finish before disposing the request would let cancellation deadlock its own cleanup, so cancellation first ends the owner and its abort signal wakes the chunk iterator. Producer completions after that lifetime are discarded without leaving unhandled rejections.