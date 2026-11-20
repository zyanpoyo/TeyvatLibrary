---
name: implement
description: >-
  Implement a piece of work based on a spec or set of tickets using TDD and code review. Use ONLY when the user explicitly asks to implement a prepared spec or .scratch/ ticket end-to-end (do not trigger on tiny one-line edits). 準備された仕様書（spec）や .scratch/ チケットをもとに TDD とコードレビューを回して実装を完結させる時に使用する。
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket or spec reference, read it from `.scratch/` (or the provided path) and state its title before starting. If the reference is ambiguous, ask.

Read and follow the `tdd` skill (`SKILL.md` in `<skills>`) where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite (and any repo-required E2E/doc checks) once at the end.

Once done, read and follow the `code-review` skill (`SKILL.md` in `<skills>`) to review the work.

Commit your work to the current local branch.
