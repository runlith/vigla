---
id: 01a19460-20a1-7f3b-8340-d6885eca791c
title: Binary form files are validated as ranges before their bytes are read
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/shared/form-data.ts
---
The form envelope is compatible with Kit 3.1 independently of Content-Length: its little-endian lengths delimit a devalue header and an offset table, followed by files ordered by size. Metadata and non-overlapping contiguous ranges are checked before arithmetic or lazy file access, preventing type confusion and allocation from an unfulfilled declared size. A request has one sequential reader, while file consumers can revisit cached ranges.