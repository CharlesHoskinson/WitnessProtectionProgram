# Setup Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

Retrieved: 2026-09-19T16:30:26.976117+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* To add Sign In With Google or One Tap, you must first get an OAuth 2.0 client ID and configure OAuth branding and settings.
* Obtaining a Google API client ID is the initial step to enable Google Identity Services on your website and is required for configuring Sign In With Google and verifying ID tokens.
* The OAuth consent screen, which is part of both Sign In With Google and One Tap, informs users about the application requesting access and the data being requested.
* Loading the Google Identity Services client library is necessary on any page where a user might sign in.
* While optional, implementing a Content Security Policy is recommended to secure your app and prevent cross-site scripting attacks, and the policy may require specific directives to allow Google Identity Services to function correctly.
* The Cross-Origin-Opener-Policy may need to be adjusted to `same-origin` and include `same-origin-allow-popups` for popups to work correctly when FedCM is disabled.

To add a Sign In With Google button or One Tap and Automatic sign-in
prompts to your website you first need to:

1. get an OAuth 2.0 client ID,
2. configure OAuth branding and settings,
3. load the Google Identity Services client library, and
4. optionally setup Content Security Policy and
5. update Cross-Origin Opener Policy

**Note:** You must have a client ID to configure Sign In With Google and to
[verify ID tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) on your backend. A client ID looks like the following
example: `1234567890-abc123def456.apps.googleusercontent.com`

## Get your Google API client ID

To enable Google Identity Services on your website, you first need to set up a
Google API client ID. To do so, complete the following steps:

