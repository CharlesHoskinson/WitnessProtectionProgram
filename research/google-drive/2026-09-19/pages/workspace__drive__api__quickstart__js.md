# JavaScript quickstart Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/quickstart/js

Retrieved: 2026-09-19T16:28:59.066741+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Create a JavaScript web application that makes requests to the Google Drive API.

Quickstarts explain how to set up and run an app that calls a
Google Workspace API. This quickstart uses a
simplified authentication approach that is appropriate for a testing
environment. For a production environment, we recommend learning about
[authentication and authorization](https://developers.google.com/workspace/guides/auth-overview)
before
[choosing the access credentials](https://developers.google.com/workspace/guides/create-credentials#choose_the_access_credential_that_is_right_for_you)
that are appropriate for your app.

This quickstart uses Google Workspace's recommended API client libraries
to handle some details of the authentication and authorization flow.

## Objectives

* Set up your environment.
* Set up the sample.
* Run the sample.

## Prerequisites

* [Node.js & npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
  installed.
* [A Google Cloud project](https://developers.google.com/workspace/guides/create-project).

* A Google account with Google Drive enabled.

## Set up your environment

To complete this quickstart, set up your environment.

### Enable the API

Before using Google APIs, you need to turn them on in a Google Cloud project.
You can turn on one or more APIs in a single Google Cloud project.

* In the Google Cloud console, enable the Google Drive API.

  [Enable the API](https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com)

### Configure the OAuth consent screen

If you're using a new Google Cloud project to complete this quickstart, configure
the OAuth consent screen. If you've already completed this step for your
Cloud project, skip to the next section.

1. In the Google API Console, go to Menu
   > **Google Auth platform**
   > **Branding**.

   [Go to Branding](https://console.developers.google.com/auth/branding)
2. If you have already configured the Google Auth platform, you can configure the following OAuth Consent Screen settings in [Branding](https://console.developers.google.com/auth/branding), [Audience](https://console.developers.google.com/auth/audience), and [Data Access](https://console.developers.google.com/auth/scopes). If you see a message that says **Google Auth platform not configured yet**, click **Get Started**:

1. Under **App Information**, in **App name**, enter a name for the app.
2. In **User support email**, choose a support email address where users can contact you if they have questions about their consent.
3. Click **Next**.
4. Under **Audience**, select **Internal**.
5. Click **Next**.
6. Under **Contact Information**, enter an **Email address** where you can be notified about any changes to your project.
7. Click **Next**.
8. Under **Finish**, review the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) and if you agree, select **I agree to the Google API Services: User Data Policy**.
9. Click **Continue**.
10. Click **Create**.

3. For now, you can skip adding scopes.
   In the future, when you create an app for use outside of your
   Google Workspace organization, you must change the **User type** to **External**. Then
   add the authorization scopes that your app requires. To learn more, see the full
   [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent) guide.

### Authorize credentials for a web application

To authenticate end users and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Web application**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Add authorized URIs related to your app:
   * **Client-side apps (JavaScript)**–Under **Authorized JavaScript origins**, click **Add URI**. Then, enter a URI to use for browser requests. This identifies the domains from which your application can send API requests to the OAuth 2.0 server.
   * **Server-side apps (Java, Python, and more)**–Under **Authorized redirect URIs**, click **Add URI**. Then, enter an endpoint URI to which the OAuth 2.0 server can send responses.
6. Click **Create**.

   The newly created credential appears under **OAuth 2.0 Client IDs**.

   Note that client secrets aren't used for Web applications.
7. Save the client ID for use later in this quickstart.

## Set up the sample

1. In your working directory, create a file named `index.html`.
2. In the `index.html` file, paste the following sample code:

   drive/quickstart/index.html

   [View on GitHub](https://github.com/googleworkspace/browser-samples/blob/main/drive/quickstart/index.html)

   ```
   <!DOCTYPE html>
   <html>
     <head>
       <title>Drive API Quickstart</title>
       <meta charset="utf-8" />
     </head>
     <body>
       <p>Drive API Quickstart</p>

       <!--Add buttons to initiate auth sequence and sign out-->
       <button id="authorize_button" onclick="handleAuthClick()">Authorize</button>
       <button id="signout_button" onclick="handleSignoutClick()">Sign Out</button>

       <pre id="content" style="white-space: pre-wrap;"></pre>

       <script type="text/javascript">
         /* exported gapiLoaded */
         /* exported gisLoaded */
         /* exported handleAuthClick */
         /* exported handleSignoutClick */

         // TODO(developer): Set to client ID from the Developer Console
         const CLIENT_ID = '<YOUR_CLIENT_ID>';

         // Discovery doc URL for APIs used by the quickstart
         const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

         // Authorization scopes required by the API; multiple scopes can be
         // included, separated by spaces.
         const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';

         let tokenClient;
         let gapiInited = false;
         let gisInited = false;

         document.getElementById('authorize_button').style.visibility = 'hidden';
         document.getElementById('signout_button').style.visibility = 'hidden';

         /**
          * Callback after api.js is loaded.
          */
         function gapiLoaded() {
           gapi.load('client', initializeGapiClient);
         }

         /**
          * Callback after the API client is loaded. Loads the
          * discovery doc to initialize the API.
          */
         async function initializeGapiClient() {
           await gapi.client.init({
             discoveryDocs: [DISCOVERY_DOC],
           });
           gapiInited = true;
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
           if (gapiInited && gisInited) {
             document.getElementById('authorize_button').style.visibility = 'visible';
           }
         }

         /**
          *  Sign in the user upon button click.
          */
         function handleAuthClick() {
           tokenClient.callback = async (resp) => {
             if (resp.error !== undefined) {
               throw (resp);
             }
             document.getElementById('signout_button').style.visibility = 'visible';
             document.getElementById('authorize_button').innerText = 'Refresh';
             await listFiles();
           };

           if (gapi.client.getToken() === null) {
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
           const token = gapi.client.getToken();
           if (token !== null) {
             google.accounts.oauth2.revoke(token.access_token);
             gapi.client.setToken('');
             document.getElementById('content').innerText = '';
             document.getElementById('authorize_button').innerText = 'Authorize';
             document.getElementById('signout_button').style.visibility = 'hidden';
           }
         }

         /**
          * Print metadata for first 10 files.
          */
         async function listFiles() {
           let response;
           try {
             response = await gapi.client.drive.files.list({
               'pageSize': 10,
               'fields': 'files(id, name)',
             });
           } catch (err) {
             document.getElementById('content').innerText = err.message;
             return;
           }
           const files = response.result.files;
           if (!files || files.length == 0) {
             document.getElementById('content').innerText = 'No files found.';
             return;
           }
           // Flatten to string to display
           const output = files.reduce(
               (str, file) => `${str}${file.name} (${file.id})\n`,
               'Files:\n');
           document.getElementById('content').innerText = output;
         }
       </script>
       <script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
       <script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>
     </body>
   </html>
   ```

   Replace the following:

   * `YOUR_CLIENT_ID`: the client ID that you created
     when you
     [authorized credentials for a web application](https://developers.google.com/workspace/drive/api/quickstart/js#authorize-credentials).

## Run the sample

1. In your working directory, install the [http-server](https://www.npmjs.com/package/http-server) package:

   ```
   npm install http-server
   ```
2. In your working directory, start a web server:

   ```
   npx http-server -p 8000
   ```

3. In your browser, navigate to `http://localhost:8000`.
4. You see a prompt to authorize access:
   1. If you're not already signed in to your Google Account, sign in when prompted. If
      you're signed in to multiple accounts, select one account to use for authorization.
   2. Click **Accept**.

Your JavaScript application runs and calls the Google Drive API.

## Next steps

* [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)
  + [Troubleshoot authentication and authorization issues](https://developers.google.com/workspace/drive/api/troubleshoot-authentication-authorization)
  + [Drive API reference documentation](https://developers.google.com/workspace/drive/api/reference/rest/v3)
  + [`google-api-javascript-client` section of GitHub](https://developers.google.com/api-client-library/javascript)
