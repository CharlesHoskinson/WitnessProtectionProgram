# Loopback IP Address flow Migration Guide Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration

Retrieved: 2026-09-19T16:30:29.413767+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Google is making Google OAuth interactions safer by deprecating the loopback IP address flow due to its vulnerability to man-in-the-middle attacks.
* The loopback IP address flow will be deprecated for native iOS, Android, and Chrome OAuth client types but will continue to be supported on desktop apps.
* Key compliance dates for this deprecation range from March 14, 2022, blocking new clients, to October 21, 2022, blocking all existing clients.
* To determine if you are affected, review your OAuth client ID type and inspect your app code or outgoing network calls for the use of loopback redirect URI values.
* Affected mobile clients (Android/iOS) should migrate to recommended SDKs, while Chrome app clients should migrate to using the Chrome Identity API.

## Overview

On February 16 2022, we
[announced](https://developers.googleblog.com/2022/02/making-oauth-flows-safer.html)
plans to make Google OAuth interactions safer by using more secure OAuth
flows. This guide helps you to understand the necessary changes and steps to
successfully migrate from the loopback IP address flow to supported alternatives.

This effort is a protective measure against phishing and app impersonation
attacks during interactions with Google's OAuth 2.0 authorization endpoints.

### What is the Loopback IP Address flow?

The [loopback IP address flow](https://developers.google.com/identity/protocols/oauth2/native-app#redirect-uri_loopback) supports the use of a loopback IP address or
`localhost` as the host component of the redirect URI where
credentials are sent to after a user approves an OAuth consent request. This flow is
vulnerable to
[man in the middle](https://wikipedia.org/wiki/Man-in-the-middle_attack)
attacks where a nefarious app, accessing the same loopback interface on some
operating systems, may intercept the response from the authorization server to the given
redirect URI and gain access to the authorization code.

The loopback IP address flow is being deprecated for iOS, Android,
and Chrome OAuth client types but will continue to be supported on desktop
apps.

### Key compliance dates

* **March 14, 2022** - new OAuth clients blocked from using the Loopback
  IP address flow
* **August 1, 2022** - a user-facing warning message may be
  displayed to non-compliant OAuth requests
* **August 31, 2022** - the Loopback IP address flow is blocked
  for Android, Chrome app, and iOS OAuth clients created before March 14, 2022
* **October 21, 2022** - all existing clients are blocked
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

There are two main steps to complete to get through the migration process:

1. Determine if you are affected.
2. Migrate to a supported alternative if you are affected.

## Determine if you are affected

### Review your OAuth client ID type

Navigate to the
[Clients page](https://console.developers.google.com/auth/clients) of the
Google Cloud Console and view your OAuth client ID type under the
**OAuth 2.0 Client IDs** section. It will be any one of the
following: *Web application*, *Android*, *iOS*,
*Universal Windows Platform (UWP)*, *Chrome app*, *TVs & Limited Input devices*,
*Desktop app*.

Proceed to the next step if your client type is Android, Chrome app, or iOS and you are using
the loopback IP address flow.

You don't need to do anything related to this deprecation if you are using
the loopback IP address flow on a Desktop app OAuth client as usage with that OAuth client type
will continue to be supported.

**Note:** The deprecation is applicable to the publishing statuses:
[Testing](https://support.google.com/cloud/answer/10311615#publishing-status&zippy=%2Ctesting) &
[In Production](https://support.google.com/cloud/answer/10311615#zippy=%2Cin-production) and user types:
[Internal](https://support.google.com/cloud/answer/10311615#zippy=%2Cinternal) &
[External](https://support.google.com/cloud/answer/10311615#zippy=%2Cexternal).

### How to determine if your app is using the loopback IP address flow

[Inspect your app code](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration#inspect-your-application-code) or the
[outgoing network call](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration#inspect-outgoing-network-call) (in case
your app is using an OAuth library) to determine if the Google OAuth
[authorization request](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server)
your app is making is using loopback redirect URI values.

**Note:** If you are making use of a library to handle your
authentication / authorization flows, it is still recommended that you
inspect your network call as some libraries abstract the use of the loopback
redirect URI values.

#### Inspect your application code

Review the section of your application code where you are making calls to
the Google OAuth
[authorization endpoints](https://developers.google.com/identity/protocols/oauth2/native-app#step-2:-send-a-request-to-googles-oauth-2.0-server)
and determine if the `redirect_uri` parameter has any of the
following values:

* `redirect_uri=http://127.0.0.1:<port>` e.g.
  `redirect_uri=http://127.0.0.1:3000`
* `redirect_uri=http://[::1]:<port>` e.g.
  `redirect_uri=http://[::1]:3000`
* `redirect_uri=http://localhost:<port>` e.g.
  `redirect_uri=http://localhost:3000`

A sample loopback IP address redirect flow request looks like the following:

```
https://accounts.google.com/o/oauth2/v2/auth?
redirect_uri=http://localhost:3000&
response_type=code&
scope=<SCOPES>&
state=<STATE>&
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

* `redirect_uri=http://127.0.0.1:<port>` e.g.
  `redirect_uri=http://127.0.0.1:3000`
* `redirect_uri=http://[::1]:<port>` e.g.
  `redirect_uri=http://[::1]:3000`
* `redirect_uri=http://localhost:<port>` e.g.
  `redirect_uri=http://localhost:3000`

A sample loopback IP address redirect flow request looks like the following:

```
https://accounts.google.com/o/oauth2/v2/auth?
redirect_uri=http://localhost:3000&
response_type=code&
scope=<SCOPES>&
state=<STATE>&
client_id=<CLIENT_ID>
```

## Migrate to a supported alternative

### Mobile Clients (Android / iOS)

If you determine that your app is using the loopback IP address flow with an Android or iOS
OAuth client type, you should migrate to using the recommended SDKs
([Android](https://developers.google.com/identity/sign-in/android),
[iOS](https://developers.google.com/identity/sign-in/ios)).

The SDK makes it easy to access Google APIs and handles all the calls to
Google's OAuth 2.0 authorization endpoints.

The documentation links below provides information on how to use the recommended SDKs to access
Google APIs without using a loopback IP address
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

If you determine that your app is using the loopback IP address flow on the Chrome
app client, you should migrate to using the
[Chrome Identity API](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/).

The example below shows how to get all user contacts without the use of a loopback IP address redirect URI.

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
