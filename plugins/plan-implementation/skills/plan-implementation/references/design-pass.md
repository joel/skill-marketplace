# Design pass checklists

Companion to the Design phase in SKILL.md. Two passes have their own mandate and are
never waived by "already designed this session": the UX pass and the pre-mortem.

## UX / interaction pass (any user-facing change)

`frontend-design` covers how a surface *looks*; this pass covers how it *behaves*.
Walk it for **every user journey** the change touches, including on-screen copy and
instructions, and decide explicitly:

- **Default ordering**: the most useful order for the task (recency, weight, count,
  priority), not insertion order or alphabetical.
- **After each action**: where the user lands; that the new or changed item is
  visible without scrolling (scroll-to, highlight, top-insert plus a linking toast);
  where focus goes.
- **Every state**: empty, sparse, loading, processing, error. Hide any element that
  is useless in a given state (zero-count facets, tags with no records).
- **Memory**: whether the surface should remember the user's last useful input or
  result instead of resetting to a placeholder.
- **Copy matches behaviour**: a subtitle promising "tap to remove" on a surface that
  became swipe-only is the classic miss. Re-read every instruction string against
  the shipped interaction.

These are requirements the architect blueprint must encode, not afterthoughts.
Rules discovered here go into the project's UX conventions doc and its agent
instructions so the `/code-review` loop enforces them. There is no official UX-review
plugin, so UI-heavy changes also warrant a focused UX-critic agent run with the
conventions doc as the rubric.

## Concurrency and failure-mode pre-mortem

**Required** for any feature that is async or job-backed, pushes server-side updates
to clients, makes an external or paid call, mutates shared state under concurrency,
or adds stateful client-side interaction machinery (pointer or gesture tracking,
drag or swipe, an optimistic-UI state machine).

This is the cheapest place to catch the bug class an automated reviewer otherwise
surfaces one at a time over many rounds: double-spend, claim staleness,
transport-error handling, stale broadcasts, mutating controls shown to read-only
viewers, gesture interleavings. Answer these **before coding** and make the answers
requirements the blueprint must encode:

- **Double-submit and re-entrancy**: two tabs, a double-click, a framework retry. Is
  there an atomic claim or guard *before* any expensive or paid side effect, not just
  before the database write? Is it taken at the synchronous entry point so the
  in-flight state is observable to the response?
- **External or paid call**: what does doing it twice cost? Do timeout, non-2xx,
  transport error, and malformed-but-2xx body each convert to a handled failure that
  releases any claim and reverts the UI?
- **Async ordering**: can the job's push and the request's own response arrive out
  of order and leave a stale, superseded view? Does a reload mid-flight reflect
  persisted state rather than a forced one?
- **Multi-viewer and role**: a broadcast is one payload to every subscriber. Does it
  ever carry a mutating affordance a read-only viewer should not see? Gate by role;
  do not toggle a flag per finding.
- **Lease, TTL, and crash recovery**: if an in-flight claim has a TTL, is it
  comfortably longer than the maximum job runtime, and what happens when it goes
  stale mid-run? Decide what is fixed versus an accepted, documented limitation.
- **Client-side gesture or interaction state machine**: enumerate the interleavings,
  not just the happy path. The gesture closed or reset externally mid-flight
  (another instance claiming exclusivity, a tap-away dismisser, a server-driven DOM
  replacement); a pointer lost without a terminal up or cancel event; time-derived
  values (velocity, distance) read after a pause; the post-gesture ghost click
  activating what is underneath, with any suppression time-bounded rather than a
  latch; keyboard or assistive-technology focus reaching a control the gesture
  normally reveals, and focus moving on afterwards; the enabling breakpoint or media
  condition flipping mid-interaction; page-cache snapshotting mid-state. Every
  terminal path (own release, external close, teardown) must revoke the same tracking
  the gesture start claimed.

Prefer **one principled model** (a state machine, a single atomic claim plus token)
over patching adjacent interleavings. That is what ends the whack-a-mole. Record the
chosen model and any accepted limitation in the issue plan.
