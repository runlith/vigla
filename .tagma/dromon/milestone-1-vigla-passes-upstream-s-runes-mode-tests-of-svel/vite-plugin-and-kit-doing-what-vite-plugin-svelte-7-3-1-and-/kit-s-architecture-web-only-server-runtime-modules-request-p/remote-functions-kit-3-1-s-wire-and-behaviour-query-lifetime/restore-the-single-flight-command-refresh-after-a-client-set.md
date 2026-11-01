---
id: 01a19586-032c-7959-a5b3-d87129b0199a
title: Restore the single-flight command refresh after a client set
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "done"
  }
---
Keep the dev manifest's remote table live as SSR discovers remote modules, so the first browser command reaches its registered implementation. Reproduce the cold-manifest 404 through the Vite plugin's HTTP seam and verify the agreed async dev picks before recording first-attempt passes.