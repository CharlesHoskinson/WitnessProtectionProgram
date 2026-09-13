# Login, storage, and Midnight integrations

Status: proposed integrations. No user account has been linked and no provider developer application has been registered by this work.

## One-click provider login

User requirement, 2026-09-13: use the easy login supplied by Apple, Microsoft, Google, and Dropbox so clicking login links the account to WPP.

Show the provider's official sign-in button and open its native authorization session or system browser. Reuse the user's existing provider session where available. The provider may still require account selection, MFA, or consent; “one click” starts that flow and does not bypass those controls. Return directly to WPP and show the connected account, destination and backup state. No manual API keys, pasted access tokens, app passwords, developer-console work, or provider passwords entered into WPP are part of the consumer flow.

WPP's publisher registers and maintains the OAuth applications, redirect URIs, consent branding, platform associations and necessary provider review. Client IDs may ship in the application; confidential client secrets or Apple signing keys must not ship in desktop/browser bundles. Where a platform requires a confidential exchange, use a minimal authentication service with no witness/root access and document its token exposure. Native public-client PKCE flows keep storage tokens on the device where supported. This work does not create that service.

| Button | Identity / authorization mechanism | Storage permission | Completion condition |
|---|---|---|---|
| Continue with Google | Google Identity Services/OAuth authorization code flow; OIDC where WPP needs identity | `drive.file` for files WPP creates or the user explicitly selects | Validate provider result, resolve permitted destination, perform encrypted write/read probe |
| Continue with Microsoft | MSAL, authorization code + PKCE, OIDC | Delegated `Files.ReadWrite.AppFolder`; request only necessary identity/offline scopes | Confirm selected drive/account, resolve app folder, encrypted probe |
| Continue with Dropbox | Dropbox OAuth authorization code + PKCE; OIDC if identity is needed | App Folder access with necessary file metadata/content scopes | Confirm account, resolve app root, encrypted probe |
| Continue with Apple | AuthenticationServices / Sign in with Apple | Separate native iCloud Drive folder access through document picker/security-scoped access | Validate identity; grant/select iCloud folder; distinguish local save from observed remote backup |

Apple sign-in authenticates a WPP user; it does not issue a general iCloud Drive read/write OAuth token. On supported Apple platforms the next step uses the system Files/folder picker, retaining scoped access according to platform rules. Where native folder integration is unavailable, allow a user-selected synced folder or manual encrypted-file export/import and label its capability accurately. A web “Continue with Apple” button cannot by itself deliver background access to arbitrary iCloud Drive files. CloudKit is app-container storage and is not substituted silently for the requested existing iCloud Drive account.

WPP remains usable with local encrypted export without a new mandatory central WPP account. Provider login links a storage identity to a local WPP vault; it never derives or unlocks the WPP encryption root. Bitwarden unlock is a separate ceremony. A provider can be unlinked or changed while encrypted packages and root ownership remain independent.

### Callback and account-linking rules

Use provider-supported SDKs and the system browser, authorization code + PKCE for public OAuth clients, exact registered redirect matching, per-attempt state, and OIDC nonce where applicable. Validate signature, issuer, audience, expiry and nonce before accepting ID tokens. Bind code exchange to the initiating session, provider and redirect. Never treat an ID token as a Drive access token, or an email address as the account's immutable identifier.

Bind connections to issuer/subject and provider account identifiers. Do not automatically merge Apple private-relay email, a Google email and a Microsoft email into one account. Adding an alternative login to an existing WPP profile requires a fresh authenticated session and explicit linking. Account switch, cancellation, denied permission, revoked consent and expired refresh tokens return to a clear disconnected/reconnect state without deleting existing backups.

Store refresh tokens in the OS credential store; browser variants require an explicitly reviewed platform/token design. Do not include tokens in portable packages, logs, analytics, graph artifacts or crash reports. Request offline access only when automatic backup needs it. Reconnection on a new device obtains new tokens instead of transferring old sessions. An expired identity session, a locked Bitwarden vault, and a revoked storage token are different conditions in the UI.

## Storage adapter contract

An adapter offers `connect`, `disconnect`, `capabilities`, `putImmutable`, `get`, `listPage`, `stat`, and explicit `delete`. These are proposed semantic operations, not published TypeScript interfaces. It accepts bytes and opaque IDs only, and returns provider account identity, object/revision IDs, pagination cursor, and observed receipts. The kernel creates and authenticates all packages and catalogs.

