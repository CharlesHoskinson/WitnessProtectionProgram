# Maintain feature documentation and research notes

Use these rules when adding a feature or recording research for WPP.

1. Classify each feature page by the reader's need: a learning exercise belongs
   in **Tutorials**, a task procedure in **How-to**, a contract or factual lookup
   in **Reference**, and design rationale in **Explanation**. Link between them
   rather than mixing all four into one guide.
2. Write MyST Markdown under the matching `docs/` directory and add the page to
   its section's toctree. Label proposed behavior until implementation and tests
   establish it. Keep existing draft format/security documents visibly marked.
3. Cite versioned official sources and record retrieval dates for provider rules.
   Store source collections under `research/`; do not copy the whole research
   corpus into the feature site's navigation.
4. Store working research summaries, decisions and open questions in the
   repository's dedicated claude-obsidian vault. Read its `wiki/hot.md` and
   `wiki/index.md` before extending it. The workspace `.claude-obsidian.json`
   selects `../vaults/WitnessProtectionProgram`; on this WSL machine that is
   `/home/charl/vaults/WitnessProtectionProgram`.
5. Use the installed claude-obsidian transaction workflow for note, index, log,
   hot-cache and provenance changes. Inspect and apply one scoped bundle. Do not
   directly edit vault files or save tokens, roots, live witnesses, or full chat
   transcripts. Notes describe evidence and decisions; they are not test results.
6. Promote reviewed findings into the appropriate Sphinx page and run the strict
   build command from the [documentation tutorial](../tutorials/build-the-docs.md).

The vault has no remote configured by this setup. It lives on the WSL filesystem
and can be opened as a folder in Obsidian; no Obsidian GUI or cloud sync is needed
for the LLM's local Markdown workflow. Machine-specific paths may be changed in
the workspace configuration on another checkout.

Method and tools: [Diátaxis](https://www.diataxis.fr/),
[Sphinx Markdown support](https://www.sphinx-doc.org/en/master/usage/markdown.html),
[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian).
