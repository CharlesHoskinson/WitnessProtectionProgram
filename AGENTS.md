# WitnessProtectionProgram working rules

This repository currently contains a design, source evidence, and an implementation roadmap. Preserve the distinction between proposed interfaces, upstream observations, implemented behavior, and tested results.

- Never commit live witnesses, root keys, recovery packs, vault exports, session tokens, OAuth tokens, or wallet seeds. Use explicitly synthetic fixtures when implementation begins.
- Keep upstream observations pinned to a repository commit or official documentation URL and retrieval date.
- Encryption belongs in the trusted local kernel. Storage adapters receive ciphertext only. A Bitwarden bridge receives the minimum key record needed for the explicit operation.
- Preserve Midnight native export field values and codec versions; the native API returns an object, not canonical wire bytes. WPP metadata is a draft application format, not a Midnight standard.
- Do not claim a backup is remotely durable from a successful local filesystem write.
- Do not equate wallet account recovery, WPP key recovery, private-state restoration, and chain resynchronization.
- Treat unknown schemas, conflicting state, failed authentication, and unsupported account migrations as explicit errors.
- Before shipping cryptographic behavior, require reproducible vectors, negative interoperability tests, restore fault tests, and independent security review.
- Do not copy Bitwarden internal SDK code without reviewing its applicable license and support boundary.
- User instructions govern scope; do not resume unrelated repository campaigns.
- Google Drive is the first beta provider. Other provider login/storage integrations follow later.
- Feature documentation uses Diátaxis (tutorials, how-to guides, reference, explanation) and Sphinx with MyST Markdown under `docs/`. Build with `python -m sphinx -W --keep-going -b html docs docs/_build/html` in the documentation environment. Do not present planned application flows as runnable tutorials.
- Use claude-obsidian for this project's working research summaries, decisions, sources and open questions. Resolve the dedicated vault through `.claude-obsidian.json` (this WSL checkout: `/home/charl/vaults/WitnessProtectionProgram`). Read `wiki/hot.md` and `wiki/index.md` on resumption, then use inspected transactions to save scoped updates. Never record secrets or full transcripts. Promote reviewed feature documentation into Sphinx; the vault remains separate from published docs.
