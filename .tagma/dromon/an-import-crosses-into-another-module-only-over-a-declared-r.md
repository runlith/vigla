---
id: 01a18612-c6ca-7116-83bd-2f8890d0998c
title: An import crosses into another module only over a declared relation and through an entry open to the importer
ord: 16
tags: ["rule"]
fields:
  {
    "enforcement": {
      "debt": [],
      "escaped": [
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/abort.ts -> packages/vigla/src/runtime/reactivity/effects.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/effects.ts` onto a floor below `packages/vigla/src/runtime/reactivity/abort.ts`, or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/effects.ts` truly stands lower.",
          "line": 3,
          "path": "packages/vigla/src/runtime/reactivity/abort.ts",
          "said": "imports `./effects.ts` from `packages/vigla/src/runtime/reactivity/effects.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/abort.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/abort.ts -> packages/vigla/src/runtime/reactivity/tracking.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/tracking.ts` onto a floor below `packages/vigla/src/runtime/reactivity/abort.ts`, or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/tracking.ts` truly stands lower.",
          "line": 5,
          "path": "packages/vigla/src/runtime/reactivity/abort.ts",
          "said": "imports `./tracking.ts` from `packages/vigla/src/runtime/reactivity/tracking.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/abort.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 10,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/async.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/async.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/async.ts` truly stands lower.",
          "line": 11,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./async.ts` from `packages/vigla/src/runtime/reactivity/async.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/effects.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/effects.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/effects.ts` truly stands lower.",
          "line": 36,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./effects.ts` from `packages/vigla/src/runtime/reactivity/effects.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/eager.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/eager.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/eager.ts` truly stands lower.",
          "line": 37,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./eager.ts` from `packages/vigla/src/runtime/reactivity/eager.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/held.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/held.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/held.ts` truly stands lower.",
          "line": 53,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./held.ts` from `packages/vigla/src/runtime/reactivity/held.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/tracking.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/tracking.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/tracking.ts` truly stands lower.",
          "line": 67,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./tracking.ts` from `packages/vigla/src/runtime/reactivity/tracking.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/past.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/past.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/past.ts` truly stands lower.",
          "line": 68,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./past.ts` from `packages/vigla/src/runtime/reactivity/past.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/leaving.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/leaving.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/leaving.ts` truly stands lower.",
          "line": 69,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./leaving.ts` from `packages/vigla/src/runtime/reactivity/leaving.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/batch.ts -> packages/vigla/src/runtime/reactivity/settle.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/settle.ts` onto a floor below `packages/vigla/src/runtime/reactivity/batch.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/settle.ts` truly stands lower.",
          "line": 70,
          "path": "packages/vigla/src/runtime/reactivity/batch.ts",
          "said": "imports `./settle.ts` from `packages/vigla/src/runtime/reactivity/settle.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/batch.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/edges.ts -> packages/vigla/src/runtime/reactivity/effects.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/effects.ts` onto a floor below `packages/vigla/src/runtime/reactivity/edges.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/effects.ts` truly stands lower.",
          "line": 1,
          "path": "packages/vigla/src/runtime/reactivity/edges.ts",
          "said": "imports `./effects.ts` from `packages/vigla/src/runtime/reactivity/effects.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/edges.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/effects.ts -> packages/vigla/src/runtime/reactivity/owners.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/owners.ts` onto a floor below `packages/vigla/src/runtime/reactivity/effects.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/owners.ts` truly stands lower.",
          "line": 20,
          "path": "packages/vigla/src/runtime/reactivity/effects.ts",
          "said": "imports `./owners.ts` from `packages/vigla/src/runtime/reactivity/owners.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/effects.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/effects.ts -> packages/vigla/src/runtime/reactivity/leaving.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/leaving.ts` onto a floor below `packages/vigla/src/runtime/reactivity/effects.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/leaving.ts` truly stands lower.",
          "line": 23,
          "path": "packages/vigla/src/runtime/reactivity/effects.ts",
          "said": "imports `./leaving.ts` from `packages/vigla/src/runtime/reactivity/leaving.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/effects.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/external.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/external.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`, `packages/vigla/src/runtime/reactivity/leaving.ts`, `packages/vigla/src/runtime/reactivity/owners.ts`, `packages/vigla/src/runtime/reactivity/reads.ts`, `packages/vigla/src/runtime/reactivity/eager.ts`, `packages/vigla/src/runtime/reactivity/settle.ts`, `packages/vigla/src/runtime/reactivity/held.ts`, `packages/vigla/src/runtime/reactivity/scheduler.ts`, `packages/vigla/src/runtime/reactivity/sources.ts`, `packages/vigla/src/runtime/reactivity/fork.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 12,
          "path": "packages/vigla/src/runtime/reactivity/external.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/external.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/held.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/held.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`, `packages/vigla/src/runtime/reactivity/leaving.ts`, `packages/vigla/src/runtime/reactivity/owners.ts`, `packages/vigla/src/runtime/reactivity/reads.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 29,
          "path": "packages/vigla/src/runtime/reactivity/held.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/held.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/held.ts -> packages/vigla/src/runtime/reactivity/async.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/async.ts` onto a floor below `packages/vigla/src/runtime/reactivity/held.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`, `packages/vigla/src/runtime/reactivity/leaving.ts`, `packages/vigla/src/runtime/reactivity/owners.ts`, `packages/vigla/src/runtime/reactivity/reads.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/async.ts` truly stands lower.",
          "line": 31,
          "path": "packages/vigla/src/runtime/reactivity/held.ts",
          "said": "imports `./async.ts` from `packages/vigla/src/runtime/reactivity/async.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/held.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/history.ts -> packages/vigla/src/runtime/reactivity/past.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/past.ts` onto a floor below `packages/vigla/src/runtime/reactivity/history.ts`, or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/past.ts` truly stands lower.",
          "line": 2,
          "path": "packages/vigla/src/runtime/reactivity/history.ts",
          "said": "imports `./past.ts` from `packages/vigla/src/runtime/reactivity/past.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/history.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/leaving.ts -> packages/vigla/src/runtime/reactivity/held.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/held.ts` onto a floor below `packages/vigla/src/runtime/reactivity/leaving.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/held.ts` truly stands lower.",
          "line": 3,
          "path": "packages/vigla/src/runtime/reactivity/leaving.ts",
          "said": "imports `./held.ts` from `packages/vigla/src/runtime/reactivity/held.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/leaving.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/loss.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/loss.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 4,
          "path": "packages/vigla/src/runtime/reactivity/loss.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/loss.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/owners.ts -> packages/vigla/src/runtime/reactivity/async.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/async.ts` onto a floor below `packages/vigla/src/runtime/reactivity/owners.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/async.ts` truly stands lower.",
          "line": 6,
          "path": "packages/vigla/src/runtime/reactivity/owners.ts",
          "said": "imports `./async.ts` from `packages/vigla/src/runtime/reactivity/async.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/owners.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/past.ts -> packages/vigla/src/runtime/reactivity/leaving.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/leaving.ts` onto a floor below `packages/vigla/src/runtime/reactivity/past.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/leaving.ts` truly stands lower.",
          "line": 2,
          "path": "packages/vigla/src/runtime/reactivity/past.ts",
          "said": "imports `./leaving.ts` from `packages/vigla/src/runtime/reactivity/leaving.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/past.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/proxy.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/proxy.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`, `packages/vigla/src/runtime/reactivity/leaving.ts`, `packages/vigla/src/runtime/reactivity/owners.ts`, `packages/vigla/src/runtime/reactivity/reads.ts`, `packages/vigla/src/runtime/reactivity/eager.ts`, `packages/vigla/src/runtime/reactivity/settle.ts`, `packages/vigla/src/runtime/reactivity/held.ts`, `packages/vigla/src/runtime/reactivity/scheduler.ts`, `packages/vigla/src/runtime/reactivity/sources.ts`, `packages/vigla/src/runtime/reactivity/fork.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 8,
          "path": "packages/vigla/src/runtime/reactivity/proxy.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/proxy.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/reads.ts -> packages/vigla/src/runtime/reactivity/async.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/async.ts` onto a floor below `packages/vigla/src/runtime/reactivity/reads.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`, `packages/vigla/src/runtime/reactivity/tracking.ts`, `packages/vigla/src/runtime/reactivity/carried.ts`, `packages/vigla/src/runtime/reactivity/handlers.ts`, `packages/vigla/src/runtime/reactivity/views.ts`, `packages/vigla/src/runtime/reactivity/past.ts`, `packages/vigla/src/runtime/reactivity/loss.ts`, `packages/vigla/src/runtime/reactivity/front.ts`, `packages/vigla/src/runtime/reactivity/units.ts`, `packages/vigla/src/runtime/reactivity/effects.ts`, `packages/vigla/src/runtime/reactivity/leaving.ts`, `packages/vigla/src/runtime/reactivity/owners.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/async.ts` truly stands lower.",
          "line": 1,
          "path": "packages/vigla/src/runtime/reactivity/reads.ts",
          "said": "imports `./async.ts` from `packages/vigla/src/runtime/reactivity/async.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/reads.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/trace.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/trace.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/trace.ts` truly stands lower.",
          "line": 3,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./trace.ts` from `packages/vigla/src/runtime/reactivity/trace.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/reads.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/reads.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/reads.ts` truly stands lower.",
          "line": 5,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./reads.ts` from `packages/vigla/src/runtime/reactivity/reads.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/effects.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/effects.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/effects.ts` truly stands lower.",
          "line": 8,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./effects.ts` from `packages/vigla/src/runtime/reactivity/effects.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/past.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/past.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/past.ts` truly stands lower.",
          "line": 10,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./past.ts` from `packages/vigla/src/runtime/reactivity/past.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/loss.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/loss.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/loss.ts` truly stands lower.",
          "line": 11,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./loss.ts` from `packages/vigla/src/runtime/reactivity/loss.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        },
        {
          "commit": "8fc757fe2ca200766ce73b53ef3ca7b5d648cd2f",
          "fingerprint": "reactivity order packages/vigla/src/runtime/reactivity/tracking.ts -> packages/vigla/src/runtime/reactivity/leaving.ts",
          "fix": "Import down the order of `reactivity`: move what this file needs from `packages/vigla/src/runtime/reactivity/leaving.ts` onto a floor below `packages/vigla/src/runtime/reactivity/tracking.ts` (`packages/vigla/src/runtime/reactivity/graph.ts`, `packages/vigla/src/runtime/reactivity/collector.ts`, `packages/vigla/src/runtime/reactivity/tasks.ts`, `packages/vigla/src/runtime/reactivity/errors.ts`, `packages/vigla/src/runtime/reactivity/history.ts`, `packages/vigla/src/runtime/reactivity/abort.ts`, `packages/vigla/src/runtime/reactivity/tallies.ts`, `packages/vigla/src/runtime/reactivity/provenance.ts`, `packages/vigla/src/runtime/reactivity/edges.ts`, `packages/vigla/src/runtime/reactivity/outgoing.ts`, `packages/vigla/src/runtime/reactivity/batch.ts`), or reorder the floors with `set_module` where `packages/vigla/src/runtime/reactivity/leaving.ts` truly stands lower.",
          "line": 22,
          "path": "packages/vigla/src/runtime/reactivity/tracking.ts",
          "said": "imports `./leaving.ts` from `packages/vigla/src/runtime/reactivity/leaving.ts`, on or above the floor of `packages/vigla/src/runtime/reactivity/tracking.ts` in the order of `reactivity`"
        }
      ],
      "inspection": "modules",
      "on": [
        {
          "op": "submit_work",
          "phase": "before"
        },
        {
          "op": "merge_worktree",
          "phase": "before"
        }
      ],
      "strictness": "gate"
    }
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
---
Relations, entries and order stand on each module's `#module` card and change only through set_module. Every file belongs to a module.