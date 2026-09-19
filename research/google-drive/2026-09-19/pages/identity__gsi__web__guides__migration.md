# Migrate from Google Sign-In Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/migration

Retrieved: 2026-09-19T16:29:19.958523+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* This guide outlines the process for migrating JavaScript libraries from the older Google Sign-In platform to the newer Google Identity Services library for authentication.
* The new Google Identity Services library improves the user experience with features like One Tap and Automatic sign-in, a refreshed personalized button, and consistent branding.
* For developers, the new library reduces complexity, improves security, and allows for quicker integration, including the option to add sign-in using just HTML and the separation of authentication from authorization.
* Migration involves replacing the old JavaScript libraries with the new Google Identity Services library and updating your codebase to use the new sign-in object and methods.
* The new library uses a JSON Web Token (JWT) ID token for sign-in status and user profile information, replacing the need to work with OAuth 2.0 authorization codes, access tokens, or refresh tokens for authentication.

This guide helps you to understand the necessary changes and steps to
successfully migrate JavaScript libraries from the earlier [Google Sign-In
platform library](https://developers.google.com/identity/sign-in/web/sign-in) to the newer [Google Identity Services library](https://developers.google.com/identity/gsi/web) for
*authentication*.

If your client is using the Google API Client Library for JavaScript or other
earlier libraries for *authorization*, see [Migrate to Google Identity
Services](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis) for more information.

**Warning:** The [Google Sign-In JavaScript platform library for Web](https://developers.google.com/identity/sign-in/web/sign-in) is deprecated.
For migration help, see the
[authentication](https://developers.googleblog.com/2021/08/gsi-jsweb-deprecation.html) and
[authorization](https://developers.googleblog.com/2022/03/gis-jsweb-authz-migration.html) deprecation announcements and the
[Deprecation and Sunset](https://developers.google.com/identity/sign-in/web/deprecation-and-sunset) guide.

## Authentication and authorization

**Authentication** establishes who someone is, and is commonly referred to as
user sign-up or sign-in. **Authorization** is the process of granting or
rejecting access to data or resources. For example, your app requests your
user's consent to access the user's Google Drive.

Like the earlier [Google Sign-In platform library](https://developers.google.com/identity/sign-in/web/sign-in), the new [Google Identity
Services library](https://developers.google.com/identity/gsi/web) is built to support both authentication and authorization
processes.

However, the newer library separates the two processes to reduce the complexity
for developers to integrate Google Accounts with your app.

If your use case only concerns authentication, continue reading this page.

If your use case includes authorization, read [How user authorization works](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works)
and [Migrate to Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis) to make sure your application is
using the new and improved APIs.

## What's changed

For users, the new [Google Identity Services library](https://developers.google.com/identity/gsi/web) offers numerous
usability improvements. Highlights include:

* New low friction One Tap and Automatic sign-in flows with fewer individual
  steps,
* a refreshed sign-in button with user personalization,
* consistent branding and uniform sign-in behavior across the web improve
  understanding and trust,
* quickly get to content; users can directly sign-up and sign-in from anywhere
  on your site without first having to visit a login or account page.

For developers, our focus has been to reduce complexity, improve security, and
make your integration as quick as possible. Some of these improvements include:

* The option to add user sign-in to your site's static content using just
  HTML,
* separation of sign-in authentication from authorization and the sharing of
  user data, the complexity of an OAuth 2.0 integration is no longer necessary
  to sign users into your site,
* both popup and redirect modes continue to be supported, but Google's OAuth
  2.0 infrastructure now redirects to your backend server's login endpoint,
* consolidation of the capabilities from both of the earlier Google Identity
  and Google API JavaScript libraries into a single new library,
* for sign-in responses, you now get to decide whether or not to use a
  [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) and indirection through getter style functions has
  been removed for simplicity.

## A sign-in migration example

If you are migrating from the existing Google Sign-In button and are only
interested in signing users into your site, the most straightforward change is
to update to the new personalized button. This can be accomplished by swapping
JavaScript libraries and updating your codebase to use a new sign-in object.

### Libraries and configuration

The earlier Google Sign-In platform library: `apis.google.com/js/platform.js`,
and [Google APIs client library for JavaScript](https://developers.google.com/api-client-library/javascript): `gapi.client`, are no
longer required for user authentication and authorization. They have been
replaced by a single new Google Identity Services JavaScript library:
`accounts.google.com/gsi/client`.

The earlier three JavaScript modules: `api`, `client`, and `platform` used for
sign-in are all loaded from `apis.google.com`. To help you identify locations
where the earlier library might be included in your site, typically:

* the default sign-in button loads `apis.google.com/js/platform.js`,
* a custom button graphic loads `apis.google.com/js/api:client.js`, and
* direct usage of `gapi.client` loads `apis.google.com/js/api.js`.

In most cases you can continue to use your existing web application Client ID
credentials. As part of your migration we recommend that you review our
[OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies) and use the [Google API Console](https://console.developers.google.com)
to confirm, and if necessary, update the following client settings:

* your test and production apps use separate Projects and have their own
  Client IDs,
* the OAuth 2.0 Client ID Type is "Web application", and
* HTTPS is used for Authorized JavaScript origins and redirect URIs.

### Identify affected code and test

A debug cookie can help to locate affected code and to test post-deprecation
behavior.

In large or complex apps, it may be difficult to find all code affected by the
deprecation of the `gapi.auth2` module. To log existing use of soon to be
deprecated capabilities to the console, set the value of the `G_AUTH2_MIGRATION`
cookie to `informational`. Optionally, add a colon followed by a key value to
also log to [session storage](https://developer.chrome.com/docs/devtools/storage/sessionstorage/). After sign-in and receipt of
credentials review or send collected logs to a backend for later analysis. For
example, `informational:showauth2use` saves origin and URL to a session storage
key named `showauth2use`.

To verify app behavior when the `gapi.auth2` module is no longer loaded, set the
value of the `G_AUTH2_MIGRATION` cookie to `enforced`. This enables testing of
post-deprecation behavior in advance of the enforcement date.

Possible `G_AUTH2_MIGRATION` cookie values:

* `enforced` Don't load `gapi.auth2` module.
* `informational` Log use of deprecated capabilities to JS console. Also log
  to session storage when an optional key name is set:
  `informational:key-name`.

To minimize user impact it is recommended that you first set this cookie locally
during development and test, before using it in production environments.

### HTML and JavaScript

In this authentication-only sign-in scenario, example code and renderings of the
existing Google Sign-In button are shown. Select from either popup or redirect
mode to see differences in how the authentication response is handled either by
a JavaScript callback or by secure redirect to your backend server login
endpoint.

#### The earlier way

### Popup mode

Render the Google Sign-In button and use a callback to handle sign-in
directly from the user's browser.

```
<html>
  <body>
    <script src="https://apis.google.com/js/platform.js" async defer></script>
    <meta name="google-signin-client_id" content="YOUR_CLIENT_ID">
    <div class="g-signin2" data-onsuccess="handleCredentialResponse"></div>
  </body>
</html>
```

### Redirect mode

Render the Google Sign-In button, ending with an AJAX call from the user's
browser to your backend servers login endpoint.

```
<html>
  <body>
    <script src="https://apis.google.com/js/platform.js" async defer></script>
    <meta name="google-signin-client_id" content="YOUR_CLIENT_ID">
    <div class="g-signin2" data-onsuccess="handleCredentialResponse"></div>
    <script>
      function handleCredentialResponse(googleUser) {
        ...
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://yourbackend.example.com/tokensignin');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onload = function() {
          console.log('Signed in as: ' + xhr.responseText);
        };
        xhr.send('idtoken=' + id_token);
      }
    </script>
  </body>
</html>
```

### Rendered

New visual-attributes simplify the earlier method of creating a [customized
button](https://developers.google.com/identity/sign-in/web/build-button), eliminates calls to `gapi.signin2.render()`, and the need for
you to host and maintain images and visual assets on your site.

![Google Sign-In](/static/identity/gsi/web/images/google-sign-in.png "Google
Sign-In button, signed out state")

![Google Signed-In](/static/identity/gsi/web/images/google-signed-in.png "Google Sign-In
button, signed in state")

User sign-in status updates button text.

#### The new way

To use the new library in an authentication-only sign-in scenario select
from either the popup or redirect mode and use the code sample to replace your
existing implementation on your login page.

### Popup mode

Use a callback to handle sign-in directly from the user's browser.

```
<html>
  <body>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <div id="g_id_onload"
         data-client_id="YOUR_CLIENT_ID"
         data-callback="handleCredentialResponse">
    </div>
    <div class="g_id_signin" data-type="standard"></div>
  </body>
</html>
```

### Redirect mode

Google invokes your login endpoint as specified by the [data-login\_url](https://developers.google.com/identity/gsi/web/reference/html-reference#data-login_uri)
attribute. Previously, you were responsible for the POST operation and
parameter name. The new library posts the ID token to your endpoint in the
`credential` parameter. Lastly, [verify the ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) on your backend
server.

```
<html>
  <body>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <div id="g_id_onload"
         data-client_id="YOUR_CLIENT_ID"
         data-ux_mode="redirect"
         data-login_uri="https://www.example.com/your_login_endpoint">
    </div>
    <div class="g_id_signin" data-type="standard"></div>
  </body>
</html>
```

### Rendered

Use [visual-attributes](https://developers.google.com/identity/gsi/web/reference/html-reference#visual-attributes) to customize the Sign In With Google button
size, shape, color. Display the One Tap popup along with the personalized
button to improve sign-in rate.

![Sign In With Google
button](/static/identity/gsi/web/images/personalized-button-double.png "Personalized sign-in buttons")![One Tap
popup](/static/identity/gsi/web/images/one-tap-sign-in.png "One Tap sign-in
popup")

User sign-in state does not update the button text from "Sign in" to
"Signed in". After providing consent, or on return visits, the personalized
button includes the user's name, email, and profile picture.

**Note:** Use the [Code generator](https://developers.google.com/identity/gsi/web/tools/configurator) to interactively design your new button.

In this authentication-only example, the new `accounts.google.com/gsi/client`
library, `g_id_signin` class, and `g_id_onload` object replace the earlier
`apis.google.com/js/platform.js` library and `g-signin2` object.

In addition to rendering the new personalized button the example code also
displays the new One Tap popup. Wherever you display the personalized button we
highly recommend that you also display the One Tap popup to minimize user
friction during sign-up and sign-in.

Although it is not recommended due to increased sign-in friction, the new
personalized button can be shown alone, without simultaneously displaying the
One Tap dialog. To do this, set the `data-auto_prompt` attribute to `false`.

#### HTML and JavaScript APIs

The previous example shows how to use the new [HTML API](https://developers.google.com/identity/gsi/web/reference/html-reference) to add sign-in to
your website. Alternatively, you can use the functionally equivalent
[JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference), or mix and match HTML and JavaScript APIs across your
site.

To interactively view button customization options such as, callback type and
attributes such as: color, size, shape, text and theme, checkout our [Code
generator](https://developers.google.com/identity/gsi/web/tools/configurator). It can be used to quickly compare different options and generate
HTML snippets for use on your site.

#### Sign-in from any page with One Tap

One Tap is a new low-friction way for users to sign-up or sign-in to your site.
It lets you enable user sign-in directly from any page on your site and
eliminates the need for users to visit a dedicated login page. Put another way,
this reduces sign-up and sign-in friction by giving users the flexibility to
sign-up and sign-in from pages other than your login page.

To enable sign-in from any page we recommended that you include `g_id_onload` in
a shared header, footer or other object included across your entire site.

We also recommend adding `g_id_signin`, which displays the personalized sign-in
button, only on your login or user account management pages. Give users choices
for sign-up or sign-in by displaying the button alongside other federated
identity provider buttons and username and password entry fields.

**Note:** During development if you close the One Tap popup, thereby triggering the
[exponential cooldown](https://developers.google.com/identity/gsi/web/guides/features#exponential_cooldown) timer and suppressing the display of One Tap, you can
switch to Incognito mode to reset the cooldown status.

### Token response

User sign-in no longer requires you to understand or work with OAuth 2.0
authorization codes, access tokens, or refresh tokens. Instead a JSON Web Token
(JWT) ID Token is used to share sign-in status and the user profile. As a
further simplification, you are no longer required to use "getter" style
accessor methods to work with user profile data.

A secure Google-signed JWT ID token credential is returned either:

* to the user's browser-based JavaScript callback handler in popup mode, or
* to your backend server through a Google redirect to your login endpoint when
  the Sign In With Google button [`ux_mode`](https://developers.google.com/identity/gsi/web/reference/js-reference#ux_mode) is set to `redirect`.

In both cases, update your existing callback handlers by removing:

* calls to [`googleUser.getBasicProfile()`](https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile),
* references to `BasicProfile`, and associated calls to `getId()`,
  `getName()`, `getGivenName()`, `getFamilyName()`, `getImageUrl()`,
  `getEmail()` methods, and
* usage of the [`AuthResponse`](https://developers.google.com/identity/sign-in/web/reference#gapiauth2authresponse) object.

Instead, use direct references to `credential` sub-fields in the new JWT
[`CredentialResponse`](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse) object to work with user profile data.

Additionally, and for Redirect mode only, be sure to prevent Cross-Site Request
Forgery (CSRF) and [Verify the Google ID token on your backend server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

To better understand how users are interacting with your site the
[`select_by`](https://developers.google.com/identity/gsi/web/reference/js-reference#select_by) field in the CredentialResponse can be used to determine user
consent outcome and the specific sign-in flow used.

## User consent and revoking permission

When a user first signs-in to your website, Google prompts the user for consent
to share their account profile with your app. Only after providing consent is
the user's profile shared to your app in an ID token [credential payload](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse).
Revoking access to this profile is equivalent to revoking an access token in the
earlier sign-in library.

Users may revoke permissions and disconnect your app from their Google Account
by visiting <https://myaccount.google.com/permissions>.
Alternatively, they may disconnect directly from your app by triggering an API
call which you implement; the earlier [`disconnect`](https://developers.google.com/identity/sign-in/web/disconnect) method has been
replaced by the newer [`revoke`](https://developers.google.com/identity/gsi/web/guides/revoke) method.

When a user deletes their account on your platform it is best practice to use
`revoke` to disconnect your app from their Google Account.

Previously, `auth2.signOut()` could be used to help manage user [sign-out](https://developers.google.com/identity/sign-in/web/sign-in#sign_out_a_user)
from your app. Any usage of `auth2.signOut()` should be removed, and your app
should directly manage per user session state and sign-in status.

## Session state and Listeners

The new library does not maintain signed-in status or session state for your web
app.

The signed-in status of a Google Account, and your app's session state and
signed-in status are distinct, separate concepts.

User sign-in status to their Google Account and your app are independent of each
other, except during the sign-in moment itself when you know that the user has
successfully authenticated and is signed into their Google Account.

When Sign In With Google, One Tap, or Automatic sign-in are included on your
site users must first sign-in to their Google Account to:

* provide consent to share their user profile when first signing-up or
  signing-in to your site,
* and later for sign-in on return visits to your site.

Users may remain signed-in, sign-out, or switch to a different Google Account
while maintaining an active, signed-in session on your website.

You are now responsible for directly managing the signed-in status for users of
your web app. Previously, Google Sign-In helped with [Monitoring the user's
session state](https://developers.google.com/identity/sign-in/web/session-state).

Remove any references to `auth2.attachClickHandler()` and its registered
callback handlers.

Previously, [Listeners](https://developers.google.com/identity/sign-in/web/listeners) were used to share changes in signed-in status for a
user's Google Account. Listeners are no longer supported.

Remove any references to `listen()`, `auth2.currentUser`, and
`auth2.isSignedIn`.

## Cookies

Sign In With Google makes limited use of cookies, a description of these cookies
follows. See [How Google uses cookies](https://policies.google.com/technologies/cookies)
for more information on the other types of cookies used by Google.

The `G_ENABLED_IDPS` cookie set by the earlier Google Sign-in Platform Library
is no longer used.

The new Google Identity Services library may optionally set these cross-domain
cookies based upon your configuration options:

* `g_state` stores user sign-out status and is set when using the One Tap
  popup or Automatic sign-in,
* `g_csrf_token` is a double-submit cookie used to [prevent CSRF](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) attacks
  and is set when your login endpoint is called. The value for your login URI
  can be explicitly set or may default to the URI of the current page. Your
  login endpoint may be called under these conditions when using the:

  + [HTML API](https://developers.google.com/identity/gsi/web/reference/html-reference#data-login_uri) with `data-ux_mode=redirect` or when `data-login_uri` is
    set, or
  + [JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference#login_uri) with `ux_mode=redirect` and where
    `google.accounts.id.prompt()` is not used to display One Tap or
    Automatic sign-in.

If you have a service which manages cookies, be sure to add the two new cookies
and remove the earlier cookie when migration is complete.

If you manage multiple domains or subdomains, see [Display One Tap across
Subdomains](https://developers.google.com/identity/gsi/web/guides/subdomains) for further instructions on working with the `g_state` cookie.

## Object migration reference for user sign-in

| Old | New | Notes |
| --- | --- | --- |
| JavaScript libraries | | |
| apis.google.com/js/platform.js | accounts.google.com/gsi/client | Replace old with new. |
| apis.google.com/js/api.js | accounts.google.com/gsi/client | Replace old with new. |
| **GoogleAuth**  object and associated methods: | | |
| GoogleAuth.attachClickHandler() | [IdConfiguration.callback](https://developers.google.com/identity/gsi/web/reference/js-reference#callback) for JS and HTML [data-callback](https://developers.google.com/identity/gsi/web/reference/html-reference#data-callback) | Replace old with new. |
| GoogleAuth.currentUser.get() | [CredentialResponse](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse) | Use CredentialResponse instead, no longer necessary. |
| GoogleAuth.currentUser.listen() |  | Remove. A user's current sign-in status on Google is unavailable. Users must be signed-in to Google for consent and sign-in moments. The [select\_by](https://developers.google.com/identity/gsi/web/reference/js-reference#select_by) field in CredentialResponse can be used to determine the outcome of user consent along with the sign-in method used. |
| GoogleAuth.disconnect() | [google.accounts.id.revoke](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.revoke) | Replace old with new. Revocation may also occur from https://myaccount.google.com/permissions |
| GoogleAuth.grantOfflineAccess() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| GoogleAuth.isSignedIn.get() |  | Remove. A user's current sign-in status on Google is unavailable. Users must be signed-in to Google for consent and sign-in moments. |
| GoogleAuth.isSignedIn.listen() |  | Remove. A user's current sign-in status on Google is unavailable. Users must be signed-in to Google for consent and sign-in moments. |
| GoogleAuth.signIn() |  | Remove. HTML DOM loading of the [g\_id\_signin](https://developers.google.com/identity/gsi/web/reference/html-reference#element_with_id_g_id_onload) element or JS call to [google.accounts.id.renderButton](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.renderButton) triggers user sign-in to a Google Account. |
| GoogleAuth.signOut() |  | Remove. User sign-in status for your app and a Google Account are independent. Google does not manage session state for your app. |
| GoogleAuth.then() |  | Remove. GoogleAuth is deprecated. |
| **GoogleUser**  object and associated methods: | | |
| GoogleUser.disconnect() | [google.accounts.id.revoke](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.revoke) | Replace old with new. Revocation may also occur from https://myaccount.google.com/permissions |
| GoogleUser.getAuthResponse() |  |  |
| GoogleUser.getBasicProfile() | [CredentialResponse](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse) | Directly use `credential` and sub-fields instead of `BasicProfile` methods. |
| GoogleUser.getGrantedScopes() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| GoogleUser.getHostedDomain() | [CredentialResponse](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse) | Instead, directly use `credential.hd`. |
| GoogleUser.getId() | [CredentialResponse](https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse) | Instead, directly use `credential.sub`. |
| GoogleUser.grantOfflineAccess() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| GoogleUser.grant() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| GoogleUser.hasGrantedScopes() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| GoogleUser.isSignedIn() |  | Remove. A user's current sign-in status on Google is unavailable. Users must be signed-in to Google for consent and sign-in moments. |
| GoogleUser.reloadAuthResponse() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| **gapi.auth2**  object and associated methods: | | |
| gapi.auth2.AuthorizeConfig object |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.AuthorizeResponse object |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.AuthResponse object |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.authorize() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.ClientConfig() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.getAuthInstance() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.init() |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.OfflineAccessOptions object |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| gapi.auth2.SignInOptions object |  | Remove. An ID token has replaced OAuth 2.0 access tokens and scopes. |
| **gapi.signin2**  object and associated methods: | | |
| gapi.signin2.render() |  | Remove. HTML DOM loading of the [g\_id\_signin](https://developers.google.com/identity/gsi/web/reference/html-reference#element_with_id_g_id_onload) element or JS call to [google.accounts.id.renderButton](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.renderButton) triggers user sign-in to a Google Account. |
