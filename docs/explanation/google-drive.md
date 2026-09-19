# Why the Google Drive connection works this way

Status: planned Google Drive beta; researched on 2026-09-19. No application integration is implemented or tested yet.

## One-click experience

Start with one prominent Google action in WPP's backup setup. The user completes any Google account selection, consent, or MFA in the system browser, returns directly to WPP, and sees the connected account and backup status. Reuse an existing provider session where Google allows it. Users never register a developer app, enter an API key, copy an authorization code, or paste a token.

Use Google-approved branding. A genuine authentication button may say **Continue with Google**. For a storage-only beta, **Back up to Google Drive** with the approved Drive logo more precisely describes the action. This is a wording recommendation, not a replacement of the single-action requirement. A Google Identity Services sign-in button returns an identity credential, not Drive permission; do not introduce a mandatory WPP account just to display one. Final UI copy must match the actual operation. [Sign-in branding](https://developers.google.com/identity/branding-guidelines), [Drive branding](https://developers.google.com/workspace/drive/api/guides/branding), [authentication versus authorization](https://developers.google.com/identity/oauth2/web/guides/overview).

One click starts the flow; it cannot bypass Google's prompts. Linking Drive does not unlock Bitwarden or the WPP root. A synthetic encrypted connectivity probe establishes storage access, but **Backup verified** requires read-back and authentication of the actual package and catalog. **Restore checked** requires an isolated restore check.

## Recommended architecture

The research baseline is the standalone desktop companion proposed in M2, with encryption in the trusted local kernel and tokens in the OS credential store. No desktop framework or operating-system support matrix is selected by this document.

Use a publisher-owned native OAuth client, the external system browser, authorization code flow, PKCE S256, and fresh single-use state. Desktop loopback callbacks remain documented; do not copy those settings into Android/iOS clients. Embedded webviews and manual out-of-band code copying are unsuitable. Google explicitly says installed apps do not support incremental authorization; web GIS guidance cannot simply be transplanted into desktop code. [Native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

Request `https://www.googleapis.com/auth/drive.file`. Google lists it as a recommended non-sensitive scope covering files WPP creates and files explicitly granted to it. Avoid full-drive scopes. Use a visible WPP folder in My Drive for the first beta. Shared-drive support needs separate acceptance tests. App-private `appDataFolder` cannot be the sole portable copy. [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [app data](https://developers.google.com/workspace/drive/api/guides/appdata).

### New backup

1. The primary action opens native OAuth for `drive.file` with offline access for automatic backup. Request consent/account selection when needed for initial authorization, missing refresh credentials, reconnect, or explicit account switching; do not force them on every normal launch.
2. Validate callback state and bind exchange to the initiating attempt, PKCE verifier, client and redirect. Check the granted scope and obtain the authenticated Drive user's identity. Email is display information, not a durable account key.
3. Discover an already-authorized WPP destination or create the default visible folder automatically. New users need no mandatory folder chooser. Retain Drive IDs; duplicate names do not identify a destination.
4. With the WPP root available, encrypt locally, persist the ciphertext upload job safely, upload, download and authenticate in the kernel. Publish an authenticated catalog only after verifying its referenced objects.
5. Show the connected account, destination, last verified backup, and any outstanding restore check. Distinguish connected-but-locked, uploading, verified, incomplete and reconnect-required states.

Steps 1–2 follow [native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [about.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get), and [user information](https://developers.google.com/workspace/drive/api/guides/user-info). The persistence/verification sequence is a WPP design requirement, not a Google durability guarantee.

### Restore or select an existing backup

For existing files the app cannot already access, Google's current native Picker combines authorization and file selection in the system browser. The documented request uses `prompt=consent` and `trigger_onepick=true`, with optional multiple-file or folder selection. Its callback returns `picked_file_ids` and a new authorization code. Exchange the code, validate the attempt and actual API access, and treat all callback fields as untrusted input. [Native Picker](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

**The native Picker request permits only `drive.file`; it cannot combine this with other scopes.** Do not add `openid`, `email`, or `profile` or carry other scopes into this request. If a future product needs separate Google identity sign-in, implement and bind it explicitly. The storage-only beta can identify the connected Drive user through Drive; its account identifier is not an OIDC subject or a Midnight account identity.

Existing permissions may support direct API access after reacquiring tokens, so Picker is not required on every reconnect. A different wallet/client must obtain its own access. Do not assume selecting a folder recursively grants access to every existing descendant: test actual visibility and provide explicit file selection/import. An inaccessible object produces an incomplete restore result, not a successful empty restore. Google's selection documentation does not establish WPP's cross-client recovery completeness.

Download catalog and package bytes, authenticate them, validate account/network/contract/codec compatibility, stage the restore, and activate only after the kernel checks pass. Drive permission never authorizes wallet spending.

### Web alternative

If the beta becomes a web application, revisit token storage and the local kernel architecture first. GIS authentication and authorization are separate operations. GIS code-model authorization uses a backend exchange; the browser token model does not provide durable refresh-token storage for unattended backup. Web Picker uses a different integration with a token, project settings and restricted API key. Do not ship a confidential web-client secret in browser code. [Authorization models](https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model), [code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model), [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [web Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker).


Next: [publisher setup](../how-to/configure-google-beta.md) and [adapter requirements](../reference/google-drive.md).
