# Use Google Picker API features in web apps Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/picker/guides/web-picker-sample

Retrieved: 2026-09-19T16:30:31.087747+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document explains how to use Google Picker API features such as turning on
multi-select, hiding the navigation pane, and choosing the user account with the
app's current OAuth 2.0 token.

Note: The
[`@googleworkspace/drive-picker-element`](https://npmjs.com/package/@googleworkspace/drive-picker-element)
web component offers an additional way to integrate the Google Picker API into your web apps. For more
information, see [Use the Google Picker web component](https://developers.google.com/workspace/drive/picker/guides/web-component).

## Prerequisites

For this example, you need to configure the following in your Google Cloud project:

* **Enable the APIs:** Enable both the **Google Picker API** and the
  **Google Drive API**:

  1. In the Google Cloud console, go to Menu
     > **APIs & Services**
     > **Library**.

     [Go to Library](https://console.cloud.google.com/apis/library)
  2. Search for and enable both the **Google Picker API** and the
     **Google Drive API**.
* **Create an API key:**

  1. In the Google Cloud console, go to Menu
     > **APIs & Services**
     > **Credentials**.

     [Go to Credentials](https://console.cloud.google.com/apis/credentials)
  2. Click **Create credentials** >
     **API key**.
  3. (Recommended) To secure your API key with restrictions, click
     **Edit API key**:

     + **Application restrictions**: Under **Set an application
       restriction**, select **Websites**. In **Website restrictions**,
       add your app's origin (for example, `https://example.com/*` or
       `http://localhost/*`) **and** `https://docs.google.com/*` to the
       list of specified websites. Because the Google Picker
       renders in an iframe hosted on `docs.google.com`, requests fail with
       an `API developer key is invalid` error if
       `https://docs.google.com/*` isn't allowed.
     + **API restrictions**: Under **API restrictions**, select
       **Restrict key**, then select both the **Google Picker API** and the
       **Google Drive API**.
* **Create an OAuth 2.0 Client ID:**

  1. In the Google Cloud console, go to Menu
     > **APIs & Services**
     > **Credentials**.
  2. Click **Create credentials** >
     **OAuth client ID**.
  3. Select **Web application** and add your authorized JavaScript origins.
* **Locate the App ID:**

  1. In the Google Cloud console, go to Menu
     > **IAM & Admin**
     > **Settings**.

     [Go to Settings](https://console.cloud.google.com/iam-admin/settings)
  2. Use the **project number** for the app ID.

The same Google Cloud project must contain both the client ID and the app ID as it's
used to authorize access to a user's files.

## Create an image selector app within an HTML document

The following code sample shows how to use an image selector or upload page that
users can open from a button in a web app.

Create a standard HTML document to host the Google Picker:

```
<!DOCTYPE html>
<html>
<head>
  <title>Google Picker API Quickstart</title>
  <meta charset="utf-8" />
</head>
<body>
<p>Google Picker API Quickstart</p>

<!--Add buttons to initiate auth sequence and sign out.-->
<button id="authorize_button" onclick="handleAuthClick()">Authorize</button>
<button id="signout_button" onclick="handleSignoutClick()">Sign Out</button>

<pre id="content" style="white-space: pre-wrap;"></pre>
```

Use JavaScript to call the Google Picker API:

```
<script type="text/javascript">
  /* exported gapiLoaded */
  /* exported gisLoaded */
  /* exported handleAuthClick */
  /* exported handleSignoutClick */

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';

  // Replace with your client ID and API key from https://console.cloud.google.com/.
  const CLIENT_ID = 'CLIENT_ID';
  const API_KEY = 'API_KEY';

  // Replace with your project number from https://console.cloud.google.com/.
  const APP_ID = 'APP_ID';

  let tokenClient;
  let accessToken = null;
  let pickerInited = false;
  let gisInited = false;

  document.getElementById('authorize_button').style.visibility = 'hidden';
  document.getElementById('signout_button').style.visibility = 'hidden';

  /**
   * Callback after api.js is loaded.
   */
  function gapiLoaded() {
    gapi.load('client:picker', initializePicker);
  }

  /**
   * Callback after the API client is loaded. Loads the
   * discovery doc to initialize the API.
   */
  async function initializePicker() {
    await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
    pickerInited = true;
    maybeEnableButtons();
  }

  /**
   * Callback after Google Identity Services are loaded.
   */
  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
  }

  /**
   * Enables user interaction after all libraries are loaded.
   */
  function maybeEnableButtons() {
    if (pickerInited && gisInited) {
      document.getElementById('authorize_button').style.visibility = 'visible';
    }
  }

  /**
   *  Sign in the user upon button click.
   */
  function handleAuthClick() {
    tokenClient.callback = async (response) => {
      if (response.error !== undefined) {
        throw (response);
      }
      accessToken = response.access_token;
      document.getElementById('signout_button').style.visibility = 'visible';
      document.getElementById('authorize_button').innerText = 'Refresh';
      await createPicker();
    };

    if (accessToken === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({prompt: ''});
    }
  }

  /**
   *  Sign out the user upon button click.
   */
  function handleSignoutClick() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken);
      accessToken = null;
      document.getElementById('content').innerText = '';
      document.getElementById('authorize_button').innerText = 'Authorize';
      document.getElementById('signout_button').style.visibility = 'hidden';
    }
  }

  /**
   *  Create and render a Google Picker object for searching images.
   */
  function createPicker() {
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('image/png,image/jpeg,image/jpg');
    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setOAuthToken(accessToken)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
  }

  /**
   * Displays the file details of the user's selection.
   * @param {object} data - Contains the user selection from the Google Picker.
   */
  async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
      let text = `Google Picker response: \n${JSON.stringify(data, null, 2)}\n`;
      const selectedDoc = data[google.picker.Response.DOCUMENTS][0];
      const fileId = selectedDoc[google.picker.Document.ID];
      console.log(fileId);
      const res = await gapi.client.drive.files.get({
        'fileId': fileId,
        'fields': '*',
      });
      text += `Drive API response for first document: \n${JSON.stringify(res.result, null, 2)}\n`;
      window.document.getElementById('content').innerText = text;
    }
  }
</script>
<script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
<script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>
```

Replace the following:

* CLIENT\_ID: the client ID that you created when you
  authorized [OAuth 2.0
  credentials](https://developers.google.com/workspace/guides/create-credentials#web-application) for the
  web application.
* API\_KEY: the [API key
  credentials](https://developers.google.com/workspace/guides/create-credentials#api-key)
  you created.
* APP\_ID: the project number from Google Cloud project.

The `setOAuthToken` function allows an app to use the current auth token to
determine which Google Account the Google Picker uses to display the files. If
a user is signed in with multiple Google Accounts, the Google Picker can
display the files of the appropriate authorized account.

Close the HTML document:

```
</body>
</html>
```

After obtaining the file ID from the Google Picker when opening files,
an app can then fetch the file metadata and download the file content as
described in the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method of the
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

## Create an image selector object

The following code sample shows the core logic to build, render, and handle the
Google Picker API to create an image selector.

Use JavaScript to call the Google Picker API:

```
/**
 * Create and render a Google Picker object for searching images.
 */
function createPicker() {
  // Define what types of files the Picker should show (e.g., images)
  const view = new google.picker.View(google.picker.ViewId.DOCS);
  view.setMimeTypes('image/png,image/jpeg,image/jpg');

  // Build and display the picker.
  const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setDeveloperKey('API_KEY')
      .setAppId('APP_ID')
      .setOAuthToken('ACCESS_TOKEN')
      .addView(view)
      .addView(new google.picker.DocsUploadView()) // Adds an upload tab
      .setCallback(pickerCallback)
      .build();

  picker.setVisible(true);
}

/**
 * Displays the file details of the user's selection.
 * @param {object} data - Contains the user selection from the Google Picker.
 */
async function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    let text = `Google Picker response: \n${JSON.stringify(data, null, 2)}\n`;

    // Extract the ID of the first selected document.
    const selectedDoc = data[google.picker.Response.DOCUMENTS][0];
    const fileId = selectedDoc[google.picker.Document.ID];
    console.log("Selected File ID:", fileId);

    // Optional: Fetch metadata using the Drive API based on the selected file ID.
    const res = await gapi.client.drive.files.get({
      'fileId': fileId,
      'fields': '*',
    });

    text += `Drive API response for first document: \n${JSON.stringify(res.result, null, 2)}\n`;
    // Update your UI with the results
    console.log(text);
  }
}
```

Replace the following:

* API\_KEY: the [API key
  credentials](https://developers.google.com/workspace/guides/create-credentials#api-key)
  you created.
* APP\_ID: the project number from Google Cloud project.
* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.

## Related topics

* [Integrate the Google Picker into web apps](https://developers.google.com/workspace/drive/picker/guides/web-picker)
