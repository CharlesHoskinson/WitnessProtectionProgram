# Source evidence and graphs

The design is grounded in the Midnight and Bitwarden repositories and official provider documentation inspected on 2026-09-13. Graph extraction is performed by `gpt-5.6-terra`; the design distinguishes upstream observations from WPP proposals.

## Design observations

| Observation | Pinned source |
|---|---|
| Native private-state export has a fixed format identifier, encrypted payload and salt; separate signing-key exports exist | [Midnight.js provider types](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/types/src/private-state-provider.ts) |
| Export is contract-scoped, serializes private values using SuperJSON, and authenticates its metadata inside the encrypted payload | [Midnight.js Level provider](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/level-private-state-provider/src/level-private-state-provider.ts) |
| Passport's kernel owns witness/secret lifecycle; storage receives ciphertext; irreplaceable inputs need durable redundant backup | [Passport SDK architecture](https://github.com/midnightntwrk/midnight-passport-sdk/blob/5dff89f62151de5ed91f88ef036c48899186a0e7/docs/architecture.md) |
| The SDK identifies itself as planning/spec and its reference beta does not generally access stored witnesses | [SDK README](https://github.com/midnightntwrk/midnight-passport-sdk/blob/5dff89f62151de5ed91f88ef036c48899186a0e7/README.md), [beta scope](https://github.com/midnightntwrk/midnight-passport-sdk/blob/5dff89f62151de5ed91f88ef036c48899186a0e7/docs/beta-scope.md) |
| Bitwarden's personal vault CLI and organizational Secrets Manager SDK are different integration surfaces | [Password Manager CLI](https://bitwarden.com/help/cli/), [Secrets Manager SDK](https://bitwarden.com/help/secrets-manager-sdk/) |
| Bitwarden SDK internals are not a stable supported public Password Manager SDK; component licensing varies | Terra evidence and file/commit pins in [design-source-lock.json](design-source-lock.json) |

The source lock includes repository URL, full commit, file path, permanent GitHub link, retrieval timestamp and SHA-256 of inspected bytes. `matches_commit` verifies the inspected local file matches the cited Git object. An upstream branch may move after inspection; the pin records the observation used for this design.

## Cryptographic specifications

- [RFC 5869, HKDF](https://www.rfc-editor.org/rfc/rfc5869)
- [NIST SP 800-38D, GCM](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [RFC 8785, JSON canonicalization](https://www.rfc-editor.org/rfc/rfc8785)

These specify building blocks. They do not validate WPP's composition. Independent vectors, interoperability, and review remain roadmap requirements.

## Local research locations

The organization checkouts and large generated graphs live outside this small design repository:

- Midnight canonical collection: `/home/charl/midnight/`
- Midnight graph/source records: `/home/charl/midnight/research-2026-09-13/`
- Bitwarden collection: `/home/charl/bitwarden/`
- Bitwarden graph/source records: `/home/charl/bitwarden/research-2026-09-13/`
- Duplicate-checkout maintenance receipts: `/home/charl/wpp-research-2026-09-13/`

The final tracked source/graph inventories describe actual coverage and exceptions. Structural extraction covers supported source syntax; selected Terra semantic extraction covers relevant documentation. Unsupported languages, omitted documents, archived repositories, and graph generation failures must remain visible in those inventories. A graph is a navigation aid, not proof of API stability, cryptographic security, or complete semantic coverage.

Generated graph HTML is a local artifact; paths above are not public hosted pages. No upstream source trees, real vault data, or private witnesses are embedded in this repository.
