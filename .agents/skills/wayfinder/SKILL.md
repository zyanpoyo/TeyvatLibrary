---
name: wayfinder
description: >-
  Plan a huge, multi-session effort wrapped in fog as a shared map of decision tickets under .scratch/<effort>/ and resolve them one at a time until the route is clear. Use ONLY when asked to chart/navigate a massive, ambiguous multi-session project (do not use for single-session features). 1セッションに収まらない大規模で霧に包まれた計画を .scratch/ の決定マップとして整理し、段階的に霧を晴らす時に使用する。
---

A loose idea has arrived, too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map**, then works its **decision tickets** (questions whose resolution is a decision, not slices of a build to execute) one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting: it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic: engineering work, content workflows, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear, with nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes**, carrying execution into the map itself, but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket has a **name**: its title. In everything the human reads (narration, the map's Decisions-so-far), refer to it by that name, never by a bare id, number, or slug. The file path or link rides _inside_ the name (`[Title](path)`), never standing in for it.

## The Map (Local Markdown Standard)

By default, wayfinding lives in `.scratch/<effort>/`:

- **Map**: `.scratch/<effort>/map.md` (the canonical index: Destination, Notes, Decisions so far, Not yet specified, Out of scope).
- **Child ticket**: `.scratch/<effort>/issues/<NN>-<slug>.md`, numbered from `01`, holding the question in its body. Metadata lines near the top track `Type:` (`research` / `prototype` / `grilling` / `task`), `Status:` (`open` / `claimed` / `resolved` / `out-of-scope`), and `Blocked by:` (`NN, NN` or `None`).
- **Frontier**: scan `.scratch/<effort>/issues/` for tickets that are `Status: open` and whose blockers are all `Status: resolved`.
- **Claim**: set `Status: claimed` and save before starting work on a ticket.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, and append a one-line context pointer (gist + link) to `map.md` under `## Decisions so far`.

*(Only use a remote issue tracker if explicitly requested with prior user approval.)*

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** pasted into it: they are `.scratch/<effort>/issues/` files.

```markdown
## Destination

<what reaching the end of this map looks like: the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](./issues/01-example.md): <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket is a child file sized to one agent session:

```markdown
# <Ticket Title>

**Type:** <research | prototype | grilling | task>
**Status:** open
**Blocked by:** None

## Question

<the decision or investigation this ticket resolves>
```

Assets created while resolving a ticket are linked from the ticket, not pasted in.

## Ticket Types

Every ticket is either **HITL** (human in the loop, worked _with_ a human who speaks for themselves) or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this).

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases to surface a fact a decision waits on. Resolved by a subagent (`invoke_subagent`) that reads and follows the `research` skill (`SKILL.md` in `<skills>`). Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to (an outline, a rough take, a stub, or UI/logic code) by reading and following the `prototype` skill (`SKILL.md` in `<skills>`). Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation. The default case. Read and follow both the `grilling` skill and the `domain-modeling` skill (`SKILL.md` in `<skills>`).
- **Task** (HITL or AFK): Manual work that must happen before a _decision_ can be made: nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that _does_ rather than decides, and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war**: the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets, one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination: everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now, _not_ whether you can answer it now.

- **Ticket when** the question is already sharp, even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope**: it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates (the frontier stops at the destination), so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. When a ticket that already exists turns out to sit past the destination (mis-scoped in while charting, or exposed by a resolution), mark it `Status: out-of-scope` and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked; a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session**, with the exception of research tickets.

### Chart the map

User invokes with a loose idea.

1. **Name the destination.** Read and follow both `grilling` and `domain-modeling` to pin down what this map is finding its way to: the spec, decision, or change. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** (the way to the destination is already clear, the whole journey small enough for one session), you don't need a map. Stop and ask the user how they'd like to proceed.
3. **Create the map** at `.scratch/<effort>/map.md`: Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
4. **Create the tickets you can specify now** under `.scratch/<effort>/issues/` numbered `01`, `02`, etc., and wire `Blocked by:` edges and cross-references. Everything you can't yet specify stays in **Not yet specified**.
5. **Fire the research subagents.** For each `research` ticket you just created, spin up a subagent (`invoke_subagent`) with a fresh context window following `research` to resolve it in parallel, writing findings to `.scratch/<effort>/research/<name>.md` (or on a local `research/<name>` branch, never pushing to a remote without explicit prior user approval) and linking it from the ticket.
6. Stop: charting is one session's work; it hand-resolves nothing.

### Work through the map

User invokes with a map path (`.scratch/<effort>/map.md`). A ticket is **optional**: without one, you pick the next decision, not the user.

1. Load the **map**: the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it**: set `Status: claimed` before any work.
3. Resolve it as the type its `Type:` field names (see [Ticket Types](#ticket-types)). **Zoom as needed**: read the full body of any related or resolved ticket on demand; read and follow whichever skills the `## Notes` block names. If in doubt, read and follow `grilling` and `domain-modeling`.
4. Record the resolution: append `## Answer` to the ticket, set `Status: resolved`, and **append a context pointer** to `map.md` under `## Decisions so far`.
5. Add newly-surfaced tickets; graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If the answer reveals that a ticket sits beyond the destination, mark it `Status: out-of-scope` and record it in **Out of scope**. If the decision invalidates other parts of the map, update or remove those tickets.

The user may run unblocked tickets in parallel, so expect other sessions to be editing `.scratch/<effort>/` concurrently.
