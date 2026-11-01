---
id: 01a19417-ef1d-76c1-9d8c-be96f41e1337
title: Resolve the six frozen Vite plugin defects at the fork base
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Reproduce vite-plugin-svelte reports #1394, #1349, #1320, #1310, #1254 and #1066 from the frozen reading on vite-plugin-svelte 7.3.1 with Svelte 5.57.3 first. Remove a report from the selected list only with a non-failing fork-base reproduction recorded as evidence; otherwise fix the producer on Vigla and keep a public regression red upstream and green on Vigla as an own difference. Route causes outside the plugin to their owners and record each outcome.