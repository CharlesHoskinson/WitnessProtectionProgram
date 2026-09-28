# Portable Passport — encrypted export and human-recoverable backup

**Status: design proposal. Not ratified, not implemented, not security-reviewed.**

This directory holds a proposal for how a Midnight Passport identity can be exported
and backed up through WPP into the user's own Google Drive, and what an ordinary
person can do to decrypt it again.

Read [portable-passport-proposal.pdf](portable-passport-proposal.pdf) — 15 pages,
with an evidence appendix and a provenance/caveats appendix.

## What it argues

Nothing a human holds in their head, recognises on a screen, or knows about their own
life can carry a 256-bit key. The measured ceiling is ~56 bits with permanent
rehearsal and below 30 bits set-once, while a KDF buys only ~25 bits once the
ciphertext is downloadable. So the human's action cannot be *producing* the secret —
it has to be *authorising its release*.

The proposal is three independent release paths, any one of which recovers the
backup: a device path (WebAuthn PRF, biometric-gated, rate-limited by the secure
element), a helper path (threshold shares with a time delay and owner veto), and a
printed-escrow path. A PIN and an image puzzle remain, but only inside the device
path, where hardware already throttles them.

It needs no change to the WPP kernel, the witness package format, the HKDF profile,
or the AAD rules. The integration point is `createRecoveryPack()` / `fromRecoveryPack()`
in `src/kernel/vault.ts`: the second layer is a new artifact sealing the 32-byte
`recoveryKey`.

## Two findings that stand on their own

- **`freshRandom` at `src/kernel/vault.ts`** produces the recovery key, every
  `generationId`, and every 12-byte GCM nonce, via Node's `crypto.randomBytes` →
  OpenSSL's *public* CTR-DRBG at strength 0 — not `RAND_priv_bytes`, which is the API
  OpenSSL intends for long-term private key material. Node's fork- and clone-safety
  here are undocumented.
- **Entropy sources must be concatenated into a vetted conditioner, never XORed.**
  Dodis et al. show XOR-refresh can fail to accumulate more than one bit from
  independent, unbiased inputs. See NIST SP 800-90B §3.1.6 and RFC 5869 §3.4.

## Files

| Path | What it is |
| --- | --- |
| `portable-passport-proposal.pdf` | The proposal |
| `design-note.md` | Earlier working design note, read against the live code |
| `art/` | Cover and section art |
| `src/` | The build — content, theme and renderer |

## Rebuilding

Requires `reportlab` and `fonttools[woff]`. Fonts are fetched, not vendored
(`fonts/` is gitignored).

```sh
cd src
python fetch-fonts.py     # Inter + Geist Mono, weight-instanced
python render.py          # writes ../portable-passport-proposal.pdf
```

Editorial content lives in `src/content.py`; `src/theme.py` holds the design tokens
and the vector diagrams. Figures are sourced in Appendix A; withdrawn and
unverifiable figures are recorded in Appendix B and must not be quoted.
