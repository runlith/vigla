---
id: 01a19419-df30-7951-88ff-8ccced14f9f0
title: Static-file HTTP handling belongs to the Node file boundary
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/node/static.ts
---
URL decoding, mounted-path containment and exact-case checks stay together so a case-insensitive development machine cannot accept a path that a case-sensitive deployment would reject. A missing file leaves the response untouched for its caller's fallback. Filesystem metadata yields weak ETags; an adapter may supply a content-derived strong validator for a selected physical representation so compressed variants retain their own validators and range bases. Multipart or malformed range requests receive the complete representation instead of an incomplete multipart response, following [RFC 9110's range and conditional-request rules](https://www.rfc-editor.org/rfc/rfc9110.html#name-range).