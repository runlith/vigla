---
id: 01a187ef-87e3-7f23-a283-3285e132c33d
title: Hold a batch with pending work of its own apart from an earlier held batch writing the same source
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
A batch writing a source an earlier held batch also wrote is merged into it before it runs, so three clicks each starting their own `await` commit only together once the last resolves. Upstream 5.57.3 merges a later batch only when it would commit at once (no pending work after its structure phase); a batch with work of its own is held apart, its view showing its own writes over the earlier batch's, and when the earlier one commits the later one keeps the sources it wrote itself, so nothing it ran is requested again. Contract: `async-state-eager`, which expects `<p>1</p>` after the first resolve. Rework the merge and rebase rules together and correct the Merging and Rebase paragraphs of aa9fb09b.