# Midnight private state and the WPP encrypted catalog

Research date: 2026-09-19. This is source research, not runtime validation or an adopted Midnight standard. The product profile remains [the draft WPP package](../../docs/witness-package-format.md). All proposed metadata below belongs to WPP.

## What a witness actually looks like

There is no universal Midnight “witness file” to upload. Compact declares a witness function; the application implements it off-chain. Its JavaScript signature is conceptually `(context: WitnessContext<Ledger, PS>, ...arguments) => [nextPrivateState: PS, witnessValue: R]`. The function can read public context and private application data but does not itself update public ledger state. Circuit code consumes its return value and may explicitly disclose selected information. See the [pinned Compact reference](https://github.com/midnightntwrk/midnight-docs/blob/7cd3bc1681699b41d5a856f7ab2efd9892c27166/docs/compact/reference/compact-reference.mdx), especially witness wrapping and TypeScript representations, and [explicit disclosure](https://github.com/midnightntwrk/midnight-docs/blob/7cd3bc1681699b41d5a856f7ab2efd9892c27166/docs/compact/reference/explicit-disclosure.mdx).

The official bulletin-board application supplies a concrete example: `BBoardPrivateState = { readonly secretKey: Uint8Array }`; its `localSecretKey` witness returns `[privateState, privateState.secretKey]`. This secret belongs to the application; it is not necessarily a wallet seed. The context carries `ledger`, `privateState`, and `contractAddress`. Source: [witnesses.ts, commit 38bfac8c](https://github.com/midnightntwrk/example-bboard/blob/38bfac8c574abb0c5a96c9e076779716c3e88231/contract/src/witnesses.ts).

Compact values have typed representations: `Field` and `Uint` use bounded `bigint`; `Bytes<n>` uses a length-checked `Uint8Array`; booleans use `boolean`; vectors use arrays; tuples use tuples; structs use field objects; enums use checked numbers. Plain JSON serialization loses important types and fails for ordinary bigint values. The backup contract must preserve the application's PS schema and serializer, not guess encodings from strings. **Persistent PS, ephemeral witness return values, proof inputs, generated proof objects, wallet state, and contract-maintenance signing keys are distinct data categories.** WPP should retain persistent PS by default and separately opt in to application-declared retained witness records; generic proof-input interception would expand the secret collection boundary.

## Native export: exact source-observed structure

Pinned implementation: `midnight-js` commit `98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f`; provider package declares `5.0.0-beta.8`. This is an inspected source pin, **not a verified installable compatibility matrix**. The live documentation index labels Midnight.js API reference `4.0.4`; do not combine those version families without tests.

The native API returns an object, not canonical wire bytes:

```typescript
{
  format: 'midnight-private-state-export',
  encryptedPayload: string, // native standard-base64 ciphertext bundle
  salt: string              // 32 bytes encoded as 64 hexadecimal characters
}
```

Its decrypted JSON payload is:

```typescript
{
  version: 1,
  exportedAt: string,
  stateCount: number,
  states: Record<PrivateStateId, string> // each string is superjson.stringify(PS)
}
```

Evidence: [public export/import types](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/types/src/private-state-provider.ts) and [provider implementation](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/level-private-state-provider/src/level-private-state-provider.ts), especially lines 599–617 and 845–1023. The implementation registers a Buffer serializer and uses SuperJSON for each state. Preserve the native `format`, `encryptedPayload`, and `salt` values exactly when wrapping them; enclosing JSON ordering is WPP's concern.

At this pin, native `encryptedPayload` decodes to `encryptionVersion[1] || salt[32] || IV[12] || authenticationTag[16] || ciphertext`. New writes use encryption version 2, AES-256-GCM, and PBKDF2 at 600,000 iterations; earlier version 1 uses 100,000 iterations. Export payload version 1 and encryption version 2 are separate version domains. These are upstream implementation details, **not permission to replace the native importer with a WPP reimplementation**. Source: [storage-encryption.ts](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/level-private-state-provider/src/storage-encryption.ts).

Export requires a selected contract, filters to its raw private-state IDs, errors for no states, and defaults to a 10,000-state limit. It does not include the contract address, network identity, application schema, or account binding in the export object or decrypted payload. The caller must therefore supply authenticated binding metadata. Exporting private states does not export the separate signing-key store, but PS can itself contain application secret keys.

Import likewise requires a selected target contract. It checks version/count and supports `error`, `skip`, and `overwrite` conflicts. Its result is `{imported, skipped, overwritten}`; it is not an ID inventory. It deserializes and writes states in a loop, so a later malformed value or failed write can follow earlier successful writes. **Import only into an isolated staging store, validate every expected ID and application invariant, and activate separately.** The interface has no contract-scope getter; WPP must own and lock the provider scope. A state count limit does not by itself bound decoded bytes or guarantee a coherent concurrent snapshot.

## Capturing the right state

At the inspected source pin, transaction paths keep a `nextPrivateState` with execution data, then persist it after successful finalization. The synchronous ledger-8 entry watches the transaction result and checks success before writing; the internal current pipeline checks `SucceedEntirely` before writing. See [internal/transaction.ts](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/contracts/src/internal/transaction.ts) around 218–229 and [internal/ledger8-entry.ts](https://github.com/midnightntwrk/midnight-js/blob/98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f/packages/contracts/src/internal/ledger8-entry.ts) around 1150–1165. This is not a universal guarantee for every asynchronous API or release.

WPP consequently needs capture of the pre-operation baseline, the prepared successor PS, and subsequent submission/finalization observations. A cloud copy of the last persisted PS alone may miss a prepared/submitted successor. A submission timeout is not proof of failure. Confirmation metadata must come from the application's verified chain integration; a timestamp never proves freshness. The journal must retain failed/orphaned branches for explicit reconciliation, while activation selects a validated compatible state.

## Proposed WPP database arrangement

Google Drive is the ciphertext object store. WPP supplies the database semantics in the trusted local kernel and encrypted catalogs. The existing draft already has the essential three layers:

| Layer | Contents | Exposure and authority |
|---|---|---|
| Public bootstrap and package header | Wire/suite versions, random vault/scope/record/generation IDs, key epoch, salts/nonces, object kind | Public identifiers reveal grouping and timing; authenticate and match recovered root before trusting |
| Encrypted snapshot metadata | Network plus genesis identity where available, account binding scheme/value, app ID, contract address/code hash, exact PS IDs, codec/package/version/commit, lifecycle and transaction/block IDs, parent ciphertext digests | Supplies semantic binding absent from native export; available only after unlock |
| Encrypted catalog and local derived index | Immutable object references/digests, record ancestry, provider IDs/revisions, codec pins, conflicts, tombstones, durability observations | Supports discovery, filtering, restore selection and fork detection; must be reconstructible from authenticated records |

Implementation requirements to make this a usable database:

1. Define a logical record key by authenticated network/account/application/contract/state-set binding. Use opaque random IDs externally. Persist the schema version, serializer identity, native package version and source pin; reject unknown codecs before deserialization.
2. Separate **record identity** from immutable **generation identity** and content digest. A retried upload uses identical saved bytes. Re-encryption creates a new generation. Verify exact downloaded bytes and authentication before publishing catalog references as remotely verified.
3. Specify a crash-safe commit sequence: encrypted local journal entry → immutable remote object → read-back verification → immutable catalog generation → verified catalog read-back → durable journal receipt. A crash can leave an orphan object or catalog branch; it must not report a missing object as protected. This ordering is a WPP design proposal, not an upstream transaction guarantee.
4. Keep semantic indexes encrypted: app/contract/account/state labels, schema, transaction details, and user labels. Google filenames and searchable app properties should carry at most bounded opaque discovery identifiers. Drive queries find candidates; the unlocked local index answers application questions. Drive metadata is not authenticated truth.
5. Store Drive file IDs/revisions as destination-specific locations in the catalog, rather than in portable authenticated snapshot headers. Filenames can collide. Handle list pagination, duplicate candidates, deleted objects, and account switching. Verify ciphertext hashes regardless of provider revision metadata.
6. Keep catalog parents and independent record parents. Concurrent writes form visible immutable branches; do not trust a single mutable `latest` pointer or wall clock. Union authenticated inventory, expose conflicting semantic heads, and never merge private state without application-specific semantics.
7. Keep a bounded query vocabulary for beta: list applications/contracts, list records, list generations, filter lifecycle/schema, find missing/unverified objects, and choose an explicit restore candidate. Do not call this a distributed transactional database: Drive/catalog writes are separate failure domains, and freshness after total device loss remains limited by recovered observations.
8. Freeze the catalog entry schema and validation limits before implementation. The current draft caps catalogs at 1,000 entries and defers paginated profile details. Unknown pages, missing objects, unknown epochs and incomplete coverage must be explicit states. Keep retention/garbage collection disabled for beta.

The actual encrypted content for the native route is therefore `WPP authenticated header + Encrypt(WPP metadata + native encrypted export object)`, with a separately derived native export password as defined by the WPP draft. This deliberate nesting preserves native compatibility while authenticating WPP-specific bindings. It does not mean a native-export blob is itself a complete restorable database.

## Passport boundary and unresolved gates

The [pinned Passport SDK README](https://github.com/midnightntwrk/midnight-passport-sdk/blob/5dff89f62151de5ed91f88ef036c48899186a0e7/README.md) labels the SDK planning/spec, and its [beta scope](https://github.com/midnightntwrk/midnight-passport-sdk/blob/5dff89f62151de5ed91f88ef036c48899186a0e7/docs/beta-scope.md) defers witness provisioning. The architecture describes proposed storage/encryption boundaries, not proof of a released supported API. The repository also has packages; the README label alone is not proof that no implementation exists. This pass did not verify package publication or run Passport. Require a released version and direct boundary tests before integration. Its beta remote-proving posture also means WPP must not claim every witness always remains on the user's device across all proving configurations.

Remaining format gates: choose the supported Midnight version/era matrix; define actual application PS schema validators; verify native export/import structural equality and typed bigint/byte restoration; establish coherent capture ownership; freeze catalog/receipt schemas and bounded extension rules; exercise restart/partial-import/account/network/fork failures; and demonstrate a restored state can perform the next application operation. None of those runtime results is claimed by this research.
