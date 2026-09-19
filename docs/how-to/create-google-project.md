# Create a Google Cloud project for WPP

Use this publisher procedure once. Ordinary users only complete Google browser consent.
They do not create a Cloud project. They do not run `gcloud`. They do not download client JSON.
They do not copy tokens.

Sign in to Google Cloud yourself. This tool does not run `gcloud auth login`.

The application name is Witness Protection Program.
Supply your own publisher contact data in Cloud Console. Do not invent an identity.

## Preview the commands

From the repository root, after `npm run build`, pass an explicit project ID:

```bash
node scripts/google-project-setup.mjs --project-id your-project-id
```

The project ID must use Google project ID grammar.
It must be 6 to 30 characters. It must start with a letter.
It may contain lowercase letters, digits, and hyphens. It must not end with a hyphen.

The dry run prints intended `gcloud` commands and Console URLs.
It does not spawn `gcloud`. It does not change a project.

## Apply project creation

Sign in with an account that can create projects:

```bash
gcloud auth login
```

Then apply only the requested project ID:

```bash
node scripts/google-project-setup.mjs --project-id your-project-id --apply
```

`--apply` uses the active `gcloud` account.
It creates the project if that ID is absent.
It enables `drive.googleapis.com` on that project.
It does not set the global gcloud project.
It does not enable billing. It does not choose an organization.
It does not accept terms. It does not create a service account.
It does not delete a project.

If no account is signed in, the command fails with `GOOGLE_GCLOUD_AUTH` before writes.

## Finish OAuth client setup in Console

The remaining steps still need the signed-in Cloud Console.
This tool does not create a consumer OAuth client through an API.
Do not use IAP clients. Do not use workforce clients.

1. Open the printed branding URL. Set the application name to Witness Protection Program.
2. Enter the publisher contact data that you own.
3. Open the audience URL. Choose External audience.
4. Add temporary test users while the app is in Testing.
5. Create a Desktop installed-app OAuth client.
6. Download the client JSON outside this repository. Do not commit it.

Retail Google accounts need production publishing and Google verification.
Testing grants expire. Do not treat Testing as a product release.

Organization or folder placement is deferred.

After the client file exists, run the [Google Drive probe](test-google-drive.md).
