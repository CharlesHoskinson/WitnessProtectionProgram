# Out-Of-Band (OOB) flow Migration Guide Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/resources/oob-migration

Retrieved: 2026-09-19T16:30:30.827063+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Google is making its OAuth interactions safer by deprecating the Out-of-Band (OOB) flow due to phishing and app impersonation risks.
* The OOB flow, used by native clients without a redirect URI, will be blocked for new OAuth usage starting February 28, 2022, and fully deprecated by January 31, 2023, for all client types in production.
* To determine if you are affected, check if your production app's OAuth authorization requests use `redirect_uri` values like `urn:ietf:wg:oauth:2.0:oob`, `urn:ietf:wg:oauth:2.0:oob:auto`, or `oob`.
* Affected mobile clients (Android/iOS) should migrate to recommended SDKs, Chrome apps to the Chrome Identity API, web applications to Google API client libraries, and desktop clients to the loopback IP address flow.

## Overview

On February 16 2022, we
[announced](https://developers.googleblog.com/2022/02/making-oauth-flows-safer.html)
plans to make Google OAuth interactions safer by using more secure OAuth
flows. This guide helps you to understand the necessary changes and steps to
successfully migrate from the OAuth out-of-band (OOB) flow to supported alternatives.

This effort is a protective measure against phishing and app impersonation
attacks during interactions with Google's OAuth 2.0 authorization endpoints.

### What is OOB?

OAuth
[out-of-band (OOB)](https://developers.google.com/identity/protocols/oauth2/native-app#manual-copypaste),
also referred to as the manual copy/paste option, is a legacy flow
developed to support installed clients that don't have a redirect URI
to accept the credentials after a user approves an OAuth consent
request. The OOB flow poses a remote phishing risk and clients must migrate
to an alternative method to protect against this vulnerability.

The OOB flow is being deprecated for all client types i.e. Web applications,
Android, iOS, Universal Windows Platform (UWP), Chrome apps, TVs &
limited-input devices, Desktop apps.

### Key compliance dates

* **February 28, 2022** - new OAuth usage blocked for the OOB flow
* **September 5, 2022** - a user-facing warning message may be
  displayed to non-compliant OAuth requests
* **October 3, 2022** - the OOB flow is deprecated for OAuth clients created
  before February 28, 2022
* **January 31, 2023** - all existing clients are blocked
  (including exempted clients)

A user-facing error message will be displayed for non-compliant requests.
The message will convey to users that the app is blocked while
displaying the support email that you have registered in the
[OAuth consent screen in the Google Cloud console](https://console.developers.google.com/apis/credentials/consent).

**Note:** If you would like to receive reminders and notifications from
Google about this deprecation, make sure you have appropriately configured
the contact information for your app by reviewing the support and contact
email addresses for your project in the OAuth [Branding page](https://console.developers.google.com/auth/branding)
of the Google Cloud Console.

There are two main steps to complete the migration process:

1. Determine if you are affected.
2. Migrate to a more secure alternative if you are affected.

## Determine if you are affected

This deprecation is only applicable to production apps (i.e apps with
publishing status set to
[In Production](https://support.google.com/cloud/answer/10311615#zippy=%2Cin-production). The flow will continue to work for apps with the
[Testing publishing status](https://support.google.com/cloud/answer/10311615#publishing-status&zippy=%2Ctesting).

**Note:** The deprecation is applicable to both
[Internal](https://support.google.com/cloud/answer/10311615#zippy=%2Cinternal) and
[External](https://support.google.com/cloud/answer/10311615#zippy=%2Cexternal) apps
in Production.

Review your publishing status in the OAuth [Branding page](https://console.developers.google.com/auth/branding)
of the Google Cloud Console and proceed to the next step if you are using
the [OOB flow](https://developers.google.com/identity/protocols/oauth2/native-app#manual-copypaste) in a project with an "In Production" publishing status.

### How to determine if your app is using the OOB flow

[Inspect your app code](https://developers.google.com/identity/protocols/oauth2/resources/oob-migration#inspect-your-application-code) or the
[outgoing network call](https://developers.google.com/identity/protocols/oauth2/resources/oob-migration#inspect-outgoing-network-call) (in case
your app is using an OAuth library) to determine if the Google OAuth
[authorization request](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server)
your app is making is using an OOB redirect URI value.

**Note:** If you are making use of a library to handle your
authentication / authorization flows, it is still recommended that you
inspect your network call as some libraries abstract the use of the OOB
redirect URI value.

#### Inspect your application code

Review the section of your application code where you are making calls to
the Google OAuth
[authorization endpoints](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server)
and determine if the `redirect_uri` parameter has any of the
following values:

* `redirect_uri=urn:ietf:wg:oauth:2.0:oob`
* `redirect_uri=urn:ietf:wg:oauth:2.0:oob:auto`
* `redirect_uri=oob`

A sample OOB redirect flow request looks like the following:

```
https://accounts.google.com/o/oauth2/v2/auth?
response_type=code&
scope=<SCOPES>&
state=<STATE>&
redirect_uri=urn:ietf:wg:oauth:2.0:oob&
client_id=<CLIENT_ID>
```

**Note:** You should also check your application configuration files
(such as `.env` files) as `redirect_uri` values are
typically set up to be different based on the environment in which the
application is running.

#### Inspect outgoing network call

The method for inspecting network calls will vary depending on your
application client type.

* **Web application** -
  [inspect network activity on Chrome](https://developer.chrome.com/docs/devtools/network/)
* **Android** -
  [inspect network traffic with the Network Inspector](https://developer.android.com/studio/debug/network-profiler#:~:text=From%20the%20Android%20Studio%20navigation,Network%20Inspector%20from%20the%20tabs.)
* **Chrome apps**
  + Navigate to the
    [Chrome extensions
    page](https://support.google.com/chrome_webstore/answer/2664769)
  + Check the **Developer mode** checkbox at the top right
    corner of the extension page
  + Select the extension you want to monitor
  + Click on the **background page** link in the
    **Inspect views** section of the extension page
  + A **Developer Tools** popup will open up where you can
    monitor the network traffic in the
    [Network tab](https://developer.chrome.com/docs/devtools/network/#load)
* **iOS** -
  [Analyzing HTTP traffic with Instruments](https://developer.apple.com/documentation/foundation/url_loading_system/analyzing_http_traffic_with_instruments)
* **Desktop apps** -
  [use a network capture tool](https://en.wikipedia.org/wiki/Comparison_of_packet_analyzers)
  available for the operating system the app was developed for

While inspecting network calls, look for requests sent to the Google OAuth
[authorization endpoints](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server)
and determine if the `redirect_uri` parameter has any of the
following values:

* `redirect_uri=urn:ietf:wg:oauth:2.0:oob`
* `redirect_uri=urn:ietf:wg:oauth:2.0:oob:auto`
* `redirect_uri=oob`

A sample OOB redirect flow request looks like the following:

```
https://accounts.google.com/o/oauth2/v2/auth?
response_type=code&
scope=<SCOPES>&
state=<STATE>&
redirect_uri=urn:ietf:wg:oauth:2.0:oob&
client_id=<CLIENT_ID>
```

## Migrate to a secure alternative

### Mobile Clients (Android / iOS)

If you determine that your app is using the OOB flow with an Android or iOS
OAuth client type, you should migrate to using the recommended SDKs
([Android](https://developers.google.com/identity/sign-in/android),
[iOS](https://developers.google.com/identity/sign-in/ios)).

The SDK makes it easy to access Google APIs and handles all the calls to
Google's OAuth 2.0 authorization endpoints.

The documentation links below provides information on how to use the recommended SDKs to access
Google APIs without using an OOB
redirect URI.

#### Access Google APIs on Android

##### Client-side access

The following example shows how to
[access Google APIs on the client
side on Android](https://developer.android.com/identity/authorization) using the recommended Google Identity Services Android Library.

```
  List requestedScopes = Arrays.asList(DriveScopes.DRIVE_APPDATA);
    AuthorizationRequest authorizationRequest = AuthorizationRequest.builder().setRequestedScopes(requestedScopes).build();
    Identity.getAuthorizationClient(activity)
            .authorize(authorizationRequest)
            .addOnSuccessListener(
                authorizationResult -> {
                  if (authorizationResult.hasResolution()) {
                    // Access needs to be granted by the user
                    PendingIntent pendingIntent = authorizationResult.getPendingIntent();
                    try {
    startIntentSenderForResult(pendingIntent.getIntentSender(),
    REQUEST_AUTHORIZE, null, 0, 0, 0, null);
                    } catch (IntentSender.SendIntentException e) {
                    Log.e(TAG, "Couldn't start Authorization UI: " + e.getLocalizedMessage());
                    }
                  } else {
                    // Access already granted, continue with user action
                    saveToDriveAppFolder(authorizationResult);
                  }
                })
            .addOnFailureListener(e -> Log.e(TAG, "Failed to authorize", e));
```

Pass the `authorizationResult` to your defined method to save content to the
user's drive folder. The `authorizationResult` has the
`getAccessToken()` method that returns the access token.

##### Server-Side (offline) access

The following example shows how to access Google APIs on the server side on Android.
**Note:** The server-side (offline) access mode requires you to stand up a
server and have a publicly available endpoint to receive the authorization
code.

```
  List requestedScopes = Arrays.asList(DriveScopes.DRIVE_APPDATA);
    AuthorizationRequest authorizationRequest = AuthorizationRequest.builder()
    .requestOfflineAccess(webClientId)
            .setRequestedScopes(requestedScopes)
            .build();
    Identity.getAuthorizationClient(activity)
            .authorize(authorizationRequest)
            .addOnSuccessListener(
                authorizationResult -> {
                  if (authorizationResult.hasResolution()) {
                    // Access needs to be granted by the user
                    PendingIntent pendingIntent = authorizationResult.getPendingIntent();
                    try {
    startIntentSenderForResult(pendingIntent.getIntentSender(),
    REQUEST_AUTHORIZE, null, 0, 0, 0, null);
                    } catch (IntentSender.SendIntentException e) {
                    Log.e(TAG, "Couldn't start Authorization UI: " + e.getLocalizedMessage());
                    }
                  } else {
                    String authCode = authorizationResult.getServerAuthCode();
                  }
                })
            .addOnFailureListener(e -> Log.e(TAG, "Failed to authorize", e));
```

The `authorizationResult` has the
`getServerAuthCode()` method that returns the authorization code which you can send to
your backend to obtain an access and refresh token.

#### Access Google APIs in an iOS App

##### Client-side access

The example below shows how to
[access Google APIs on the client side on iOS](https://developers.google.com/identity/sign-in/ios).

```
user.authentication.do { authentication, error in
  guard error == nil else { return }
  guard let authentication = authentication else { return }
  
  // Get the access token to attach it to a REST or gRPC request.
  let accessToken = authentication.accessToken
  
  // Or, get an object that conforms to GTMFetcherAuthorizationProtocol for
  // use with GTMAppAuth and the Google APIs client library.
  let authorizer = authentication.fetcherAuthorizer()
}
```

Use the access token to call the API, by either including the access token in
the header of a REST or gRPC request (`Authorization: Bearer ACCESS_TOKEN`),
or by using the fetcher authorizer (`GTMFetcherAuthorizationProtocol`) with the
[Google APIs client library for Objective-C for REST](https://github.com/google/google-api-objectivec-client-for-rest/).

Review the
[client-side access
guide](https://developers.google.com/identity/sign-in/ios/api-access#3_make_an_api_call_with_fresh_tokens) on how to access Google APIs on the client side.
on how to access Google APIs on the client side.

##### Server-side (offline) access

The example below shows how to access Google APIs on the server side to support an iOS client.
**Note:** The server-side (offline) access mode requires you to stand up a
server and have a publicly available endpoint to receive the authorization
code.

```
GIDSignIn.sharedInstance.signIn(with: signInConfig, presenting: self) { user, error in
  guard error == nil else { return }
  guard let user = user else { return }
  
  // request a one-time authorization code that your server exchanges for
  // an access token and refresh token
  let authCode = user.serverAuthCode
}
```

Review the
[server-side access
guide](https://developers.google.com/identity/sign-in/ios/api-access#3_make_an_api_call_with_fresh_tokens)
on how to access Google APIs from the server side.

### Chrome App Client

If you determine that your app is using the OOB flow on the Chrome
app client, you should migrate to using the
[Chrome Identity API](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/).

The example below shows how to get all user contacts without the use of an OOB redirect URI.

```
window.onload = function() {
  document.querySelector('button').addEventListener('click', function() {

  
  // retrieve access token
  chrome.identity.getAuthToken({interactive: true}, function(token) {
  
  // ..........


  // the example below shows how to use a retrieved access token with an appropriate scope
  // to call the Google People API contactGroups.get endpoint

  fetch(
    'https://people.googleapis.com/v1/contactGroups/all?maxMembers=20&key=API_KEY',
    init)
    .then((response) => response.json())
    .then(function(data) {
      console.log(data)
    });
   });
 });
};
```

Review the
[Chrome Identity API guide](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
for more information on how to access authenticate users and call Google
endpoints with the Chrome Identity API.

### Web Application

If you determine that your app is using the OOB flow for a web application,
you should migrate to using one of our Google API client libraries.
See the list of [Google API client libraries](https://developers.google.com/identity/protocols/oauth2/web-server#libraries) for different programming languages.

The libraries simplify access to Google APIs and handle all the calls to
the Google endpoints.

##### Server-side (offline) access

The server-side (offline) access mode requires you to do the following :

* Stand up a server and define a publicly accessible endpoint (the
  redirect URI) to receive the authorization code.
* Configure the
  [redirect URI](https://support.google.com/cloud/answer/6158849#zippy=%2Cweb-applications)  in the [Clients page](https://console.developers.google.com/auth/clients) of
  the Google Cloud Console

The following code snippet shows a NodeJS example of using the Google Drive API
to list a user's Google Drive files on the server-side without using an OOB
redirect URI.

```
async function main() {
  const server = http.createServer(async function (req, res) {

  if (req.url.startsWith('/oauth2callback')) {
    let q = url.parse(req.url, true).query;

    if (q.error) {
      console.log('Error:' + q.error);
    } else {
      
      // Get access and refresh tokens (if access_type is offline)
      let { tokens } = await oauth2Client.getToken(q.code);
      oauth2Client.setCredentials(tokens);

      // Example of using Google Drive API to list filenames in user's Drive.
      const drive = google.drive('v3');
      drive.files.list({
        auth: oauth2Client,
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
      }, (err1, res1) => {
        // TODO(developer): Handle response / error.
      });
    }
  }
}
```

Review the
[server-side web app guide](https://developers.google.com/identity/protocols/oauth2/web-server)
on how to access Google APIs from the server side.

###### Client-Side access

The following code snippet, in JavaScript, shows an example of using the Google
API to access user's calendar events on the client side.

```
// initTokenClient() initializes a new token client with your
// web app's client ID and the scope you need access to

const client = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_GOOGLE_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  
  // callback function to handle the token response
  callback: (tokenResponse) => {
    if (tokenResponse && tokenResponse.access_token) { 
      gapi.client.setApiKey('YOUR_API_KEY');
      gapi.client.load('calendar', 'v3', listUpcomingEvents);
    }
  },
});

function listUpcomingEvents() {
  gapi.client.calendar.events.list(...);
}
```

Review the
[client-side web app guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
on how to access Google APIs from the client side.

###### Desktop client

If you determine that your app is using the OOB flow on a desktop client,
you should migrate to using the
[loopback IP address (`localhost` or `127.0.0.1`) flow](https://developers.google.com/identity/protocols/oauth2/native-app#redirect-uri_loopback).

**Note:** This implementation requires you to be listening on a local web server (for
example, using the Apache HTTP Server) to receive the authorization code.
