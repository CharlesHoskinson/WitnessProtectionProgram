# Midnight corpus research — 2026-09-13

This directory is a local research artifact. It contains no generated files in
any upstream repository.

## Source lock and coverage

`clone-update-status.tsv` is the primary source lock for the 76 public
`midnightntwrk` repositories. Each row contains the update result, repository
name, and exact checked-out upstream commit. `structural-graph-status.tsv`
records the resulting structural node and edge counts; `graph-render-status.tsv`
records whether the view is full or aggregated.

All sources were fetched from GitHub on 2026-09-13. The initial conservative
update guard retained all fourteen pre-existing working copies and cloned the
current GitHub revision into the named sibling
`<repo>.upstream-2026-09-13`. Those siblings, rather than the preserved working
copies, were graph sources:

| Repository | Current sibling | Original condition after fetch |
| --- | --- | --- |
| compact | `compact.upstream-2026-09-13` | `main` matched `origin/main`; preserved by the initial update guard |
| compact-js | `compact-js.upstream-2026-09-13` | 787 commits behind upstream |
| compact-playground | `compact-playground.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| compact-tree-sitter | `compact-tree-sitter.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| k-framework-ts | `k-framework-ts.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| k-rust | `k-rust.upstream-2026-09-13` | 847 commits behind upstream |
| learn-compact | `learn-compact.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| midnight-architecture | `midnight-architecture.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| midnight-docs | `midnight-docs.upstream-2026-09-13` | initially 3,129 behind; original later fast-forwarded to the locked sibling commit |
| midnight-engineering | `midnight-engineering.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| midnight-ledger | `midnight-ledger.upstream-2026-09-13` | initially 1,474 behind on `ledger-8`; original later fast-forwarded to the locked sibling commit |
| midnight-node | `midnight-node.upstream-2026-09-13` | 98 commits behind plus two local changes |
| midnight-zk | `midnight-zk.upstream-2026-09-13` | 0/0, preserved by initial update guard |
| midnight-zkir | `midnight-zkir.upstream-2026-09-13` | initially 8 behind on `zkir-v3`; original later fast-forwarded to the locked sibling commit |

None of the fourteen original checkouts was detached: all had a named local
branch and configured upstream. `midnight-ledger` tracked `origin/ledger-8` and
`midnight-zkir` tracked `origin/zkir-v3`; the remainder tracked `origin/main`.
The later original-checkout fast-forwards are recorded in
`/home/charl/wpp-research-2026-09-13/canonical-original-sync.json`.

The existing LFDT-Minokawa Compact clone was separately fetched and
fast-forwarded from `11e7ec5` to `c47230cc8c3e743634166d9b84698ac2b238c418`.
Its structural result is under `minokawa-compact/`.

`midnight-node`'s existing submodule remains pinned at
`424f7f94bb927c10c564d4d7149527fcea3ba5cc`; it was not initialized, changed,
or updated. The current upstream sibling retains the uninitialized submodule
gitlink `cfc4a66a66e7fcf0336c32e17a93edf25e4e8026`.

## Graph outputs

Every public repository has `repo/graphify-out/graph.json`. Repositories with
supported source files also have `GRAPH_REPORT.md` and `graph.html` unless the
graph had no nodes. Graphs above 5,000 nodes have a community aggregation in
their HTML view. The merged graph is `merged/graph.json`: 143,681 nodes and
357,666 edges before community aggregation. Its report is
`merged/graphify-out/GRAPH_REPORT.md`. Graphify could not render the merged community view:
the 143,681-node graph reduced to 8,085 visible aggregation nodes, still above
the 5,000-node HTML limit. No merged `graph.html` was produced.
`merged/graph-with-focused-semantics.json` adds eight focused semantic nodes
and seven cited semantic edges, for 143,689 nodes and 357,673 edges.
`merged/graph-with-focused-semantics-and-fallbacks.json` additionally includes
README/license semantic fallback graphs for the seven repositories with no AST
nodes, for 143,702 nodes and 357,679 edges.

## Extraction method and limitations

Structural extraction used Graphify `extract --code-only` with the current
local Graphify package. This is real AST extraction, with extracted symbols and
relationships. `VERIFICATION.md` summarizes skipped categories from the
per-repository extraction logs.

No configured Graphify semantic provider was available. The focused semantic
review is a source-cited Terra extraction in
`focused-semantic.graph.json` and `FOCUSED_SEMANTIC_FINDINGS.md`, separate from
AST relationships. It covers midnight-js private-state export, Compact witnesses,
Passport wallet-local storage, and the cited Midnight Improvement Proposals.
The focused semantic extraction was performed by this `gpt-5.6-terra` worker;
it did not use an external Terra CLI or configured Graphify semantic API.
The seven README/license fallbacks are explicitly semantic coverage, not AST
coverage: `platform-js`, `midnight-engineering`, `midnight-trust-registry`,
`releases`, `compact-playground`, `learn-compact`, and
`lfdt-project-proposals`.
