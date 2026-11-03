---
id: 01a1a19d-c2fc-7960-8aa3-e0bd77fcb6c9
title: A remote form's state ends with its last element and is completed from the submission
ord: 19
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19471-a636-7bd7-8393-f3fbe190152a
  - kind: relates
    to: 01a19ce4-390c-7e6b-a78c-e327e61b70c4
sources:
  - kind: file
    ref: packages/kit/src/client/remote/form.ts
---
A form instance without a key would otherwise keep its result, issues and input for the life of the tab, so a result the documentation calls ephemeral came back after navigating away, and a field default from one route record lost to the previous record's edits. When the last element of an instance detaches and no submission is in flight, the state is cleared after a tick, so a detach and re-attach in one flush (an attachment rerun) keeps it. A keyed instance already left with its last holder.

Submitting copies the submitted FormData into the input for every path the form has no value for yet, and gives every array-typed control group an empty array, so `fields.value()` inside an enhance callback matches what is sent. Edits never do this: sibling controls stay untouched (see the input invalidation note).
