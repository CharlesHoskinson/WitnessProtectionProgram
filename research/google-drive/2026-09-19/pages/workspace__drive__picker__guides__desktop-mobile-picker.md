# Integrate the Google Picker into desktop and mobile apps Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker

Retrieved: 2026-09-19T16:28:46.710429+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document explains how to integrate the Google Picker into your desktop
and mobile apps using the Google Picker API.

The Google Picker API is a way to let users select or upload Google Drive
files. Users can grant permission to your desktop, mobile, or web app to access
their Drive data, providing a secure and authorized way to
interact with their files.

## Features

The Google Picker has several features:

* A similar look and feel to the [Google Drive
  UI](https://drive.google.com).
* Several views showing previews and thumbnail images of Drive
  files.
* Pre-filtered views that only show specific file types (like PDFs or images)
  or certain folders.
* A redirect to the Google Picker within a new tab in the user's
  default browser. To have the Google Picker API open in a client page, use
  the [Google Picker API for web apps](https://developers.google.com/workspace/drive/picker/guides/web-picker) instead.

Note that while you can select and upload files with the Google Picker,
it doesn't allow users to organize, move, or copy files from one folder to
another. To manage files, you must use either the [Google Drive API](https://developers.google.com/workspace/drive/api/guides/about-sdk) or the [Drive UI](https://developers.google.com/workspace/drive/api/guides/about-apps).

## Prerequisites

Apps using the Google Picker must abide by all existing [Terms of
Service](https://developers.google.com/workspace/terms). Most importantly, you must correctly identify
yourself in your requests.

You must also have a [Google Cloud project](https://developers.google.com/workspace/guides/create-project).

## Set up your environment

To start using the Google Picker API, you must set up your environment.

### Enable the API

Before using Google APIs, you need to turn them on in a Google Cloud project.
You can turn on one or more APIs in a single Google Cloud project.

* In the Google Cloud console, enable the Google Picker API.

  [Enable the API](https://console.cloud.google.com/apis/enableflow;apiid=picker.googleapis.com)

## Set up authentication and authorization

To authenticate end users and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.
  

### Authorize credentials for a desktop app

To create an OAuth 2.0 Client ID, follow these steps:

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > Select the recommended application type for your app.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

For apps to get authorization to files previously granted to them, you must use
the following steps:

1. You must obtain an OAuth 2.0 token with the `drive.file`, `drive`, or
   `drive.readonly` scope using these instructions: [Using OAuth 2.0 to Access
   Google APIs](https://developers.google.com/identity/protocols/oauth2). For more information on scopes,
   see [Choose Google Drive API
   scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
2. Pass the OAuth 2.0 token to the Drive API to read and modify files
   in which the user previously granted access.

### Authorize credentials for your mobile app

To create an OAuth 2.0 Client ID, follow the steps under [Authorize credentials
for a mobile app](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker#auth-cred-mobile).

### Authorize credentials for your web app

To create an OAuth 2.0 Client ID, follow the steps under [Authorize credentials
for a web app](https://developers.google.com/workspace/drive/picker/guides/web-picker#authorize-credentials).

## Display the Google Picker

The Google Picker API for desktop and mobile apps redirects to the
Google Picker within a new tab in the user's default browser. Once the
user grants access and picks the relevant files, the Google Picker
returns to the calling app through the callback URL.

* ![Google Picker UI authentication screen](/static/workspace/drive/images/desktop-mobile-picker-image-carousel-auth-trigger.svg)

  Authenticate your app by triggering the Google Picker.
* ![Google sign-in and permissions dialog box](/static/workspace/drive/images/desktop-mobile-picker-image-carousel-sign-in-dialog.svg)

  Sign in with Google and grant the requested permissions.
* ![Google Drive file selection interface inside the Picker](/static/workspace/drive/images/desktop-mobile-picker-image-carousel-file-selection.svg)

  Browse your Google Drive files in the Google Picker and select your desired item.
* ![Google sign-in and permissions dialog box](/static/workspace/drive/images/desktop-mobile-picker-image-carousel-sign-in-dialog.svg)

  Confirm your selection and tap Insert to add the file to your app.

### Integrate the Google Picker into your app

To allow users to grant access to additional files or to pick files for use in
your app flow, follow these steps:

1. Request access to the `drive.file` scope to open the OAuth 2.0 access page
   in a new browser tab using these instructions: [Using OAuth 2.0 to Access
   Google APIs](https://developers.google.com/identity/protocols/oauth2). For more information on scopes,
   see [Choose Google Drive API
   scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

   Note that only the `drive.file` scope is permitted for these apps and it
   can't be combined with any other scope.
2. The URL for the new browser tab accepts all [standard OAuth query string
   parameters](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server).

   You must append the `prompt` and `trigger_onepick` URL parameters to your
   OAuth 2.0 authorization URL request. Optionally, you can also customize the
   Google Picker with several other parameters:

   | Parameter | Description | Status |
   | --- | --- | --- |
   | `prompt=consent` | Prompt for file access. | Required |
   | `trigger_onepick=true` | Enable the Google Picker. | Required |
   | `allow_multiple=true` | If true, allow the user to select multiple files. | Optional |
   | `mimetypes=MIMETYPES` | A comma-separated list of [MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types) to filter the search results. If not set, files for all MIME types are displayed in the view. | Optional |
   | `file_ids=FILE_IDS` | A comma-separated list of file IDs to filter the search results. If not set, all files are displayed in the view. | Optional |
   | `allow_folder_selection=true` | If true, allow the user to also select folders. | Optional |

   The following sample shows an OAuth 2.0 authorization URL request:

   ```
   https://accounts.google.com/o/oauth2/v2/auth? \
   client_id=CLIENT_ID \
   &scope=https://www.googleapis.com/auth/drive.file \
   &redirect_uri=REDIRECT_URI \
   &response_type=code \
   &access_type=offline \
   &prompt=consent \
   &trigger_onepick=true
   ```

   Replace the following:

   * `CLIENT_ID`: Your app's client ID.
   * `REDIRECT_URI`: Where the authorization server
     redirects the user's browser after successful authentication. For
     example, `https://www.cymbalgroup.com/oauth2callback`.

     Select a `redirect_uri` that works with your application type and OAuth
     setup. The Google Picker imposes no additional restrictions.
3. Once the user grants access and picks the relevant files, OAuth redirects to
   the `redirect_uri` specified in the request with the following URL
   parameters appended:

   * `picked_file_ids`: If the user granted access and picked files, a
     comma-separated list of selected file IDs.
   * `code`: The access token or access code based on the `response_type`
     parameter set in the request. This parameter includes a new
     [authorization code](https://developers.google.com/identity/protocols/oauth2#installed).
   * `scope`: The scope(s) included in the request.
   * `error`: If the user cancelled the request within the consent flow, an
     error is shown.

   The following sample shows an OAuth 2.0 authorization URL response:

   ```
   https://REDIRECT_URI?picked_file_ids=PICKED_FILE_IDS&code=CODE&scope=SCOPES
   ```
4. Apps must exchange the authorization code from step 3 for a new OAuth 2.0
   token. For more information, see [Exchange authorization code for refresh
   and access
   tokens](https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code).
5. Apps can then use the file IDs from the URL parameter in step 3 and OAuth
   2.0 token obtained in step 4 to call the Drive API. For more
   information, see [Google Drive API
   overview](https://developers.google.com/workspace/drive/api/guides/about-sdk).

## Use the Google Picker with Android apps

You can also use the Google Picker in your Android mobile apps.

### Authorize credentials for a mobile app

To use the Google Picker in your Android app, you need to authorize
users using OAuth 2.0, similar to [desktop
apps](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker#authorize-credentials-desktop). For details on Android authentication,
see [Authorize access to Google user
data](https://developer.android.com/identity/authorization).

To display the Google Picker during authorization, create an
[`AuthorizationRequest`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationRequest)
and use the `PICKER_OAUTH_TRIGGER` resource parameter on the
[`AuthorizationRequest.ResourceParameter`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationRequest.ResourceParameter)
object.

When building the `AuthorizationRequest`:

* Use the `drive.file` scope.
* Call [`setOptOutIncludingGrantedScopes`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationRequest.Builder#public-authorizationrequest.builder-setoptoutincludinggrantedscopes-boolean-optoutincludinggrantedscopes)
  to `true` to make sure the token returned is only for the `drive.file` scope
  and not for any previously granted scopes.
* Set the [`AuthorizationRequest.Prompt`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationRequest.Prompt)
  field to `CONSENT` to prompt the user for consent even if it was granted
  before.
* You can optionally use the bitmap "OR" (`|`) operator to also set the
  `AuthorizationRequest.Prompt` field to `SELECT_ACCOUNT` to let the user
  select an account before the consent prompt is shown.

### Call the Google Picker

Similar to desktop apps, you can customize the Google Picker with
several optional parameters:

* `PICKER_ALLOW_MULTIPLE`: Allows users to select multiple files.
* `PICKER_MIMETYPES`: Accepts a comma-separated list of [MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types) to filter the search results. If not
  set, files for all MIME types are displayed in the view.
* `PICKER_FILE_IDS`: Accepts a comma-separated list of file IDs to filter the
  search results. If not set, all files are displayed in the view.
* `PICKER_ALLOW_FOLDER_SELECTION`: Allows users to also pick folders.

For more information on the optional parameters in desktop apps, see [Display
the Google Picker](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker#display-picker).

Once the user grants access and picks the relevant files, the
[`getTokenResponseParams`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationResult#public-bundle-gettokenresponseparams)
object of the
[`AuthorizationResult`](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationResult)
resource is returned. If the user granted access, this object contains the
`picked_file_ids` value, which is a comma-separated list of selected file IDs.

## Related topics

* [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
