# Understanding Witness Protection Program

Witness Protection Program (WPP) is a local encryption and recovery layer for
Midnight private application data. It is being built so that replacing a device
does not mean losing application state that only that device held.

The repository contains working developer components. The complete consumer
application remains in development. The user journeys on this page describe the
intended product, not a currently available installation procedure.

## What WPP protects

A Midnight application can depend on private inputs and state that are absent
from public chain history. A witness supplies private information to a proof;
the application's stored private state can contain information needed to build
future witnesses. Those are related concepts, but not every private-state record
is itself a proof witness.

WPP protects data supplied by a compatible application through an explicit
capture and codec boundary. It cannot discover every application's secrets by
connecting to the blockchain. Application integration must identify what data is
irreplaceable and when it needs protection.

For example, a user may recover their wallet after losing a laptop yet still
lack a private application record required for the next operation. WPP's job is
to recover the protected record and validate its destination. The application
must then demonstrate that the restored state supports the next valid operation.
Decrypting a file alone does not establish that outcome.

## Four different kinds of recovery

| Recovery | What it restores | What it does not establish |
| --- | --- | --- |
| Wallet recovery | The wallet's account or signing capability | Availability of private application records |
| WPP key recovery | Roots needed to decrypt protected WPP objects | Availability of the encrypted objects themselves |
| Private-state restoration | Captured application data from encrypted backups | That the chosen state is current or compatible with every application version |
| Chain synchronization | The public chain view needed by the application | Private bytes that were never published |

A useful recovery therefore needs the correct WPP keys, access to the encrypted
objects, a compatible application, and validation of the relevant account,
network, and contract. Google authentication supplies storage access. It does
not replace WPP key recovery or authorize wallet spending.

## Connecting an ordinary Google account

The intended beta starts with a **Connect Google** action. WPP opens the system
browser, Google handles account selection, consent and MFA, and the application
receives authorization through its callback. Users should not handle tokens.

The publisher configures the OAuth application and satisfies the applicable
Google release requirements. A consumer should not need a Google Cloud project,
a developer subscription, or their own OAuth client. The developer setup guides
in this repository exist to test and publish WPP; they are not the consumer
onboarding design.

Google Drive is the first destination. Microsoft, Dropbox, and native iCloud
Drive access are later integrations. Apple sign-in does not itself grant iCloud
file access; that destination requires a separate supported native file boundary.

## From private state to a verified backup

The intended application pipeline has five stages:

1. **Capture.** Obtain a consistent application-authorized record through its
   supported interface. Preserve native export field values and codec versions.
2. **Encrypt locally.** The trusted kernel validates the record and seals a WPP
   package. Storage adapters receive encrypted bytes rather than plaintext or
   recovery roots.
3. **Persist locally.** Retain the exact encrypted bytes in the local journal so
   an interrupted upload can be retried without losing the pending package.
4. **Publish.** Upload referenced packages and catalog shards before publishing
   the root that names them.
5. **Verify.** Read back the selected objects and check their byte bindings and
   authenticated contents before reporting the corresponding backup guarantee.

The journal and encryption components exist today. The complete coordinated
pipeline, including native application capture and cloud publication, is still
being integrated. A successful local write means local persistence; an upload
response alone does not prove recoverability.

For applications that create irreplaceable private state, the integration must
also decide when an operation may proceed relative to durable backup. A generic
file uploader cannot impose that lifecycle rule after the fact.

## Why encrypted blobs need a catalog

A directory of encrypted files does not explain which record belongs to which
application, which revision supersedes another, or whether every required file
is present. WPP uses encrypted catalog metadata to make those relationships
explicit while keeping witness contents opaque to storage providers.

The storage structure is:

```text
selected checkpoint identifying an encrypted root
  -> authenticated catalog root
     -> authenticated catalog shards
        -> complete encrypted application packages
```

The root binds the exact encrypted children. Shards contain records and storage
references. The implementation checks grammar, routing, bounds, and revision
consistency separately from cryptographic authentication; both are necessary.
The WPP wrapper is its own draft format, not a modification of Midnight's native
export standard.

Sharding reduces the amount of catalog data that needs replacement after a
small change. The intended coordinator can retain exact authenticated ciphertext
for unchanged shards and encrypt changed shards afresh. It does not use
convergent encryption or public plaintext hashes to deduplicate private witnesses.

A local synthetic experiment with 10,000 records measured median rewritten bytes
per update of 2,995,039 for a flat catalog and 63,067 for a fixed 64-shard layout,
including its root. The production planner instead splits by bounded encoded
size. These measurements motivate the design; they are not Google Drive speed
measurements. Shards also introduce more objects and reads. See
[storage layout](storage-layout.md) for the workload and limitations.

Catalog root/shard encryption and validation are implemented. Ordinary cloud
publication and cold restore using those components remain integration work.
Physical packs are a separate experimental optimization, conditional on provider
measurements.

## Restoring without silently choosing the wrong state

The intended restore starts by unlocking WPP recovery material and reconnecting
the selected storage account. WPP discovers candidate histories, authenticates
the selected catalog and referenced objects, and validates the destination
application context. Native state is staged and checked before activation.

Cryptographic validity answers whether bytes authenticate under the expected
keys and bindings. It does not answer whether a provider returned the latest
history. Two devices can also create conflicting valid histories. WPP must retain
those conflicts and report missing ancestry or uncertain freshness explicitly.
Choosing the largest timestamp would hide the problem.

A restore check should ultimately demonstrate that the compatible application
can continue from the recovered state. The existing synthetic Drive test proves
upload, download, byte equality and authenticated decryption of one package. It
does not yet prove that complete application outcome.

## Keys, storage, and trust

WPP's random recovery root is independent of the wallet's signing seed. The
kernel derives separate encryption keys for its records. Recovery packs provide
an implemented independent encrypted recovery mechanism. The planned Bitwarden
integration stores a minimal root/recovery record in an explicitly selected
secure note; it does not export the entire vault or derive the WPP root from the
Bitwarden master password. That integration is not implemented yet.

Cloud storage holds encrypted packages and encrypted catalog contents. Providers
can still observe sizes, timing and access patterns, and can delete or withhold
objects. Encryption cannot repair missing backups. A compromised unlocked
endpoint can expose plaintext and keys.

For the detailed boundaries, read [security and recovery](../security-and-recovery.md).
For exact implemented interfaces, use the [reference documentation](../reference/index.md).
For remaining acceptance work, consult the repository's `ROADMAP.md`.
