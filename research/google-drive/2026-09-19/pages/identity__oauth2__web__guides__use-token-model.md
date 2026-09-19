# Use the token model Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/oauth2/web/guides/use-token-model

Retrieved: 2026-09-19T16:29:25.099504+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* The `google.accounts.oauth2` JavaScript library facilitates prompting for user consent and obtaining access tokens using the OAuth 2.0 implicit grant flow.
* You can initialize a token client with your client ID and required scopes by calling `initTokenClient()`.
* The `requestAccessToken()` method triggers the user flow for account selection, sign-in, and consent, returning an access token or error to your callback handler.
* Incremental authorization allows requesting scopes as needed through multiple calls to `requestAccessToken()`, either in single-page or multi-page applications.
* You can check for granted scopes using `hasGrantedAllScopes()` or `hasGrantedAnyScope()` in your callback function after receiving a `TokenResponse`.
* Access tokens can be used for making authenticated requests to Google APIs via REST and CORS or with the Google API Client Library for JavaScript.
* Access tokens have a short lifetime and a new one must be obtained by calling `requestAccessToken()` from a user-driven event if it expires.
* User consent can be revoked using the `google.accounts.oauth2.revoke` method with a valid access token.

The `google.accounts.oauth2` JavaScript library helps you prompt for user
consent and obtain an access token to work with user data. It is based upon the
OAuth 2.0 *implicit grant* flow and designed to allow you to either call Google
APIs directly using REST and CORS, or to use our [Google APIs client library for
JavaScript](https://developers.google.com/api-client-library/javascript) (also known as `gapi.client`) for flexible access to our
more complex APIs.

Before accessing protected user data from a browser, users on your site trigger
Google's web based account chooser, sign-in, and consent processes, and lastly
Google's OAuth servers issue and return an access token to your web app.

In the token based authorization model, there is no need to store per-user
refresh tokens on your backend server.

It is recommended that you follow the approach outlined here instead of the
techniques covered by the older [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
guide.

**Note:** Due to security concerns, only the dialog UX is supported.

## Prerequisites

Follow the steps described in [Setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid) to configure your OAuth Consent
Screen, obtain a client ID, and load the client library.

### Initialize a token client

Call `initTokenClient()` to initialize a new token client with your web app's
client ID, you need to include a list of one or more [scopes](https://developers.google.com/identity/protocols/oauth2/scopes) the user
needs to access:

```
const client = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_GOOGLE_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  callback: (response) => {
    ...
  },
});
```

## Trigger the OAuth 2.0 token flow

Use the `requestAccessToken()` method to trigger the token UX flow and obtain an
access token. Google prompts the user to:

* Choose their account,
* sign-in to the Google Account if not already signed-in,
* grant consent for your web app to access each requested scope.

A user gesture triggers the token flow:

```
<button onclick="client.requestAccessToken();">Authorize me</button>
```

Google then returns a `TokenResponse` containing an access token and list of
scopes the user has granted access to, or an error, to your callback handler.

Users may close the account chooser or sign-in windows, in which case your
callback function won't be invoked.

## How to handle consent

The design and user experience for your app should be implemented only after a
thorough review of Google's [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies). These policies cover
working with multiple scopes, when and how to handle user consent, and more.

**Incremental authorization** is a policy and app design methodology used to
request access to resources, using scopes, only as needed rather than up-front
and all at once. Users may approve or reject sharing of the individual resources
requested by your app, this is known as **granular permissions**.

During this process Google prompts for user consent, individually listing each
requested scope, users select the resources to be shared with your app, and
lastly, Google invokes your callback function to return an Access token and user
approved scopes. Your app then safely handles the various different outcomes
possible with granular permissions.

However, there are exceptions. Google Workspace Enterprise apps with
[domain-wide delegation of authority](https://support.google.com/a/answer/162106) or apps marked as [Trusted](https://support.google.com/a/answer/7281227#zippy=%2Cchange-access-from-the-app-list),
bypass the granular permissions consent screen. For these apps, users won't see
the granular permission consent screen. Instead, your app will either receive
all requested scopes or none.

For more detailed information, see [How to handle granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions).

**Key Point:** In order to grant consent users must first sign-in. For returning
visitors, if the user is already signed-in on your site they won't be
re-prompted to select an account each time your app requests additional scopes.

### Incremental authorization

For web apps, the following two high-level scenarios demonstrate incremental
authorization using:

* A single-page Ajax app, often using `XMLHttpRequest` with dynamic access to
  resources.
* Multiple web-pages, resources are separated and managed on a per page basis.

These two scenarios are presented to illustrate design considerations and
methodologies, but are not intended to be comprehensive recommendations on how
to build consent into your app. Real-world apps may use a variation or
combination of these techniques.

#### Ajax

Add support for incremental authorization to your app by making multiple calls
to `requestAccessToken()` and using the `OverridableTokenClientConfig` object's
`scope` parameter to request individual scopes at the time they are needed and
only when necessary. In this example resources will be requested and visible
only after a user gesture expands a collapsed content section.

| Ajax app |
| --- |
| Initialize the token client on page load:    ```         const client = google.accounts.oauth2.initTokenClient({           client_id: 'YOUR_GOOGLE_CLIENT_ID',           callback: "onTokenResponse",         }); ```  Request consent and obtain access tokens through user gestures, click `+` to open: Docs to read Show recent documents     ```           client.requestAccessToken(             overrideConfig = ({                scope = 'https://www.googleapis.com/auth/documents.readonly'              })            ); ```  Upcoming events Show calendar info     ```           client.requestAccessToken(             overrideConfig = ({                scope = 'https://www.googleapis.com/auth/calendar.readonly'              })            ); ```  Photo carousel Display photos     ```           client.requestAccessToken(             overrideConfig = ({                scope = 'https://www.googleapis.com/auth/photoslibrary.readonly'              })            ); ``` |

Each call to `requestAccessToken` triggers a user consent moment, your app will
have access only to those resources required by the section a user chooses to
expand, thus limiting resource sharing through user choice.

#### Multiple web-pages

When designing for incremental authorization, multiple pages are used to request
only the scope(s) required to load a page, reducing complexity and the need to
make multiple calls to obtain user consent and retrieve an access token.

| Multi-page app |
| --- |
| | Web page | Code | | --- | --- | | **Page 1. Docs to read** | ```   const client = google.accounts.oauth2.initTokenClient({     client_id: 'YOUR_GOOGLE_CLIENT_ID',     callback: "onTokenResponse",     scope: 'https://www.googleapis.com/auth/documents.readonly',   });   client.requestAccessToken(); ``` | | **Page 2. Upcoming events** | ```   const client = google.accounts.oauth2.initTokenClient({     client_id: 'YOUR_GOOGLE_CLIENT_ID',     callback: "onTokenResponse",     scope: 'https://www.googleapis.com/auth/calendar.readonly',   });   client.requestAccessToken(); ``` | | **Page 3. Photo carousel** | ```   const client = google.accounts.oauth2.initTokenClient({     client_id: 'YOUR_GOOGLE_CLIENT_ID',     callback: "onTokenResponse",     scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',   });   client.requestAccessToken(); ``` | |

Each page requests the necessary scope and obtains an access token by calling
`initTokenClient()` and `requestAccessToken()` at load time. In this scenario,
individual web pages are used to clearly separate user functionality and
resources by scope. In a real-world situation, individual pages may request
multiple related scopes.

### Granular permissions

Granular permissions are handled the same way in all scenarios; after
`requestAccessToken()` invokes your callback function and an access token
returned, check that the user has approved the requested scopes using
`hasGrantedAllScopes()` or `hasGrantedAnyScope()`. For example:

```
const client = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_GOOGLE_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly \
          https://www.googleapis.com/auth/documents.readonly \
          https://www.googleapis.com/auth/photoslibrary.readonly',
  callback: (tokenResponse) => {
    if (tokenResponse && tokenResponse.access_token) {
      if (google.accounts.oauth2.hasGrantedAnyScope(tokenResponse,
          'https://www.googleapis.com/auth/photoslibrary.readonly')) {
        // Look at pictures
        ...
      }
      if (google.accounts.oauth2.hasGrantedAllScopes(tokenResponse,
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/documents.readonly')) {
        // Meeting planning and review documents
        ...
      }
    }
  },
});
```

Any previously accepted grants from prior sessions or requests will also be
included in the response. A record of user consent is maintained per user and
Client ID, and persists across multiple calls to `initTokenClient()` or
`requestAccessToken()`. By default, user consent is only necessary the first
time a user visits your website and requests a new scope but may be requested on
every page load using `prompt=consent` in Token Client config objects.

**Note:** All previously approved scopes are returned by TokenResponse and visible
to users in myaccount.google.com/permissions, to remove scopes from your app and
update these sources call `google.accounts.oauth2.revoke()` and initialize using
`prompt=consent`.

## Work with tokens

In the Token model, an access token is not stored by the OS or browser, instead
a new token is first obtained at page load time, or subsequently by triggering a
call to `requestAccessToken()` through a user gesture such as a button press.

### Use REST and CORS with Google APIs

An access token can be used to make authenticated requests to Google APIs using
REST and CORS. This enables users to sign-in, grant consent, Google to issue an
access token and your site to work with the user's data.

In this example, view the signed-in users upcoming calendar events using the
access token returned by `tokenRequest()`:

```
var xhr = new XMLHttpRequest();
xhr.open('GET', 'https://www.googleapis.com/calendar/v3/calendars/primary/events');
xhr.setRequestHeader('Authorization', 'Bearer ' + tokenResponse.access_token);
xhr.send();
```

Google APIs support CORS by default, including an access token in an
`XMLHttpRequest` or `fetch` request triggers a CORS preflight check; an
OPTIONS request prior to a GET or POST.

The next section covers how to integrate with more complex APIs.

### Work with the Google APIs JavaScript library

The token client works with the [Google API Client Library for JavaScript](https://github.com/google/google-api-javascript-client)
See the following code snippet.

```
const client = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_GOOGLE_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
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

### Token expiration

By design, access tokens have a short lifetime. If the access token expires
prior to the end of the user's session, obtain a new token by calling
`requestAccessToken()` from a user-driven event such as a button press.

### Use an access token to revoke consent

Call the `google.accounts.oauth2.revoke` method to remove user consent and
access to resources for all of the scopes granted to your app. A valid access
token is required to revoke this permission:

```
google.accounts.oauth2.revoke('414a76cb127a7ece7ee4bf287602ca2b56f8fcbf7fcecc2cd4e0509268120bd7', done => {
    console.log(done);
    console.log(done.successful);
    console.log(done.error);
    console.log(done.error_description);
  });
```
