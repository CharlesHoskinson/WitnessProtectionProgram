# Use Code Model Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/oauth2/web/guides/use-code-model

Retrieved: 2026-09-19T16:29:23.964800+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* The Google Identity Services library facilitates requesting authorization codes from Google via Popup or Redirect UX flows to initiate a secure OAuth 2.0 flow.
* The OAuth 2.0 authorization code flow involves the user requesting a code, Google sending it to a callback or redirect endpoint, and your backend exchanging the code for access and refresh tokens.
* You can initialize a code client using `google.accounts.oauth2.initCodeClient()` and choose either Redirect or Popup mode, each with different configurations for handling the authorization code and preventing CSRF attacks.
* When using Redirect mode, your backend authorization endpoint receives the auth code as a URL parameter via a GET request, while Popup mode uses a JavaScript callback handler to POST the code to your server.
* After receiving and validating the authorization code on your backend server, you must follow specific steps to exchange it for access and refresh tokens from Google's token endpoint.

The Google Identity Services library enables users to request an authorization
code from Google using either a browser based Popup or Redirect UX flow. This
begins a secure OAuth 2.0 flow and results in an access token used to call
Google APIs on a user's behalf.

OAuth 2.0 authorization code flow summary:

* From a browser, with a gesture such as a button click, the Google Account
  owner requests an authorization code from Google.
* Google responds, sending a unique authorization code either to a callback in
  your JavaScript web app running in the user's browser, or directly invokes
  your authorization code endpoint using a browser redirect.
* Your backend platform hosts an authorization code endpoint and receives the
  code. After validation, your platform exchanges this code per-user for
  access and refresh tokens using a request to Google's token endpoint.
* Google validates the authorization code, confirms the request originated
  from your secure platform, issues access and refresh tokens, and returns the
  tokens by calling the login endpoint hosted by your platform.
* Your login endpoint receives the access and refresh tokens, securely storing
  the refresh token for later use.

