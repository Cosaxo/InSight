# The database — current theory

*Regenerated from `graph.json` by each run; the graph is the data, this
page is its readable face. Last regenerated 2026-08-26 (seed). Statuses
follow CHARTER §4: conjecture → argued → cited → measured; sources live
on the nodes.*

**This is infrastructure theory, not an axiom** (the owner, 2026-08-26).
The axioms are the measured sources, each existing to create powerful,
useful data and connections or to strengthen another axiom's; this
theory is about where that data lives, joins and serves — the perfect,
most efficient and most useful database for all of it.

As the graph currently stands, five claims, none above `argued`:

- **The join is the unit of design** (db-1, argued). The success metric
  of the storage layer is the cost and expressiveness of axis-crossing
  reads — because the app's core function is connecting axes, the
  database's core function is making that connection cheap.
- **Custody is layout before it is policy** (db-2, argued). Custody
  classes live in physically distinct stores; a policy error cannot
  read what the layout never co-located.
- **Two databases and a bridge** (db-3, argued). An append-only private
  ledger folds deterministically into exactly-shaped public read
  models; the fold is where custody transitions happen.
- **Three readers, three shapes** (db-4, conjecture). Device documents,
  fit matrices, research snapshots — likely three materializations of
  one ledger, not one shape serving all. Needs a cited survey before it
  rises.
- **Schema evolution is first-class** (db-5, argued). Versioned,
  all-or-none, old shapes readable until the last consumer moves.
