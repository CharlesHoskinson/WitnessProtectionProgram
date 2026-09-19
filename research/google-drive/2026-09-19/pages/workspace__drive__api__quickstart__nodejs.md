# Node.js quickstart Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/quickstart/nodejs

Retrieved: 2026-09-19T16:29:00.238241+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Create a Node.js command-line application that makes requests to the
Google Drive API.

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
* Install the client library.
* Set up the sample.
* Run the sample.

## Prerequisites

To run this quickstart, you need the following prerequisites:

* [Node.js & npm](https://docs.npmjs.com/getting-started/installing-node#1-install-nodejs--npm) installed.
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
the OAuth consent screen. If you've already
completed this step for your Cloud project, skip to the next section.

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

### Authorize credentials for a desktop application

To authenticate end users and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.
**Caution:** This quickstart must be run locally and with access to a browser. It
doesn't work if run on a remote terminal such as Cloud Shell or over SSH.

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Desktop app**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."
6. Save the downloaded JSON file as `credentials.json`, and move the
   file to your working directory.

## Install the client library

* Install the libraries using npm:

  ```
  npm install googleapis@105 @google-cloud/local-auth@2.1.0 --save
  ```

## Set up the sample

1. In your working directory, create a file named `index.js`.
2. In the file, paste the following code:

   drive/quickstart/index.js

   [View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/quickstart/index.js)

   ```
   import path from 'node:path';
   import process from 'node:process';
   import {authenticate} from '@google-cloud/local-auth';
   import {google} from 'googleapis';

   // The scope for reading file metadata.
   const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
   // The path to the credentials file.
   const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

   /**
    * Lists the names and IDs of up to 10 files.
    */
   async function listFiles() {
     // Authenticate with Google and get an authorized client.
     const auth = await authenticate({
       scopes: SCOPES,
       keyfilePath: CREDENTIALS_PATH,
     });

     // Create a new Drive API client.
     const drive = google.drive({version: 'v3', auth});
     // Get the list of files.
     const result = await drive.files.list({
       pageSize: 10,
       fields: 'nextPageToken, files(id, name)',
     });
     const files = result.data.files;
     if (!files || files.length === 0) {
       console.log('No files found.');
       return;
     }

     console.log('Files:');
     // Print the name and ID of each file.
     files.forEach((file) => {
       console.log(`${file.name} (${file.id})`);
     });
   }

   await listFiles();
   ```

## Run the sample

1. In your working directory, run the sample:

   ```
   node .
   ```

2. The first time you run the sample, it prompts you to authorize access:
   1. If you're not already signed in to your Google Account, sign in when prompted. If
      you're signed in to multiple accounts, select one account to use for authorization.
   2. Click **Accept**.

   Your Nodejs application runs and calls the Google Drive API.

   Authorization information is stored in the file system, so the next time you run the sample
   code, you aren't prompted for authorization.

## Next steps

* [Try the Google Workspace APIs in the APIs explorer](https://developers.google.com/workspace/explore)
  + [Troubleshoot authentication and authorization issues](https://developers.google.com/workspace/drive/api/troubleshoot-authentication-authorization)
  + [Drive API reference documentation](https://developers.google.com/workspace/drive/api/reference/rest/v3)

- [`google-api-nodejs-client` section of GitHub](https://github.com/google/google-api-nodejs-client/#google-apis-nodejs-client)
