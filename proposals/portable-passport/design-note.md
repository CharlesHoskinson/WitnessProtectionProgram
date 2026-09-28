# Sealing Passport recovery material with WPP: a second-layer design

**Status: design proposal. Nothing here is ratified, implemented or reviewed.**
Written 2026-09-28 against `midnightpassport.com` (live PWA bundle `main-Bx8oz3vq.js`, fetched
2026-09-28T14:36Z), `midnight-passport.vercel.app` (vision site, same fetch), the
`CharlesHoskinson/WitnessProtectionProgram` tree at `main`, and
`~/projects/midnight-audit-sources/passport-demo`. Research backing the numbers is in
`reports/Passport recovery login security.md` and `research_notes/Passport recovery login security/`.

---

## 1. Verdict

**Yes to WPP backing up the recovery file in Google Drive. No to the second encryption
layer as specified.**

The two halves of the question have opposite answers, and the reason is a single number.

Backing the sealed recovery pack to Drive is exactly what WPP is built for, and the
integration point is unusually cheap — see §5. That part is sound.

But a key derived from *biometric + PIN + image puzzle* carries at most **~38 bits**
theoretical and **~22–33 bits** after measured human bias. Once the ciphertext is in Drive,
the attacker downloads it and grinds offline with no rate limiter. At RFC 9106's recommended
Argon2id parameters that costs roughly **$200, about one day on $1,000 of rented GPU**.
The recovery secret it protects takes over the account outright (`account_custody.compact`
`recover()` bumps `device_epoch` and registers a new device, with no timelock).

The mobile constraint means you cannot tune your way out: a ~1-second budget on a phone
allows ~168 MiB-passes, and the entire feasible parameter range spans only **~2.1 bits**.

The proposal is fixable, and the fix keeps all three factors. They just stop being the
thing that carries the key.

---

## 2. The correlation problem, which matters more than the entropy problem

Passport today derives the wallet seed from a WebAuthn PRF output
(`midnight-passport:webauthn-prf:v1` → HKDF → `midnight-passport:wallet-seed:v1`). WebAuthn
§10.1.4 associates the PRF with the credential *"for the lifetime of the credential"* — so a
**synced passkey yields the same PRF output on every device it syncs to**. The wallet seed is
derived, not hardware-held.

Stack that against the rest of the product:

| Role | Principal today |
|---|---|
| Passkey sync fabric | Google Password Manager / iCloud Keychain |
| "Add a way back" OIDC recovery | Google, Apple, Microsoft, Discord, X, email |
| Proposed WPP backup storage | Google Drive |

If the second layer is also gated by anything Google-reachable, **one Google account
compromise takes the wallet, the recovery path and the backup at once.** Palo Alto Unit 42's
*Golden Pass-ta-key* (3 Aug 2026) extracts the Security Domain Secret from Chrome process
memory and decrypts all Google-synced passkeys, so this is not hypothetical.

WPP already states the invariant that prevents this — *"Provider login never unlocks the WPP
root by itself"* (`ROADMAP.md` M3) and *"Signing into Google does not unlock WPP's keys"*
(`README.md`). **The second layer's real job is enforcing that invariant, not adding entropy.**

> **Correlation rule.** No two of {storage provider, passkey sync fabric, OIDC way-back
> provider, recovery helper set} may resolve to the same principal. Enforce it at enrolment
> and re-check it whenever the user adds a way back or changes storage.

A caveat that constrains the design: **you cannot require a device-bound credential.** There
is no `authenticatorSelection` knob for it. The RP can only inspect the `backupEligible` (BE)
flag after `create()` and refuse — and BE is only as trustworthy as attestation makes it.

---

## 3. What each factor is actually worth

| Factor | Contribution | Evidence |
|---|---|---|
| Biometric | **0 bits.** Gates an authenticator; produces no stable bits | fuzzy-extractor approaches rejected; WebAuthn UV is a local gate |
| 6-digit PIN | 19.9 theoretical, **10.74–11.01 measured** | human choice clusters on dates/1234 |
| 4-of-25 images, ordered | 18.2 theoretical, **~8–12 effective** | Android pattern G̃(0.5) = 8.06–8.95 bits; 19–21% of patterns in first 20 guesses |
| **Combined** | **38.1 theoretical, ~22–33 effective** | |

Required bits, derived: `log2(attacker_budget_$) + 25 + 6 margin`. A $100k adversary needs
**48 bits**; ≥64 is the recommendation with real margin. ~30 bits is not close.

The verdict was written in 2004. Davis, Monrose & Reiter, on graphical schemes:

