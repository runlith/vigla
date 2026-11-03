---
id: 01a18561-f5a4-757c-af9c-4fb6755f2e3e
title: Commits follow Conventional Commits with the module id as scope
ord: 5
tags: ["rule"]
---
Type is `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore` or `revert`, chosen honestly: a mechanical edit is not `feat`. Scope is the id on the card of the module the change was made for; none for a change across the product. Subject: imperative, lowercase, no trailing period, at most 72 characters. The body says what changed in behaviour and why, in one to three sentences; a micro-edit may omit it. `!` and a `BREAKING CHANGE:` trailer only when a published package's public API breaks.