# The claims graph — schema v1

Owned by the graph-optimizer lane (CHARTER §5). Changes are versioned;
a schema change migrates every `theory/*/graph.json` in the same run or
does not land.

A theory IS its graph. `THEORY.md` is regenerated from it — never the
other way around.

```json
{
  "version": 1,
  "axiom": "genetic",
  "updated": "YYYY-MM-DD",
  "nodes": [
    {
      "id": "gen-1",
      "claim": "One sentence. The thing being asserted about the perfect system.",
      "status": "conjecture | argued | cited | measured",
      "detail": "The argument. As long as it needs to be, no longer.",
      "sources": ["Only for cited/measured. Real, re-verifiable references."],
      "edges": [{ "to": "gen-2", "type": "supports | contradicts | refines | depends" }],
      "created": "YYYY-MM-DD",
      "updated": "YYYY-MM-DD"
    }
  ]
}
```

Rules:

- **Ids are global and permanent**: `<prefix>-<n>`, prefix per axiom
  (`gen`, `bod`, `que`, `tst`, `map`, `pat`, `go`, `cen`), never reused
  after a prune. Cross-graph edges are legal (`"to": "cen-3"` from any
  graph) — they are how the combination theory attaches.
- **Status is the evidence ladder** (CHARTER §4). It rises only with
  the evidence that defines the rung, and `sources` must be real and
  re-verifiable — an invented citation poisons every later reader.
- **Edges are claims too**: a `contradicts` edge between two `argued`
  nodes is an open problem the lane should be working; the optimizer
  surfaces unresolved contradictions in its health summary.
- **Prune with a trace**: removing a node deletes it from the graph and
  adds one line to the lane's `LOG.md` naming the id, the claim, and
  why. History lives in git; the graph stays lean.
- **`updated` moves only on real change** to that node — status, claim,
  detail, edges. Reformatting is not a change.
