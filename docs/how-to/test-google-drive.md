# Test the Google Drive prototype

This procedure exercises the M3 browser OAuth probe and a synthetic sealed blob.
It is not a full beta product. It is not a production UI. It is not a security approval.

Automated tests do not call live Google APIs. They do not discover credentials.

Access tokens and refresh tokens stay in process memory only.
They disappear when the process exits.
This prototype does not write tokens to an OS keychain or other persistent store.

## Build and run local tests

Use Node 24 or later. From the repository root, compile and run the suite:

```bash
npm test
```

That command runs `tsc` and then `node --test tests/*.test.mjs`.
The Google tests use a loopback listener on `127.0.0.1`.
They inject token exchange and Drive transport. They do not open a real Google session.

## Run the live smoke command

Complete publisher setup first. See [Create a Google Cloud project](create-google-project.md).
Place the Desktop OAuth client JSON outside this repository.

Build the project:

```bash
npm run build
```

Start the smoke command with that client file:

```bash
node scripts/google-drive-smoke.mjs --client-file /absolute/path/outside-repo/client.json
```

The command seals one synthetic fixture blob in the local kernel.
It then starts a loopback listener on `127.0.0.1` and a random port.
It opens the system browser to the Google consent page.
Grant `drive.file` only. Do not paste an access token. Do not copy a code.

If the opener is missing or fails, the command prints the authorization URL.
Open that URL in a normal browser. The listener still waits for the redirect.
The opener does not wait for the browser process to exit.
It does not kill a foreground browser during consent.

On success the command prints `connected`, then `uploaded`, then `verified`.
The receipt fields are file ID, SHA-256, and byte count only.
The command does not print tokens, roots, ciphertext buffers, or plaintext.
`verified` means the kernel opened the downloaded bytes, not the local input copy.

The Drive adapter checks sealed-package grammar before upload.
That check is not AEAD validation. The adapter has no decryption key.

## WSL loopback limit

WARNING: Keep the listener on `127.0.0.1`. Do not bind `0.0.0.0`.

If the consent page runs in Windows while Node runs in WSL, `127.0.0.1` may not reach the listener.
The callback then fails. This prototype does not add a fallback bind address.
If the Windows browser cannot reach WSL loopback, the probe cannot complete.

## Failures

Errors use static codes such as `GOOGLE_OAUTH_DENIED` and `GOOGLE_DRIVE_READBACK`.
A create response of HTTP 200 is not a verified backup.
Only a matching remote read-back of the sealed bytes is `verified`.
