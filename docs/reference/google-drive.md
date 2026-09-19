# Google Drive beta requirements

Status: planned Google Drive beta; researched on 2026-09-19. No application integration is implemented or tested yet.

## Drive adapter checklist

| Operation | Google API/docs | WPP requirement |
| --- | --- | --- |
| Connect/account details | [about.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get) | Request explicit fields and bind the returned Drive account identifier. |
| Create destination | [Folders](https://developers.google.com/workspace/drive/api/guides/folder), [files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) | Create an ordinary visible folder and retain its ID. |
| Put ciphertext | [Uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [files.generateIds](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) | Persist a pre-generated Drive ID with the binary upload job. Retry under the same ID; after timeout/409, fetch and verify the existing object. A conflict response alone proves no content match. |
| Read/verify | [Downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [files.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) | Download blob bytes with `alt=media`, enforce bounds, and authenticate in the kernel. Metadata/checksums do not replace authentication. |
| Enumerate/discover | [Search](https://developers.google.com/workspace/drive/api/guides/search-files), [files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) | Follow every page; handle duplicate names, moved files, missing permission and incomplete results. Search filters do not establish authenticity. |
| Track updates | [Changes](https://developers.google.com/workspace/drive/api/guides/manage-changes) | Optional optimization. Rebuild from verified accessible objects if an index/token is lost. First beta need not introduce public webhooks. |
| Reconnect/unlink | [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices), [native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app) | Keep tokens in the OS store; refresh quietly. On `invalid_grant`, require reconnect. Revoke/erase credentials on unlink without silently deleting backups; test effects on other clients sharing a grant. |
| Retry/fail | [Errors](https://developers.google.com/workspace/drive/api/guides/handle-errors), [limits](https://developers.google.com/workspace/drive/api/guides/limits) | Classify error reasons. Back off on transient/rate-limit failures; surface storage quota, denied access and exhausted retries. |

Drive does not enforce WPP immutability: users or other authorized apps may change/delete files. Use new authenticated objects/catalog versions rather than overwriting history, and preserve conflicts. Portable discovery cannot depend solely on app-private `appProperties`. Keep witnesses, recovery roots and sensitive account metadata out of filenames, descriptions, search properties and analytics. [Custom properties](https://developers.google.com/workspace/drive/api/guides/properties), [file resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

## Beta acceptance tests

- [ ] New/returning Google sessions, account selection, MFA, cancellation, denied permission, browser launch failure, and automatic return to WPP.
- [ ] Callback forgery, state mismatch/replay, wrong client/redirect/verifier, reused code, missing scope and concurrent attempts fail safely.
- [ ] If ID tokens are introduced, validate signature, issuer, audience, expiry and nonce separately; reject mismatch with the connected Drive account.
- [ ] Native Picker uses `drive.file` alone, exchanges its new code, handles multiple selection/cancellation, and grants the files actually selected.
- [ ] Root-locked and Drive-disconnected states remain distinct; Google linking never unlocks the root.
- [ ] Synthetic package/catalog upload, remote read-back and kernel authentication; no plaintext or secrets in adapter inputs or diagnostics.
- [ ] Restart during upload, lost success response, 409 conflict, partial upload, expired upload session, pagination, duplicate names, moved folders and conflicting catalogs.
- [ ] Account switch, revoked consent, token expiry, missing refresh token, seven-day Testing expiry, Workspace administrator denial, full storage, rate limits and offline operation.
- [ ] Fresh device with the same WPP app, then a separately registered client with explicitly granted files. Verify folder-selection behavior rather than assuming recursive access.
- [ ] Restore through Bitwarden and the independent recovery pack. Missing objects, tampering, wrong account/network/contract, unsupported codecs and stale/conflicting state must not activate silently.
- [ ] **Backup verified** follows remote read-back and authentication; **Restore checked** follows an isolated restore.
- [ ] Unlink removes credentials/stops jobs without deleting recovery material. Account switching cannot redirect queued uploads without an explicit destination decision.

Real beta credentials, users, platform callbacks and Drive behavior have not been exercised by this research. Format, kernel and recovery milestones remain dependencies. Documentation is implementation evidence, not a passing integration test.

Sources: [collection and coverage](https://github.com/CharlesHoskinson/WitnessProtectionProgram/tree/main/research/google-drive). Local snapshots and manifests are under `research/google-drive/2026-09-19/` in the checkout.