1. Open the [Clients page](https://console.developers.google.com/auth/clients)
   of the Google Cloud Console.
2. Create or select a Cloud Console
   project. If you already have a project for
   the Sign In With Google button or Google One Tap, use the existing project
   and the web client ID. When creating production applications,
   [multiple projects](https://developers.google.com/identity/protocols/oauth2/policies#separate-projects) may be necessary, repeat the remaining steps
   of this section for each project you manage.
3. Click **Create client** and for **Application type**
   select **Web application** to create a new client ID. To use an existing
   client ID select one of type **Web application**.
4. Add the URI of your website to **Authorized JavaScript origins**. The URI
   includes the scheme and fully qualified hostname only. For example,
   `https://www.example.com`.

   **Key Point:** For local tests or development add both `http://localhost` and
   `http://localhost:<port_number>`**Key Point:** Google One Tap can only be displayed in HTTPS domains.
5. Optionally, credentials may be returned using a redirect to an endpoint you
   host rather than through a JavaScript callback. If this is the case, add
   your redirect URIs to **Authorized redirect URIs**. Redirect URIs include
   the scheme, fully qualified hostname, and path and must comply with
   [Redirect URI validation rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation). For example,
   `https://www.example.com/auth-receiver`.

Include the client ID in your web app using the [data-client\_id](https://developers.google.com/identity/gsi/web/reference/html-reference#data-client_id)
or [client\_id](https://developers.google.com/identity/gsi/web/reference/js-reference#client_id) fields.

**Key Point:** When testing using http and localhost set the
[Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) header in your web app to
`Referrer-Policy: no-referrer-when-downgrade`. Loading `gsi/client` from
`accounts.google.com` is a cross-origin request, a Referrer-Policy of
`strict-origin-when-cross-origin` is recommended.

## Configure your OAuth Consent Screen

Both Sign In With Google and One Tap authentication include a consent screen
which tells users the application requesting access to their data, what kind of
data they are asked for and the terms that apply.

1. Open the [Branding page](https://console.developers.google.com/auth/branding) of the Google Auth Platform section of
   the Cloud Console.
2. If prompted, select the project you just created.
3. On the [Branding page](https://console.developers.google.com/auth/branding), fill out the form and click the "Save"
   button.

   1. **Application name:** The name of the application asking for consent.
      The name should accurately reflect your application and be consistent
      with the application name users see elsewhere.
   2. **Application logo:** This image is shown on the consent screen to help
      users to recognize your app. The logo is shown on Sign In With Google
      consent screen and on [account settings](https://myaccount.google.com/permissions), but is not shown on One Tap dialog.
   3. **Support email:** Shown on the consent screen for user support and to
      Google Workspace administrators evaluating access to your application
      for their users. This email address is shown to users on the
      Sign In With Google consent screen when the user clicks the
      application name.
   4. **Authorized domains:** To protect you and your users, Google only
      allows applications that authenticate using OAuth to use Authorized
      Domains. Your applications' links must be hosted on Authorized Domains.
      [Learn more](https://support.google.com/cloud/answer/6158849#authorized-domains).
   5. **Application Homepage link:** Shown on Sign In With Google consent
      screen and One-Tap GDPR compliant disclaimer information under the
      "Continue as" button. Must be hosted on an Authorized Domain.
   6. **Application Privacy Policy link:** Shown on Sign In With Google
      consent screen and One-Tap GDPR compliant disclaimer information under
      the "Continue as" button. Must be hosted on an Authorized Domain.
   7. **Application Terms of Service link (Optional):** Shown on Sign In With
      Google consent screen and One-Tap GDPR compliant disclaimer information
      under the "Continue as" button. Must be hosted on an Authorized Domain.
4. Navigate to the
   [Data Access page](https://console.developers.google.com/auth/scopes) to configure
   scopes for your app.

   1. **Scopes for Google APIs**: Scopes allow your application to access your
      user's private data. For the authentication, default scope (email,
      profile, openid) is sufficient, you don't need to add any sensitive
      scopes. It is generally a best practice to
      [request scopes incrementally](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth),
      at the time access is required, rather than upfront.
5. Check "Verification Status", if your application needs verification then
   click the "Submit For Verification" button to submit your application for
   verification. Refer to
   [OAuth verification requirements](https://support.google.com/cloud/answer/9110914)
   for details.

### Display of OAuth settings during sign-in

### One Tap using FedCM

![OAuth consent settings as displayed by Chrome One Tap using FedCM](/static/identity/gsi/web/images/onetap-fedcm-signup-callout.png)

The top-level **Authorized domain** is displayed during user consent in
Chrome. Only using One Tap in cross-origin but [same-site](https://web.dev/articles/same-site-same-origin) iframes
is a [**supported**](https://developers.google.com/identity/gsi/web/amp/intermediate-iframe#cross-origin-iframe) method.

### One Tap without FedCM

![OAuth consent settings as displayed by One Tap](/static/identity/gsi/web/images/one-tap-ui-fields.png)

The **Application name** is displayed during user consent.

**Figure 1.** OAuth consent settings displayed by One Tap in Chrome.

## Load the client library

Be sure to load the Google Identity Services client library on any page that
a user might sign in on. Use the following code snippet:

```
<script src="https://accounts.google.com/gsi/client" async></script>
```

You can optimize your pages loading speed if you load the script with the
`async` attribute.

Refer to the [HTML](https://developers.google.com/identity/gsi/web/reference/html-reference) and [JavaScript](https://developers.google.com/identity/gsi/web/reference/js-reference) API references for the list of
methods and properties the library supports.

**Note:** The Google Identity Services library is intended to be loaded
from `https://accounts.google.com/gsi/client` using a `<script>` element in
your web page. This ensures your integration always receives important security
updates and critical compatibility fixes. Note that self-hosting or using an
offline copy is not a supported use case and may lead to unexpected behavior or
future integration failures.

## Content Security Policy

While optional, a [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
is recommended to secure your app and prevent cross-site scripting (XSS)
attacks. To learn more, see an
[Introduction to CSP](https://csp.withgoogle.com/docs/index.html)
and [CSP and XSS](https://web.dev/csp/).

Your Content Security Policy might include one or more directives, such as
`connect-src`, `frame-src`, `script-src`, `style-src`, or `default-src`.

If your CSP includes the:

* `connect-src` directive, add `https://accounts.google.com/gsi/` to allow a
  page to load the parent URL for Google Identity Services server-side
  endpoints.
* `frame-src` directive, add `https://accounts.google.com/gsi/` to allow the
  parent URL of the One Tap and Sign In With Google button iframes.
* `script-src` directive, add `https://accounts.google.com/gsi/client` to
  allow the URL of the Google Identity Services JavaScript library.
* `style-src` directive, add `https://accounts.google.com/gsi/style` to allow
  the URL of the Google Identity Services Stylesheets.
* `default-src` directive, if used, is a fallback if any of the
  preceding directives (`connect-src`, `frame-src`, `script-src`, or
  `style-src`) is not specified, add `https://accounts.google.com/gsi/` to
  allow a page to load the parent URL for Google Identity Services server-side
  endpoints.

Avoid listing individual GIS URLs when using `connect-src`. This helps minimize
failures when GIS is updated. For example, instead of adding
`https://accounts.google.com/gsi/status` use the GIS parent URL
`https://accounts.google.com/gsi/`.

This example response header allows Google Identity Services to load and execute
successfully:

```
Content-Security-Policy-Report-Only: script-src
https://accounts.google.com/gsi/client; frame-src
https://accounts.google.com/gsi/; connect-src https://accounts.google.com/gsi/;
```

## Cross Origin Opener Policy

The Sign In With Google button and Google One Tap may require changes to your
[`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) (COOP) in order
to successfully create popups.

When [FedCM is enabled](https://developers.google.com/identity/gsi/web/guides/supported-browsers#compatibility) the browser directly renders popups and no changes
are necessary.

However, when FedCM is disabled, set the COOP header:

* to `same-origin` and
* include `same-origin-allow-popups`.

Failing to set the proper header breaks communication between windows, leading
to [a blank pop-up window](https://github.com/google/google-api-javascript-client/issues/796)
or similar bugs.
