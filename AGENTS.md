# WitnessProtectionProgram working rules

This repository currently contains a design, source evidence, and an implementation roadmap. Preserve the distinction between proposed interfaces, upstream observations, implemented behavior, and tested results.

- Never commit live witnesses, root keys, recovery packs, vault exports, session tokens, OAuth tokens, or wallet seeds. Use explicitly synthetic fixtures when implementation begins.
- Keep upstream observations pinned to a repository commit or official documentation URL and retrieval date.
- Encryption belongs in the trusted local kernel. Storage adapters receive ciphertext only. A Bitwarden bridge receives the minimum key record needed for the explicit operation.
- Preserve Midnight native export bytes and codec versions. WPP metadata is a draft application format, not a Midnight standard.
- Do not claim a backup is remotely durable from a successful local filesystem write.
- Do not equate wallet account recovery, WPP key recovery, private-state restoration, and chain resynchronization.
- Treat unknown schemas, conflicting state, failed authentication, and unsupported account migrations as explicit errors.
- Before shipping cryptographic behavior, require reproducible vectors, negative interoperability tests, restore fault tests, and independent security review.
- Do not copy Bitwarden internal SDK code without reviewing its applicable license and support boundary.
- User instructions govern scope; do not resume unrelated repository campaigns.
