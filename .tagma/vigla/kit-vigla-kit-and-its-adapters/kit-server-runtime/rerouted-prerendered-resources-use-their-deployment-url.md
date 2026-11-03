---
id: 01a19c8b-9ff1-7e5a-ba6c-2bac0e7816d7
title: Rerouted prerendered resources use their deployment URL
ord: 16
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/respond.ts
---
Prerendered routes may be absent from the runtime route table. When reroute selects one, the server requests the deployment-served resource rather than falling through to runtime matching; the original method, headers, query and data suffix remain request inputs. Automatic body decompression invalidates the upstream encoding and length headers before that response is returned.