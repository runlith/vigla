---
id: 01a18612-2441-7442-9b76-c191e3f1d060
title: Harness targets
ord: 14
tags: ["module"]
fields:
  {
    "id": "targets",
    "kind": "substrate"
  }
edges:
  - kind: imports
    to: 01a18612-2431-7b09-97cb-71fe6fa5bba6
sources:
  - kind: dir
    ref: targets
---
The install trees the harness runs against: in each, `svelte` resolves to one implementation — upstream Svelte 5.57.3, later Vigla's packages under alias — so samples and runners import the target by its public name. A target carries its test configuration and its fresh-state hook, the only code allowed to touch that target's internals.