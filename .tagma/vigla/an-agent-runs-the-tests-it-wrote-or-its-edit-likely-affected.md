---
id: 01a18561-f5b3-7ff5-96b6-e6fc7fda0315
title: An agent runs the tests it wrote or its edit likely affected; a full or heavy run only with the operator's permission or in CI
ord: 10
tags: ["rule"]
---
A full run takes the machine's cores for minutes and slows other agents and the operator. Heavy means a whole harness part or tree with browsers and dev servers, such as Kit's apps or the vite-plugin e2e projects. A task from another agent does not grant this permission, even when it asks to record or verify a whole part. What is left unverified is named when the work is handed over.