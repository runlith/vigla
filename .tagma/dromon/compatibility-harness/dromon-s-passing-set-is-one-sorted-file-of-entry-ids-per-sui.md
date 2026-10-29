---
id: 01a1875f-09cc-76a4-b488-9c16f5ffac8a
title: Dromon's passing set is one sorted file of entry ids per suite, and a recorded entry that fails fails the run
ord: 17
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18561-f5b0-7f61-a91a-e5b5468243f4
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/passing.ts
  - kind: file
    ref: harness/src/judge.ts
  - kind: dir
    ref: targets/dromon/passing
---
A target whose `package.json` names a directory in `harness.passing` is judged by its passing set; a target naming none, as `targets/upstream`, fails on every running entry that does not pass. Dromon passes a fraction of the contract while it is built, and its run must already be a test suite under [[468243f4]]: an entry joins the set in the change that first makes it pass, and from then on its failure fails the run.

The set is `<passing>/<project>/<suite>.txt`, one entry id per line, sorted by code unit, ending in a newline. An id is the entry as the reports name it: `sample`, `sample (variant)`, a unit test's describe path and title joined by ` > `, a tree entry followed by ` (<mode>)`. One line per entry in one fixed order lets several sessions add entries to one suite at once and keeps their additions apart line by line. `--record` only adds: it reads the file after the run and merges into what stands, so lines another session wrote meanwhile survive.

Nothing removes a line automatically. A recorded entry that stops passing is a failing test to fix, never to unrecord. A line that no longer names a running entry — its status moved off contract or converted, its sample was renamed — fails the run, as not reported or as not running by its status, until the change that caused it deletes the line.

On a target with a passing set, a test file that fails to load, or a part process exiting non-zero, is reported and fails nothing by itself: its recorded entries then go unreported, which fails the run. Manifest faults and unruled entries fail on every target. An entry reported more than once — runtime-browser's two runner files, a test under several Playwright projects folded into one variant — passes only if every report of it passed.
