---
id: 01a1d117-f5d5-7938-baba-6e511076d5a1
title: An each row gets its item as a plain value when the key is the item itself, and its index as a number when the block declares none
ord: 36
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/list.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/blocks.ts
    symbol: listCode
---
A keyed row is found by its key, so when the key expression is the item binding itself the row's value can never change: a new value would be a new key and a new row. The client transform then passes `PLAIN_ITEM` and compiles reads of the item as the plain value, and `list` creates no item source and writes none on updates. When the block declares no index binding the body cannot read the index, so `PLAIN_INDEX` drops the index source and the write every moved row would pay; in DEV a row whose item is still a source keeps the index source, which only its trace reads ([[5c59f50a]]). Upstream 5.57.3 makes the same choice in runes mode (`EACH_ITEM_REACTIVE` unset when the key is the item, `EACH_INDEX_REACTIVE` only for a used index).

A collection that reads an external value (`MUTABLE_ROWS`) keeps the item source even when the key is the item: an in-place mutation of a store's object keeps its identity, and only the mutable source's write reruns the rows that read it.