---
name: implement-spec
description: >-
  Implement the result of to-spec and to-tickets across a task graph of tickets on one integration branch using parallel sub-agents. Use ONLY when executing a multi-ticket .scratch/ feature spec with blocking dependencies (not for single-step tasks). 複数の依存関係付きチケット（.scratch/）で構成された仕様を並列サブエージェントで実装し統合する時に使用する。
---

You have been provided a spec. This spec should have tickets associated with it under `.scratch/<feature-slug>/` (`spec.md` and `issues/<NN>-<slug>.md`), describing how to implement the spec.

The goal is the entire spec implemented on a single local **integration branch**, with every ticket resolved (`Status: done` in each local ticket file, or per user-approved tracker).

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Start every subagent (`invoke_subagent`) with a fresh context window.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in parallel where possible (`Workspace: "share"` or `"branch"` with `self`) for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** (`invoke_subagent`) to conduct any exploration required by the tickets - relevant codebase files or documentation. Save markdown notes under `.scratch/<feature-slug>/notes/` (or `<Artifact Directory Path>/scratch/`) accessible by future subagents so **implementer subagents** focus on implementation rather than exploration.

3. Create the local integration branch. (Do not push branches or open GitHub PRs without explicit prior user approval.)

4. Use a fresh **implementer subagent** (`invoke_subagent` with `TypeName: "self"`, `Workspace: "share"` or `"branch"`) for each ticket in the ready frontier. Each implementer subagent:
   - confirms its working copy is based on the integration branch before starting, and resets onto it if not;
   - reads and follows the `tdd` skill (`SKILL.md` in `<skills>`) to build the ticket;
   - merges or prepares its commit cleanly relative to the integration branch tip before reporting done.

5. Once an **implementer subagent** completes, merge its branch/changes onto the integration branch (verify no conflicts and clean tests).

6. Update ticket status (`Status: done`) in `.scratch/<feature-slug>/issues/`. If this opens new tickets in the **frontier**, kick off more **implementer subagents** to work on the newly unblocked tickets.

7. Once all tickets are complete, read and follow the `code-review` skill (`SKILL.md` in `<skills>`) on the integration branch. Fix all issues raised by the code review in a fresh **implementer subagent** (or cleanly on the integration branch).

8. Verify the full test suite and doc sync, update each ticket status to resolved, and report the integration branch. (If remote PR creation is desired, ask the user for explicit approval first.)

9. Clean up temporary subagent workspaces/branches as needed (`manage_subagents`).
