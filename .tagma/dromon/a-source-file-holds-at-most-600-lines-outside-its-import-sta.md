---
id: 01a18768-8bc2-7423-9532-c17721da6948
title: A source file holds at most 600 lines outside its import statements
ord: 19
tags: ["rule"]
---
Counted: every line of a source file outside import statements, blank lines and comments included. Not counted: tests, declaration files, upstream samples copied into the harness, and data tables, which `tagma.config.ts` names.

A file crossing the ceiling is split by the subjects it holds, never by the count: name its main subject and move each foreign one into its own file, in the module that owns it. Squeezing lines, reformatting or cutting out a piece that is no subject of its own is forbidden. A file holding one subject only goes to the operator: a ceiling wrong for a class of files changes in `tagma.config.ts` on his word.