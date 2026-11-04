---
id: 01a19427-2696-7829-b2b9-466f3171b467
title: Kit build, prerendering and the adapter Builder
ord: 12
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "."
      }
    ],
    "id": "kit-build"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
  - kind: imports
    to: 01a193f1-4da0-78c5-8389-3b987555f955
  - kind: imports
    to: 01a193f7-7559-796d-9944-6bc3a5ea7546
  - kind: imports
    to: 01a193f7-755e-71d4-ad4c-01b08be3f25c
  - kind: imports-tests
    to: 01a193f1-4d9c-7780-903d-88cd7526d608
sources:
  - kind: dir
    ref: packages/kit/src/build
---
What happens after Vite has bundled an app: analysing the built server nodes for page options, endpoint methods and remote exports, writing the server and client manifests, prerendering by crawling the app through its own built `Server`, generating the SPA fallback, and the `Builder` an adapter receives to turn the output directory's `output` into a deployment; the Builder carries the app's identity, by which an adapter names what it shows, such as its shutdown event. Running the bundlers is the Vite plugin's; what a platform does with the output is its adapter's.