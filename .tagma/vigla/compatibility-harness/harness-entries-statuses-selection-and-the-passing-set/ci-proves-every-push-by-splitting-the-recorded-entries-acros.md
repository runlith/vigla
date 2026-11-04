---
id: 01a1a78e-24ad-7e8b-8d26-2ce2ed56e055
title: CI proves every push by splitting the recorded entries across parallel machines in units that each build what they test
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: harness/src/shards.ts
  - kind: file
    ref: .github/workflows/harness.yml
---
A passing set says what passed at some commit; only a run on a commit proves that commit, so the `harness` workflow runs every recorded entry on each push. One machine needs about 25 minutes, so `--shard <index>/<total>` splits the set: every job reads the same passing set and assigns the same units greedily by estimated cost, heaviest first, and keeps its own, so the jobs together run each recorded entry exactly once and no job coordinates with another. A unit is a Svelte or own suite, a vite-plugin e2e mode, or for Kit's app trees one app's script step and test file: the Kit runner runs only the steps its selected entries name, so a machine builds or serves only the apps and steps its units need, while splitting a step by file lets the largest step spread across machines at the cost of building that app once per machine. The cost table is an estimate; recorded job durations are what tune it and the number of jobs.