> *"the space of passwords can be exhaustively searched in short order if an offline search is
> possible. So, any use of these schemes requires that guesses be mediated and confirmed by a
> trusted online system."*

A KDF over a Drive blob removes exactly that mediation. **The fix is to put the mediation
back** — and the cheapest mediator you already own is the secure element.

### The one thing the puzzle is genuinely good at

Recall. Passfaces retained **72% at five months** against 27% for passwords at three months;
Déjà Vu's one-week failure rate was 5–10% against 30–35% for PINs. Given that recall of an
assigned 56.4-bit code drops from 94% to **59% at a median 16 days** of disuse (Bonneau &
Schechter, USENIX Security 2014), a factor that survives disuse is worth real money — just not
as entropy.

So: **use the puzzle where recall matters and entropy does not.** Keep it unordered — ordering
buys 4.6 bits you can't bank and causes >75% of Story-scheme login failures.

---

## 4. Why not build a rate-limiting oracle

This is the textbook answer (Apple Cloud Key Vault: *"only 10 attempts… the HSM cluster
destroys the escrow record and the keychain is lost forever"*; Google CKV hardcoded to 10).
Three reasons it is the wrong call here:

1. **Apple's own top tier abandons it.** Advanced Data Protection deletes the CloudKit service
   keys from the HSMs entirely and substitutes recovery contacts and a recovery key.
2. **The hardware foundation is under active attack.** Battering RAM, WireTap and TEE.fail
   (2025–26) break remote attestation itself on SGX/TDX and SEV-SNP via DRAM-bus interposers.
   Battering RAM alone breaks 2 of Signal SVR3's 3 trust domains.
3. **The state of the art is a serious build.** SVR3 needs a usage-limited ristretto OPRF
   inside a PPSS across three independent cloud/TEE vendors. Signal's own paper indicts the
   simple version: *"an attacker that compromises the secure hardware can… learn user PINs."*

A centralised PIN oracle also contradicts Midnight's sovereignty position. **Use the secure
element as the rate limiter instead — it is free, local, and already in the product.**

---

## 5. The design

### 5.1 Integration point

WPP's entire public recovery surface is two calls:

```
UnlockedVault.createRecoveryPack(): { wire: Uint8Array, recoveryKey: Uint8Array }
UnlockedVault.fromRecoveryPack(wire, recoveryKey, codecs): UnlockedVault
```

`wire` is the sealed root record; `recoveryKey` is 32 random bytes handed out raw today for a
Bitwarden secure note. **The second layer is a new artifact that seals those 32 bytes.** The
kernel, the package format, the HKDF profile and the AAD rules are untouched. `wire` goes to
Drive exactly as WPP already does it (live round trip passed 2026-09-19).

`docs/integrations.md` anticipates this: *"Existing passkey-PRF/password local wrapping can
protect a device-held WPP root, while Bitwarden is an explicit independent recovery route."*

### 5.2 Multi-envelope wrapping, not one KDF

Seal `recoveryKey` K into **independent envelopes**, any one of which opens it. This gives OR
at the policy level while each envelope internally requires AND of its own inputs — the same
shape as LUKS keyslots or age recipients.

**E1 — device fast path (biometric AND PIN AND puzzle).**
```
K_prf   = WebAuthn PRF, separate credential, salt "midnight-passport:wpp-recovery-prf:v1",
          userVerification: "required"          → 256 bits, biometric-gated, HW rate-limited
K_know  = Argon2id(PIN ‖ puzzle_answer, salt)   → ~22-33 bits, defence in depth
KEK_1   = HKDF-Expand(HKDF-Extract(salt, K_prf ‖ K_know),
                      CTX(["WPP-SEAL","1","device", envelopeId]))
```
All three of the user's factors live here, and only here. The PRF carries the security; PIN
and puzzle defend against malware on an unlocked device that can invoke the passkey. **E1 uses
a credential with BE=0 where available**; if only BE=1 is obtainable, E1 inherits the sync
fabric's assurance and the correlation rule (§2) forbids Google Drive as the storage target.

**E2 — threshold recovery, no device, no low-entropy secret.**
Shamir-split K, t-of-n (2-of-3 minimum, 3-of-5 preferred), **each share encrypted to a
helper's public key with a proof of correct sharing** — the PVSS the custody contract's own
comment already calls for. Add a **cancellable time delay** (Argent's precedent: 1–3 days,
1 week) announced to every remaining device. Add DeRec's one genuinely good idea: a
**periodic challenge-response heartbeat** verifying each helper still holds a correct share,
so silent decay becomes a detectable alert.

**E3 — offline escrow.** K wrapped under a printed ≥128-bit code with a checksum. Apple's
advice for the analogous artifact is to *duplicate* it, not to add factors.

**The PIN and puzzle never appear in E2 or E3.** They only ever combine with a hardware secret.
That is the whole trick: the low-entropy factors are never the sole barrier to an
offline-attackable blob.

### 5.3 The decoy-set dilemma dissolves

Storing the puzzle's decoy set is the unsolved problem since Déjà Vu (2000): fix the decoys and
users misremember them as portfolio images; randomise them and you enable the intersection
attack. **Behind a hardware rate limiter, randomising wins** — the intersection attack needs
repeated observation of a device the attacker already controls, at which point E1 is lost
anyway. So: derive the grid per session from a seed in the (already encrypted) envelope header
over a large public corpus, and never store the answer.

Keep the portfolio **free of faces and people**: Davis's attacks conditioned on gender and race
alone, which is the worst possible property for a factor bound to a real identity. Budget a
~3-bit bias discount for a neutral set, not the 8+ bits a face set costs.

### 5.4 Reliability

Threshold, never conjunction. On Google's measured recovery-channel rates, ANDing three human
factors fails **63–77%** of the time; even at an optimistic 5% per-factor failure it locks out
**14%**. The same p on 2-of-3 gives 0.7%. Every protocol in the field — SLIP-0039, Argent,
Vitalik's design — uses threshold plus delay, and Vitalik argues explicitly against 2-of-2.

---

## 6. What to change in the product

1. **Add a timelock and veto to `recover()`.** It currently bumps `device_epoch` and registers
   a new device immediately. This is the single highest-value change and it is independent of
   everything else here.
2. **Replace the plaintext ledger shares with PVSS** — the contract's own `TODO(PVSS)` says
   *"anyone can reconstruct the recovery secret… Do not ship."* Prototype-scoped, but it is
   the same 32-byte secret this design protects.
3. **Enforce the correlation rule** at enrolment and whenever a way back is added.
4. **Enrol a second, separate credential for WPP recovery** rather than reusing the wallet PRF
   credential — Passport already domain-separates its two derivations, so extend the pattern.
5. **Measure Argon2id on the real target device.** The mobile figure in the research rests on a
   single unverified data point. A recovery flow can justify a 10–60s budget (≈3.5 more bits).
6. **Don't claim AAL3.** NIST SP 800-63B-4 §2.3.2: *"syncable authenticators SHALL NOT be used
   at AAL3."* Don't claim hardware non-exportability either; the seed is derived.
7. **Treat DeRec as unavailable.** `lib-derec` is at 0.0.2 and self-describes as pre-release;
   the spec repo is untouched since June 2025; the cryptography and protobufs repos are
   archived; no audit found. The vision site names it as the recovery mechanism. It cannot be
   load-bearing for 2027 without an owner and a build-or-partner decision.

## 7. What is already right

Worth recording, because it is easy to lose in a critique:

- Passport does **not** call `PublicKeyCredential.toJSON()`, which would ship the PRF-derived
  key to its own server. PRF output is read directly, consumed locally, and there is real
  zeroization discipline (16 `.fill(0)` sites plus `dispose()`).
- The two derivations are domain-separated with a documented rationale.
- `largeBlob` is requested as `"preferred"` with absence handled — correct, since Chrome caps
  it near 2 KB and Android has no support.
- WPP's threat model already refuses forward-secrecy and cryptographic-erasure claims, and
  already requires that an authenticated backup may be *old*.

## 8. Open decisions

- Does E1 require BE=0, or is a BE=1 fallback allowed with a downgraded claim and a
  forbidden-storage-target rule?
- Helper set for E2: human helpers, user-owned devices, or an institutional option?
- Is the puzzle mandatory in E1 or an opt-in alternative to a longer PIN?
- Does the duress case get a distinct portfolio, or is that out of scope? (Contested; listed,
  not recommended.)

## 9. Caveats

- This note reads code, a minified production bundle and documentation. It is not a live run,
  not a cryptographic review, and no part of it has been tested.
- The live PWA bundle is minified; inferences about control flow from it are weaker than the
  source-level findings.
- The `account_custody.compact` findings are from `contracts-stagenet` in the demo repo. The
  live bundle references `ACCOUNT_CUSTODY` and `device_epoch` but **not** `recovery_shares` or
  `recover(`, so the shipped client does not appear to exercise the share path.
- Entropy figures for the puzzle are extrapolated from Android-pattern and Passfaces
  measurements; no study measures this exact construction.
- Cost figures are derived arithmetic over cited anchor benchmarks, not direct measurements.
