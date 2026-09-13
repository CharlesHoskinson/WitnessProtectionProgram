# Security and recovery

Status: threat model and acceptance requirements, not an audit result.

## Security objectives

An unauthorized storage reader should obtain ciphertext, not private-state values or semantic metadata. Modification, wrong-root use, wrong-scope use, and metadata substitution must fail authentication. A user must be able to recover the right private state on a fresh compatible installation without the old device, and must be told when freshness or backup completeness cannot be established.

The trusted computing base includes the unlocked kernel, cryptographic library/runtime, application capture codec, Bitwarden bridge during root access, OS, and installed application supply chain. Cloud adapters are outside the plaintext boundary but remain trusted for access-token handling. A malicious application can supply false state or leak data before encryption. WPP cannot establish that an arbitrary witness is correct or that a proof was valid.

## Threats and controls

| Threat | Required control | Residual risk |
|---|---|---|
| Cloud account compromise | Encrypt before upload; opaque names; encrypted metadata | Size/timing/linkability; deletion, rollback, denial of service |
| Modified backup or wrong context | AEAD binds full header and payload; expected target binding checked | Correct crypto does not prove semantic state validity |
| Lost or stolen locked device | Local ciphertext; OS credential store; lock timeout | Platform/runtime compromise and weak device unlock |
| Compromised unlocked device | Minimal exposure time; isolate kernel; no secrets in logs or IPC | Attacker can read plaintext/root; JS zeroization is best effort |
| Stolen Bitwarden session/root | Session isolation; explicit note access; lock/revoke; independent root rotation | CLI session may access other vault items; stolen root exposes its full tree |
| Loss of Bitwarden access | Separately protected recovery pack; rehearsal | Recovery pack/key can themselves be lost or stolen |
| Single-provider deletion | Independent second copy/export plus recoverable keys | Correlated account/vendor failure remains possible |
| Replayed valid old history | Authenticated ancestry; device remembered heads; independent copy comparison | Total loss + one malicious source cannot establish latestness |
| Concurrent writes | Immutable random generations; retained branches; semantic conflict handling | No automatic safe merge for arbitrary contract private state |
| Retry/RNG/nonce reuse | New generation and nonce per encryption; resend saved bytes | OS RNG failure requires detection; randomness assumptions need review |
| Import failure halfway through | Isolated staging, validate, atomic activation, retained old state | Adapter-specific migrations need rollback support |
| Malformed or enormous package | Byte/depth/count bounds before crypto/deserialization; no executable codecs | Upstream parser vulnerabilities require patching and review |
| Wallet/account mixup | Explicit target binding; network/contract/codec checks; migration flow | Same bytes may be unusable under a new account/commitment |
| Sync-folder false success | Separate local-written, provider-read-back and fresh-device-restore states | iCloud upload state may be unavailable on a platform |
| Root rotation mistaken for revocation | Independent new root, re-encrypt live records, revoke device/token access | Copies already decrypted or stolen cannot be revoked |

Do not claim forward secrecy: deterministic recovery deliberately retains access to old records under retained roots. Do not claim cryptographic erasure while an old root or ciphertext survives elsewhere. Do not write a public hash of private witness plaintext to the chain; low-entropy data can be guessable. Ciphertext digests are integrity/discovery aids and may reveal duplicate copies.

## Four separate recovery operations

1. **WPP key recovery:** regain the secret root from Bitwarden or the separate recovery pack.
2. **Witness recovery:** retrieve actual ciphertext and restore the application's compatible private data.
3. **Wallet authorization recovery:** restore spending/device/account authority using the wallet or Passport recovery protocol.
4. **Chain resynchronization:** rebuild publicly recoverable chain state with the verified network configuration.

None implies the others. WPP root backup never automatically includes a wallet seed or Passport guardian shares. Passport recovery policy remains authoritative.

## Required user ceremonies

Setup selects one Bitwarden item, explains that its contents grant WPP recovery, authorizes narrow storage access, and runs an encrypt/upload/download/restore probe using synthetic data. Before showing full protection, establish a second independent data recovery path and verify that the user can recover the key material.

Restore displays the authenticated source account, application, contract/network and recovery date, with an explicit unknown-freshness state where applicable. It activates staged state only after validation. A wrong account is never silently rewritten. Conflicting snapshots never become a silent last-writer-wins overwrite.

Device removal revokes local session/access credentials, removes device access through the appropriate wallet/Passport protocol, and offers independent-root rotation if key exposure is suspected. Explain that historical access cannot be undone. Recovery-pack replacement and old-epoch deletion require explicit confirmation because they can destroy recovery options.

## Acceptance evidence before real witnesses

- Independent HKDF and AES-GCM vectors across Node and browser runtimes, including native export password derivation and JCS bytes.
- Mutation tests for every authenticated field, tag, ciphertext, nonce, wrong root/salt/scope, duplicate JSON keys and unsupported versions.
- Round-trip native Midnight private state with BigInt/byte types, exact codec pins, multiple contracts/accounts, staging failure and target mismatch rejection.
- A complete recovery with old device state removed in a disposable environment, once using Bitwarden and once using the independent recovery pack.
- Quota/revocation/offline/missing-page/duplicate-file/partial-upload and conflicting-index tests on every provider.
- Concurrent-device and restored-device revision tests proving distinct derivation contexts and retained conflicts.
- A deliberately replayed history must report unknown or stale freshness; no test may claim to solve the single-provider total-loss impossibility.
- Secret-leak checks for logs, crash reports, process arguments, IPC, storage adapter inputs, and exported diagnostics.
- Independent cryptographic, implementation, and recovery review of exact release bytes. The design and graph reports alone do not satisfy this gate.