**Key Point:** On your backend server, you exchange an authorization code for
refresh tokens and access tokens by [calling Google's token endpoint](https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code).

## Prerequisites

Follow the steps described in [Setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid) to configure your OAuth Consent
Screen, obtain a client ID, and load the client library.

## Initialize a Code Client

The `google.accounts.oauth2.initCodeClient()` method initializes a code client.

### Popup or Redirect mode

You can choose to share an auth code using either the **Redirect** or
**Popup** mode user flow. With Redirect mode you host an OAuth2 authorization
endpoint on your server and Google redirects the user-agent to this endpoint,
sharing the auth code as a URL parameter. For Popup mode you define a JavaScript
callback handler, which sends the authorization code to your server. You can
use Popup mode to provide a seamless user experience without visitors having to
leave your site.

To initialize a client for the:

* Redirect UX flow, set `ux_mode` to `redirect`, and the value of
  `redirect_uri` to your platform's authorization code endpoint. The value
  must exactly match one of the authorized redirect URIs for the OAuth 2.0
  client which you configured in the Google Cloud Console. It must also
  conform to [Redirect URI validation rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation).
* Popup UX flow, set `ux_mode` to `popup`, and the value of `callback` to the
  name of the function you will use to send authorization codes to your
  platform. The value of `redirect_uri` defaults to the origin of the page
  that calls `initCodeClient`. The flow uses this value later when you
  exchange the auth code for an access or refresh token. For
  example, `https://www.example.com/index.html` calls `initCodeClient` and
  the origin: `https://www.example.com` is the value of `redirect_url`.

**Key Point:** For the best balance of usability and security, we recommend using
the Popup mode UX flow with Authorization code model.

### Protect against CSRF attacks

Redirect and Popup mode UX flows use slightly different techniques to help
prevent Cross-Site-Request-Forgery (CSRF) attacks. For Redirect
mode, use the OAuth 2.0 *state* parameter. See [RFC6749 section 10.12
Cross-Site Request Forgery](https://datatracker.ietf.org/doc/html/rfc6749#section-10.12)
for more on generating and validating the *state* parameter. With Popup mode,
you add a custom HTTP header to your requests, and then on your server confirm
it matches the expected value and origin.

Choose a UX mode to view a code snippet showing auth code and CSRF handling:

### Redirect mode

Initialize a client where Google redirects the user's browser to your
authentication endpoint, sharing auth code as a URL parameter.

```
const client = google.accounts.oauth2.initCodeClient({
  client_id: 'YOUR_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  ux_mode: 'redirect',
  redirect_uri: 'https://oauth2.example.com/code',
  state: 'YOUR_BINDING_VALUE'
});
```

**Key Point:** An endpoint on your backend server [receives and validates](https://developers.google.com/identity/oauth2/web/guides/use-code-model#auth_code_handling)
the auth code, exchanging it for [access and refresh tokens](https://developers.google.com/identity/oauth2/web/guides/use-code-model#get_access_and_refresh_tokens).

### Popup mode

Initialize a client where the user begins the authorization flow in a
popup dialog. After consent, Google returns the authorization code
to the user's browser using a callback function. A POST request from the
JS callback handler delivers the auth code to an endpoint on the backend
server, where you first verify it and then complete the remainder of the
OAuth flow.

```
const client = google.accounts.oauth2.initCodeClient({
  client_id: 'YOUR_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  ux_mode: 'popup',
  callback: (response) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', "https://oauth2.example.com/code", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    // Set custom header for CRSF
    xhr.setRequestHeader('X-Requested-With', 'XmlHttpRequest');
    xhr.onload = function() {
      console.log('Auth code response: ' + xhr.responseText);
    };
    xhr.send('code=' + response.code);
  },
});
```

**Key Point:** An endpoint on your backend server [receives and validates](https://developers.google.com/identity/oauth2/web/guides/use-code-model#auth_code_handling)
the auth code, exchanging it for [access and refresh tokens](https://developers.google.com/identity/oauth2/web/guides/use-code-model#get_access_and_refresh_tokens).

## Trigger OAuth 2.0 Code Flow

Call the `requestCode()` method of the code client to trigger the user flow:

```
<button onclick="client.requestCode();">Authorize with Google</button>
```

This will require the user to sign-in to a Google Account and consent to share
individual scopes prior to returning an authorization code either to your
redirect endpoint or your callback handler.

## Auth code handling

Google generates a unique per user authorization code which you receive and
verify on your backend server.

For Popup mode, the handler specified by `callback`, running in the user's
browser, relays the authorization code to an endpoint hosted by your platform.

For Redirect mode, Google sends a `GET` request to the endpoint specified by
`redirect_uri`, sharing the authorization code in the URL *code* parameter. To
receive the authorization code:

* **Create** a new [Authorization endpoint](https://developers.google.com/identity/oauth2/web/guides/use-code-model#authorization_endpoint) if you don't have an existing
  implementation, or
* **Update** your existing endpoint to accept `GET` requests and URL
  parameters. Previously, Google sent a `PUT` request with the authorization
  code value in the payload.

### Authorization endpoint

Your authorization code endpoint must handle `GET` requests with these URL query
string parameters:

| Name | Value |
| --- | --- |
| authuser | Request for user sign-in authentication |
| code | An OAuth2 authorization code generated by Google |
| hd | The hosted domain of the user account |
| prompt | User consent dialog |
| scope | Space separated list of one or more OAuth2 scopes to be authorized |
| state | CRSF state variable |

Per RFC 6749, clients MUST ignore unrecognized response parameters, regardless
of whether they are listed in the preceding table.

Example `GET` request with URL parameters to an endpoint named *auth-code* and
hosted by example.com:

```
Request URL: https://www.example.com/auth-code?state=42a7bd822fe32cc56&code=4/0AX4XfWiAvnXLqxlckFUVao8j0zvZUJ06AMgr-n0vSPotHWcn9p-zHCjqwr47KHS_vDvu8w&scope=email%20profile%20https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/photoslibrary.readonly%20https://www.googleapis.com/auth/contacts.readonly%20openid%20https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile&authuser=0&hd=example.com&prompt=consent
```

When you initiate the authorization code flow using earlier JavaScript
libraries, or by making direct calls to Google OAuth 2.0 endpoints, Google
sends a `POST` request.

Example `POST` request containing the authorization code as a payload in the
HTTP request body:

```
Request URL: https://www.example.com/auth-code
Request Payload: 4/0AX4XfWhll-BMV82wi4YwbrSaTPaRpUGpKqJ4zBxQldU\_70cnIdh-GJOBZlyHU3MNcz4qaw
```

**Important:** Previously, `POST` was used for requests. Update your handler to
accept both `GET` and `POST` requests or consider hosting two different
endpoints if you plan to continue using older JS libraries or to directly call
Google OAuth 2.0 endpoints while using the Google Identity Services library.

### Validate the request

On your server do the following to help avoid CSRF attacks.

**Check** the value of the *state* parameter, for redirect mode.

**Confirm** that the `X-Requested-With: XmlHttpRequest` header is present for
popup mode.

You should then proceed with obtaining refresh and access tokens from Google
only if you have first successfully verified the auth code request.

## Get access and refresh tokens

After your backend platform receives an authorization code from Google and
verifies the request, use the auth code to obtain access and refresh tokens from
Google to make API calls.

**Follow the instructions** starting at [Step 5: Exchange authorization code for
refresh and access tokens](https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code) of the *Using OAuth 2.0 for Web Server
Applications* guide.

**Note:** When you use popup mode, the `redirect_uri` value you use in Step 5 and
later is the origin of the calling page. For example,
`https://www.example.com/index.html` calls `initCodeClient` and the origin:
`https://www.example.com` is the value of `redirect_url`.

### Manage tokens

Your platform securely stores refresh tokens. Delete stored refresh tokens when
you remove user accounts, or a user revokes consent by
[`google.accounts.oauth2.revoke`](https://developers.google.com/identity/oauth2/web/reference/js-reference#google.accounts.oauth2.revoke) or directly from
<https://myaccount.google.com/permissions>.

Optionally, you may consider RISC to [protect user accounts with Cross-Account
Protection](https://developers.google.com/identity/protocols/risc).

Typically, your backend platform will call Google APIs using an access token. If
your web app will also directly call Google APIs from the user's browser you
must implement a way to share the access token with your web application, doing
so is out of scope of this guide. When following this approach and using the
[Google API Client Library for JavaScript](https://github.com/google/google-api-javascript-client)
use `gapi.client.SetToken()` to temporarily store the access token in browser
memory, and enable the library to call Google APIs.