`capabilities` declares whether the adapter can observe remote presence, perform conditional creation/update, resume uploads, enumerate all objects, and maintain stable access across restarts. Do not emulate an unavailable guarantee by returning success. Timeouts after upload are resolved by locating and verifying the immutable object before retry; a conflicting object under the same intended ID is an integrity error.

| Provider | Preferred storage location | Portability and failure details |
|---|---|---|
| Google Drive | User-visible WPP folder, narrow `drive.file` authorization | User selects existing backup files through supported picker access on another client. Drive permits duplicate names: store object IDs and authenticate candidates. App-private `appDataFolder` may be an optional cache, never the sole portable copy |
| OneDrive | Graph `special/approot` under delegated app-folder permission | App folder is tied to the app and counts against quota. A different wallet/client may need explicit file selection/export with separate consent. Verify actual conditional-write and account-type support during implementation |
| Dropbox | App Folder, content/metadata scopes, offline authorization only when needed | Preserve revisions and use supported conditional writes. Another app ID does not inherit the old app's folder permission; transfer files explicitly |
| iCloud Drive | User-selected WPP folder through native document/file APIs | Security-scoped authorization may need renewal. A local write, placeholder file, or sync-in-progress item is not remote durability. Report unsupported verification honestly |
| Local export | User-selected directory or portable archive | Atomic local write and re-read verification; external copy is the user's second recovery path. No automatic remote-durability claim |

Provider links are account/folder/object locators kept in the encrypted catalog. Do not rely on a public share URL or put a bearer token in a link. Cloud object identifiers are location-specific; package bytes and cryptographic identity are storage-independent.

## Midnight.js integration

The inspected provider supports `setContractAddress`, `get`, `set`, `remove`, `exportPrivateStates`, and `importPrivateStates`, with separate signing-key methods. WPP wraps application lifecycle boundaries, not the public network. Pin producer package/version/commit and the native export adapter used for a snapshot.

Snapshot export/import is the initial path. Automatic capture requires integration with each application's state lifecycle so a coherent snapshot is associated with the right transaction observation. Do not assume a provider's raw write means a confirmed transaction. Quiesce a contract-scoped provider while snapshotting and use independent provider instances to prevent mutable scope races. Contract upgrade and codec migration tests are mandatory.

## Future Passport integration

At inspection time, the Passport SDK describes planned packages and a reduced beta. Its architecture identifies a trusted kernel, witness lifecycle, recovery, and storage/sync seams. Its storage design distinguishes regenerable state, irreplaceable inputs, recovery material and caches, with durable redundant backup for irreplaceable data.

Integrate in two places:

1. A kernel-owned WPP codec/key component seals and opens private state only after Passport's required ceremony and scoped authorization. It uses ephemeral handles for proving; a storage adapter never receives plaintext. Existing passkey-PRF/password local wrapping can protect a device-held WPP root, while Bitwarden is an explicit independent recovery route. This does not replace Passport's account custody or guardian recovery.
2. WPP storage adapters implement the eventual stable ciphertext storage/sync seam. A dApp calls the authorized connector surface; it receives protection status, not root keys or unrestricted private-state export. Respect beta exclusions until actual witness/storage interfaces are released and reviewed.

The initial standalone companion will not claim that importing a package grants a Passport account, that social login authorizes a Midnight transaction, or that a new device may bypass Passport's grants and ceremonies.

## Official source references

Observed 2026-09-13; upstream APIs and requirements must be rechecked when implementation begins.

- [Google OAuth](https://developers.google.com/identity/protocols/oauth2) and [native applications](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [app-data restrictions](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) and [OneDrive app folders](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)
- [Dropbox OAuth](https://developers.dropbox.com/oauth-guide) and [OpenID Connect](https://developers.dropbox.com/oidc-guide)
- [Sign in with Apple authentication](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple) and [Apple document browser](https://developer.apple.com/documentation/uikit/uidocumentbrowserviewcontroller)
- [Bitwarden Password Manager CLI](https://bitwarden.com/help/cli/) and [Secrets Manager SDK](https://bitwarden.com/help/secrets-manager-sdk/)

Repository-specific source pins and graph coverage are recorded in [research](../research/README.md).
