# Choose Google Drive API scopes Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/api-specific-auth

Retrieved: 2026-09-19T16:29:33.980434+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document contains Google Drive API-specific authorization and
authentication information. Before reading this document, be sure to read the
Google Workspace's general authentication and authorization information at
[Learn about authentication and authorization](https://developers.google.com/workspace/guides/auth-overview).

## Configure OAuth 2.0 for authorization

To authorize your app, the Google Drive API requires you to define OAuth scopes in
two places: the Google Cloud console and your app.

In the Google Cloud console, you must declare the scopes your app needs in its OAuth
consent screen configuration. These are the highest level of permissions your
app can ever request. This serves as a formal request to Google, and the
declared scopes are what Google displays to users on the consent screen. It
allows the user to understand exactly what data and actions your app is
requesting access to.

[Configure the OAuth consent screen and choose scopes](https://developers.google.com/workspace/guides/configure-oauth-consent)
to define what information is displayed to users and app reviewers, and register
your app so that you can publish it later.

In your app, when you initiate the API, you must explicitly request the specific
scopes you need for that session. While the Google Cloud console defines the highest
level of permissions your app is allowed to request, the code determines the
actual permissions for a given user. This helps make sure the app only asks for
the permissions needed for a specific task.

You can declare one or more OAuth scopes at a time within your app's code as an
array.

The following code sample shows how to declare multiple OAuth scopes:

### Java

```
List<String> SCOPES = Arrays.asList(
  DriveScopes.DRIVE_FILE,
  DriveScopes.DRIVE_METADATA_READONLY
);
```

### Python

```
SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
]
```

### Node.js

```
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];
```

To see how scopes are declared and used in a full code sample, see
[Quickstarts](https://developers.google.com/workspace/drive/api/quickstart/java).

## Drive API scopes

To define the level of access granted to your app, you need to identify and
declare *authorization scopes*. An authorization scope is an OAuth 2.0 URI string
that contains the Google Workspace app name, what kind of data it accesses, and
the level of access. Scopes are your app's requests to work with Google Workspace data, including
users' Google Account data.

When your app is installed, a user is asked to validate the scopes used
by the app. Generally, you should choose the most narrowly focused scope
possible and avoid requesting scopes that your app doesn't require. Users more
readily grant access to limited, clearly described scopes.

Whenever possible, use non-sensitive scopes as they grant per-file access and
narrow access to specific features needed by an app.

If your public application uses scopes that permit access to
certain user data, it must complete a verification process. If you see **unverified
app** on the screen when testing your application, you must submit a
verification request to remove it. Find out more about
[unverified apps](https://support.google.com/cloud/answer/7454865)
and get answers to [frequently asked questions about app verification](https://support.google.com/cloud/answer/9110914) in the Help Center.

### Non-sensitive scopes

The following Drive API scopes are recommended for most use cases:

| Scope code | Description |
| --- | --- |
| `https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.appfolder` | View and manage the app's own configuration data in your Google Drive. |
| `https://www.googleapis.com/auth/drive.install` | Allow apps to appear as an option in the "Open with" or the "New" menu. |
| `https://www.googleapis.com/auth/drive.file` | Create new Drive files, or modify existing files, that you open with an app or that the user shares with an app while using the Google Picker API or the app's file picker. |

### Sensitive scopes

| Scope code | Description |
| --- | --- |
| `https://www.googleapis.com/auth/drive.apps.readonly` | View apps authorized to access your Drive. |

### Restricted scopes

| Scope code | Description |
| --- | --- |
| `https://www.googleapis.com/auth/drive` | View and manage all your Drive files. |
| `https://www.googleapis.com/auth/drive.readonly` | View and download all your Drive files. |
| `https://www.googleapis.com/auth/drive.activity` | View and add to the activity record of files in your Drive. |
| `https://www.googleapis.com/auth/drive.activity.readonly` | View the activity record of files in your Drive. |
| `https://www.googleapis.com/auth/drive.meet.readonly` | View Drive files created or edited by Google Meet. |
| `https://www.googleapis.com/auth/drive.metadata` | View and manage metadata of files in your Drive. |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | View metadata for files in your Drive. |
| `https://www.googleapis.com/auth/drive.scripts` | Modify your Google Apps Script scripts' behavior. |

The scopes in the preceding tables indicate their sensitivity, according to the
following definitions:

* **Non-sensitive**: These scopes provide the smallest scope of authorization
  and only require basic [OAuth App
  Verification](https://support.google.com/cloud/answer/13463073). For more
  information, see [Verification
  requirements](https://support.google.com/cloud/answer/13464321).
* **Sensitive**: These scopes provide access to specific Google user data that
  users authorize for your app. They require additional [OAuth App
  Verification](https://support.google.com/cloud/answer/13463073). For more
  information, see [Sensitive and Restricted Scope
  Requirements](https://support.google.com/cloud/answer/13464321#ss-rs-requirements).
* **Restricted**: These scopes provide wide access to Google user data and
  require restricted scope [OAuth App
  Verification](https://support.google.com/cloud/answer/13463073). For more
  information, see [Google API Services User Data
  Policy](https://developers.google.com/terms/api-services-user-data-policy) and [Additional Requirements
  for Specific API
  Scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes).
  See also the [Google Drive Terms of
  Service](https://support.google.com/drive/answer/2450387).

  If you store restricted scope data on servers (or transmit), then you must
  go through a security assessment.

If your app requires access to any other Google APIs, you can add those scopes
as well. For more information about Google API scopes, see [Using OAuth 2.0 to
Access Google APIs](https://developers.google.com/identity/protocols/oauth2).

For more information about specific OAuth 2.0 scopes, see [OAuth 2.0 Scopes for
Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes).

## Qualifications for restricted scopes

Only specific application types are permitted to use restricted scopes for
Google Drive. To qualify, your app must fall into one of the following
categories:

1. **Backup and sync**: Platform-specific and web apps that provide local sync
   or automatic backup of users' Drive files.
2. **Productivity and education**: Apps with a primary user interface that
   might involve interaction with Drive files, metadata, or
   permissions. These apps include task management, note-taking, workgroup
   communications, and classroom collaboration apps.
3. **Reporting and security**: Apps that provide user or customer insight into
   how files are shared or accessed.

To continue using restricted scopes, you should [prepare your app for restricted
scope
verification](https://support.google.com/cloud/answer/13464321#ss-rs-requirements).

## Migrate an existing app from restricted scopes

If your Drive app uses restricted scopes, we recommend migrating
to a non-sensitive Drive API scope. Using non-sensitive scopes, such
as `drive.file`, grants per-file and narrow access to specific features needed
by an app.

Many apps can transition to per-file access without any changes.

If you're using your own file picker, we recommend switching to the [Google Picker API](https://developers.google.com/workspace/drive/picker/guides/overview) which fully supports
different scopes.

### Benefits of the Drive file scope

Using the `drive.file` OAuth scope in combination with the Google Picker API
optimizes both user experience and safety for your app.

The `drive.file` OAuth scope lets users choose which files they want to share
with your app. This gives them more control and confidence that your app's
access to their files is limited and more secure. In contrast, requiring broad
access to all Drive files could discourage users from interacting
with your app.

The following are some reasons why you should use `drive.file` scope:

* **Usability**: The `drive.file` scope works with all [Drive API
  REST Resources](https://developers.google.com/workspace/drive/api/reference/rest/v3) which means you can use it the same way
  you use broader OAuth scopes.
* **Features**: The Google Picker API provides a similar interface to the
  Drive UI. This includes several views showing previews and
  thumbnails of Drive files, and an inline, modal window so
  users never leave the main app.
* **Convenience**: Apps can apply filters for certain Drive
  file types (such as Google Docs, Sheets, and photos) when
  using a [filter on Google Picker
  files](https://developers.google.com/workspace/drive/picker/guides/web-picker#filter-file-types).
* **Straightforward verification**: Since `drive.file` is non-sensitive, it
  allows for a more streamlined verification process.

## Securely store refresh tokens

To access private data using the Drive API, your app must obtain an
access token that grants access to that API. A single access token can grant
varying degrees of access to multiple APIs, governed by the scopes you request.

Because access tokens are short-lived, you must use refresh tokens for long-term
access to the Drive API. A refresh token allows your app to request
new access tokens.

Save refresh tokens in secure, long-term storage and continue to use them as
long as they remain valid.

For more information, see [Using OAuth 2.0 to Access Google
APIs](https://developers.google.com/identity/protocols/oauth2#5.-refresh-the-access-token,-if-necessary.).

## Related topics

* For an overview of authentication and authorization in Google Workspace,
  see [Learn about authentication &
  authorization](https://developers.google.com/workspace/guides/auth-overview).
* For an overview of authentication and authorization in Google Cloud, see
  [Authentication overview](https://cloud.google.com/docs/authentication).
* To learn more about service accounts, see [Service
  accounts](https://cloud.google.com/iam/docs/service-accounts).
* For help with troubleshooting, see [Resolve
  errors](https://developers.google.com/workspace/drive/api/guides/handle-errors).
