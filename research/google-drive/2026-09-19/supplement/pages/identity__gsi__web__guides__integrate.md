# Integration considerations Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/integrate

Retrieved: 2026-09-19T16:30:26.236278+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* This guide provides steps and considerations for integrating Sign in with Google into your website.
* Sign in with Google provides an alternative authentication method to password-based logins but does not manage website session after authentication.
* Websites requiring access to Google APIs on behalf of users should integrate both authentication and authorization APIs, calling them separately.
* The Sign in with Google button supports both pop-up and redirect user experiences, with the pop-up being the default and often preferred for its in-context experience.
* The HTML API offers built-in features like rendering on page load and server-side submission, while the JavaScript API provides more flexibility for scenarios requiring dynamic rendering or multiple API calls.

This step-by-step guide helps you to make decisions on all major integration
issues.

## Sign in with Google in the abstract

The following is the general steps for users to sign-in / sign-up on your
website.

1. Users sign into a Google website.

   For Sign in with Google to work, there should be an active Google session in
   the browser. One Tap and Automatic Sign-in are triggered only when users
   have signed in to Google before loading your web pages. This step is
   optional for the Sign in with Google button flow, since users are prompted
   to sign in to Google when the button is pressed.

   **Key Point:** Due to security reasons, it's not allowed to add new Google
   sessions in an iframe.
2. Users browse your web pages where One Tap, Automatic Sign-in or Sign in with
   Google button are embedded.

   **Key Point:** You can use the [code generator](https://developers.google.com/identity/gsi/web/tools/configurator) to generate code to
   embed One Tap, Automatic Sign-in and Sign in with Google button into your
   web pages.
3. Users interact with One Tap, the Sign in with Google button and subsequent
   UX flows so as to:

   * Select an active Google session to continue.
   * Get consent from end users for sharing profile information with your
     website, if haven't consented yet.**Key Point:** Automatic Sign-in happens when only one Google active session has
   previously granted the permission, and the feature is enabled by your
   website.**Note:** Automatic Sign-in can only happen with One Tap UX, not with the Sign
   in with Google button UX.

   When there is only one active Google session in the browser,

   * One Tap selects the only session automatically, and thus skips the
     account chooser page.
   * The Sign in with Google button stays on the account chooser page, which
     allows users to add new a Google session when needed.

   If the selected Google Account hasn't been used before with your website, or
   the permission has been revoked, a consent page will display.

   ![Sign in with Google button consent screen](/static/identity/gsi/web/images/sign-in-dialog-box-oauth.png)

   Once approved, Google will record the decision, so as to skip the consent
   page for the next time.
4. A JSON Web Token (also referred to as ID token) [credential](https://developers.google.com/identity/gsi/web/reference/js-reference#credential) containing
   the user's name, email and profile picture is shared using either a
   JavaScript callback handler or a post submission to your backend service.

   The purpose of returning ID tokens to the JavaScript callback handler on the
   client side, is not for you to decode it in the JavaScript code, but for you
   to submit it to your server in your own way. One good example is to use an
   XmlHttpRequest to avoid the page reload caused by the post submission.

   **Key Point:** To authenticate without reloading your web page, a common
   practice is to receive the JWT credential using a JavaScript callback
   handler, then to submit it to your server using an XmlHttpRequest.
5. On your server side, the Google-issued JWT credential is validated and
   consumed to create a new account or establish an authenticated session
   on your website.

   You'll manage the user sign-in status on your own website.

   The user's Google Account sign-in status and your app are independent of
   each other, except during the sign-in moment itself when you know that the
   user has successfully authenticated and is signed into their Google Account.
   Users may remain signed in, they may sign out, or switch to a different
   Google Account while maintaining an active, signed-in session on your
   website.

In summary, like the password-based login,
**Sign in with Google provides another way to authenticate users on the web**.
Sign in with Google doesn't provide any features for the session management on
your website after authentication.

## Access Google APIs and services

While you have integrated the authentication API, as described earlier, you may
also need to integrate the **authorization** API, if your site needs to access
Google APIs and services on behalf of authenticated users. While authentication
provides your site with ID tokens to authenticate users, authorization provides
your site with (separate) access tokens and permissions to use Google APIs and
services. See [Authorizing for web](https://developers.google.com/identity/oauth2/web/guides/overview) for more information.

## UX separation for authentication and authorization

If your website needs to call both authentication and authorization APIs, you
must call them separately at different moments. See [Separating the
authentication and authorization moments](https://developers.google.com/identity/gsi/web/guides/overview#separated_authentication_and_authorization_moments).

If your website has requested authentication and authorization tokens together
in the past, when using the Google Identity Services JavaScript library, you
need to adjust your UX to separate the authentication moment from the
authorization moment.

* At the authentication moment, your website can integrate with One Tap,
  Automatic Sign-in, or Sign in with Google button to let users to sign
  in or sign up to your website.
* At the authorization moment, your website can invoke the authorization API
  to obtain the permissions and tokens to access Google APIs or services.

For a smooth UX transition and complexity reduction, a common practice is to
divide the process into two separated steps.

1. Refactor the UX to separate the authentication and authorization moments.
2. Migrate to the Google Identity Services JavaScript library.

   **Key Point:** We'll focus on the authentication moment API and features
   hereinafter. Refer to the [Authorization API doc](https://developers.google.com/identity/oauth2/web/guides/overview) for the authorization
   moment API and features.

## HTML API versus JavaScript API

You can use either the [HTML API](https://developers.google.com/identity/gsi/web/reference/html-reference) or the [JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference) to integrate One
Tap, Automatic Sign-in, or Sign In With Google button into your web pages.

With the HTML API, you have more built-in features. For example,

* Rendering One Tap or the Sign in With Google button on page load.
* Submit the returned credential to your server side endpoint, which is
  specified by the [`data-login_uri`](https://developers.google.com/identity/gsi/web/reference/html-reference#data-login_uri) attribute, after One Tap, Automatic
  Sign-in or button pop-up/redirect UX is done.
* Prevent CSRF attacks by [double-submit-cookie](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
* Use the [code generator](https://developers.google.com/identity/gsi/web/tools/configurator) to generate the HTML code, then just copy it
  into your HTML pages.

With the HTML API, you can also write some JavaScript to customize the behavior.

* You can write your own callback handler, then set the function name to the
  [`data-callback`](https://developers.google.com/identity/gsi/web/reference/html-reference#data-callback) attribute. One good example is to use an
  XmlHttpRequest to submit the returned credential to your server, to avoid
  the page reload caused by the default post submission.

  **Key Point:** To authenticate without reloading the web page, a common practice
  is receiving the JWT credential by a JavaScript callback handler, then
  submitting it to your server using an XmlHttpRequest.

With the JavaScript API, you have more flexibility on some scenarios.

* Rendering One Tap and the Sign in with Google button at a later moment. For
  example, after users select **Login** from the menu.
* Calling the API multiple times. For example, the Sign in with Google button
  needs to be rendered each time the login dialog is rendered.
* Generating your HTML pages dynamically, making it hard to embed API-calling
  code within them.
* You load the Google Identity Services JavaScript library at a much later
  time.

HTML API code can only be invoked once either on the page onload event or the
Google Identity Services JavaScript library onload event, whichever comes
later. You should use the JavaScript API if the HTML API behavior doesn't meet
your expectation.

**Note:** You're recommended to use the HTML API, if possible.

Don't use the HTML API with the JavaScript API in the same web page for
initializing the page or for One Tap and button rendering. Check your code, both
HTML and JavaScript, for places where they may overlap. Note the following:

* You're using HTML API if one or more of the elements in `<div
  id='g_id_onload' ... ><id>` or `<div class='g_id_signin' ...></div>` exist
  in your HTML code.
* You're using JavaScript API if one or more of the methods in `initialize()`,
  `prompt()`, or `render()` are invoked in your JavaScript code, no matter
  whether they are inlined or loaded from a separated JavaScript file.

**Warning:** Using both the HTML API and the JavaScript API together in the same
web page for initializing the page or for One Tap and button rendering may
cause some tricky bugs, such as One Tap and buttons rendered twice.

The following JavaScript APIs may be used independently of initializing or One
Tap and button rendering; these don't have corresponding HTML APIs:

* [`revoke`](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.revoke)
* [`cancel`](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.cancel)
* [`disableAutoSelect`](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.disableAutoSelect)
* [`storeCredential`](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.storeCredential)

## Sign in with Google button considerations

This section discusses the considerations for integrating the Sign in with
Google button into your website.

### Pop-up versus redirect

The OAuth 2.0 specification considers HTTP redirection, but lacks guidance on
rendering pop-up dialogs. The pop-up UX, especially on desktop web, may provide
a better UX for end users. This is because users are not redirected away from
third-party pages, and a dialog-like pop-up window provides an in-context
experience for permission granting.

With the pop-up UX, the identity provider needs to build on client-side
cross-origin communication channels to pass OAuth responses from the pop-up
window, where the identity provider's consent page is displaying, to the main
window, where the third-party page is displaying. Normally JavaScript codes is
required on both sides to send and receive the OAuth response across windows.

Both the pop-up and redirect UX are supported by the Sign in with Google button.
By default, the pop-up UX is used. You can change the UX by setting the
[`data-ux_mode`](https://developers.google.com/identity/gsi/web/reference/html-reference#data-ux_mode) attribute.

**Key Point:** The Sign in with Google button supports pop-up UX.

There are some differences between the Sign in with Google button redirect flow
and the OAuth redirect flow.

* The Sign in with Google button redirect flow always uses the `POST` method
  to submit the credential to your web server, whereas OAuth redirect normally
  uses the `GET` method.
* The [parameters](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) submitted by the Sign in with Google button redirect
  flow are different from those of the OAuth redirect flow.

For developers using the HTML API, no matter which UX is used, the credentials
are always submitted to the [`data-login_uri`](https://developers.google.com/identity/gsi/web/reference/html-reference#data-login_uri) with the `POST` method and the
same parameters. This lets you switch the UX mode without other code changes.
For the redirect UX, the `data-login_uri` must be added to the
**Authorized redirect URIs** for your client in the
[Google APIs console](https://console.developers.google.com/apis).

**Key Point:** Note the differences between Sign in with Google button redirect
flow and the OAuth redirect flow.

### Button customization

Using your own button is not supported. There is no API to programmatically
initiate a button flow.

To enable Sign in with Google button flow, all you need to do is to render one
or more Sign in with Google buttons on your web pages. The button flow is
initiated and handled transparently when users click these buttons.

The button rendering API lets you customize the look and feel of the Sign
in with Google button. You're recommended to use the [code generator](https://developers.google.com/identity/gsi/web/tools/configurator) to
interactively design your buttons. Even if you use the JavaScript API, you can
generate the HTML code first, then copy the code into corresponding fields in
the JavaScript API.

There is no API to allow websites to control whether the personalized
information should be used to render the buttons. The personalized buttons is
displayed if all conditions are met. More details at
[Understand Personalized button](https://developers.google.com/identity/gsi/web/guides/personalized-button).

You can put multiple buttons in the same web page. The code generator can only
create one button each time. You can run it several times, and copy the
generated `<div class='g_id_signin' ...></div>` code into the web page.

**Warning:** You can only have one `<div id='g_id_onload' ... ><id>` element in
the same web page. Don't copy multiple `g_id_onload` elements into your web
page.

### Button rendering best practices

Due to privacy reasons, the personalized button is shown in an iframe from the
accounts.google.com domain. Loading an iframe may be time-consuming on a slow
network. To mitigate this latency issue, the buttons are rendered in 2 steps, as
follows:

1. An inline button version is rendered in your website's DOM tree. It's just a
   text button, no personalized info can be used. The purpose is to allow users
   to see the button as soon as possible.
2. An iframe request is sent to Google to load the button iframe, which may
   have personalized information. Once the button iframe is loaded, the inline
   version button is removed.

Some best practices to minimize the latency of displaying the Sign in with
Google button flow button are listed.

* Load the Google Identity Services JavaScript library as early as possible.
  Consider loading the JavaScript library before some other big libraries,
  especially on mobile web.
* If the Sign in with Google button is rendered only after the user selects
  **Login** from the menu. You can render the Sign in with Google button in a
  hidden element first, then make it visible after the user selects **Login**
  from the menu.

  **Key Point:** Load the Google Identity Services JavaScript library as early as
  possible to minimize the latency of displaying the Sign in with Google
  button.

## One Tap considerations

This section contains topics and features to be aware of when implementing
One Tap or Automatic sign-in.

### Automatic sign-in

The automatic sign-in feature allows users to sign in to your website without
clicking the One Tap prompt if they have previously granted permission to your
website.

[Cancelable automatic sign-in](https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out) provides the following benefits.

* It may improve the sign-in rate by saving one user action.
* Unlike the silent sign-in provided by earlier, deprecated
  [Google Sign-In](https://developers.google.com/identity/sign-in/web/sign-in) JavaScript library, users always see some UI when
  automatic sign-in happens, which gives them the context of why and how they
  are signed into your website. Users also have the ability to cancel if they
  want.
* It automatically selects the account the user used before, which may prevent
  the user from creating duplicate accounts on your website.

Whether to enable automatic sign-in is a decision you need to make based on the
UX and business requirements of your website. Especially if most logouts from
your website are caused by session timeout instead of explicit user choices,
automatic sign-in may be a good way for your users to recover the session
status.

### When to display the One Tap UI

With the HTML API, One Tap always displays on page load. With the JavaScript
API, you have the ability to control when the One Tap UI displays. Note the One
Tap UI may not always display after the API is invoked, due to the following
reasons.

* No active Google session in the browser.
* All active Google sessions are [opted out](https://developers.google.com/identity/gsi/web/guides/features#globally_opt_out).
* [Cooldown](https://developers.google.com/identity/gsi/web/guides/features#exponential_cooldown) is in progress.

Don't try to display only the One Tap UI on a button click event. The One Tap
UI may not display due to listed reasons, and users may have a broken UX, since
nothing displays after the user action. On a button click event:

Recommended

* Show your login dialog with password login and the Sign in with Google
  button and call One Tap API at the same time. This ensures that users are
  always offered some method of sign-in for your website.

Not Recommended

* Offering only One Tap, users may experience a broken sign-in experience if
  One Tap is not displayed.
* Using a [UI status callback](https://developers.google.com/identity/gsi/web/guides/receive-notifications-prompt-ui-status) to show another UI if One Tap doesn't
  display. This is not recommended as the UI status callback may not work
  well with [federated credential management](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies) in a future release.

### One Tap on ITP browsers

Due to [Intelligent Tracking Prevention](https://webkit.org/blog/9521/intelligent-tracking-prevention-2-3/) (ITP), the
normal One Tap UX doesn't work on ITP browsers, such as Chrome on iOS, Safari
and Firefox. A different UX starting with a welcome page is provided on these
browsers instead.

The One Tap UX on ITP browsers can be disabled if you want. Refer to
[One Tap support on ITP browsers](https://developers.google.com/identity/gsi/web/guides/itp) for more details.

**Note:** The One Tap UX on ITP browsers doesn't support automatic sign-in.

There is no way to enable this UX on non-ITP browsers, such as Chrome on
Android/macOS/Linux and Edge.

### Cancel the prompt if the user clicks away

By default, the One Tap prompt closes automatically if the user clicks outside
of the prompt. This behavior can be changed if you want.

You are recommended to keep the One Tap prompt open on desktop web, since the
screen size is big enough.

**Note:** When a pop-window opens due to a Sign In With Google button click, the
One Tap UI on the same page of that button closes, to avoid two ongoing Sign In
With Google UX flows presented to the user at the same time. This behavior is
not affected by above-mentioned cancel settings.

### Change the position of the One Tap UX

On desktop web, you can [change the position of the One Tap prompt](https://developers.google.com/identity/gsi/web/guides/change-position).
However, this feature is not recommended since this feature are not
supported by [federated credential management](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies) in a future release.

**Warning:** if you changes the position of the One Tap prompt, you may need some
code or UI changes in a future release when One Tap incorporates anticipated
[federated credential management](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies).

### Change the sign-in context

One Tap should be part of a bigger UX flow on your website. By default, the One
Tap UI is used within a sign-in context. The language in the UI contains
particular wording, such as "sign in." You can change the context attribute to
create a different set of wording. You can
[select one of the One Tap headers](https://developers.google.com/identity/gsi/web/guides/change-sign-in-context) that best suits your UX flow.

| Context | |
| --- | --- |
| `signin` | "Sign in with Google" |
| `signup` | "Sign up with Google" |
| `use` | "Use with Google" |

**Key Point:** Refer to [Change the One Tap sign-in context](https://developers.google.com/identity/gsi/web/guides/change-sign-in-context) on how to
change the context.

### Listen on One Tap UI status

To seamlessly integrate into your bigger UX flow, One Tap can [notify you when
UI status changes](https://developers.google.com/identity/gsi/web/guides/receive-notifications-prompt-ui-status). However, this feature is not supported in future
[federated credential management](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies) releases.

**Warning:** if you listen on One Tap UI displaying status, you may need some code
or UI changes in a future release when One Tap incorporates
[federated credential management](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies).

### One Tap across subdomains

By default, One Tap cooldown and other statuses are tracked per-origin. If your
website display One Tap across multiple subdomains, you need to indicate so in
your API code.

**Key Point:** Refer to [Display One Tap across Subdomains](https://developers.google.com/identity/gsi/web/guides/subdomains) for more details.

### One Tap in static HTML pages

By default, the GIS library assumes your web pages are dynamically generated.
Your HTTP server checks for user login status when generating the HTML code.

* If no user is logged in, One Tap HTML code should be included in the
  resulting page, so as to trigger One Tap to allow users to sign in to your
  website.
* If users are already logged in, One Tap HTML code shouldn't be included in
  the resulting page.

In this case, it's your web server's responsibility to add or remove One Tap
HTML API code.

One Tap HTML API code can work in another way, which is designed for websites
that host a lot of static HTML content. You can always include the One Tap HTML
API code in your static HTML pages, and specify the session cookie name used in
your website.

* If the session cookie doesn't exist, the One Tap flow is triggered.
* If the session cookie exists, the One Tap flow is skipped.

In this case, whether to trigger the One Tap flow is controlled by your session
cookie status, instead of the existence of the One Tap HTML API code in your web
page.

**Key Point:** Refer to [Toggle the One Tap display with cookies](https://developers.google.com/identity/gsi/web/guides/toggle-display-with-cookies) for more
details.**Key Point:** There is no way to toggle the Sign in with Google button rendering
with cookies, since it's normally used in your main login dialog instead of
content pages.

## Server side integration

After One Tap, automatic sign-in or the Sign in with Google button UX flow is
done, an ID token is issued and shared with your website. To authenticate
the user, some server side changes are required to receive and validate the ID
token.

### UX considerations

Normally you need to add an HTTP endpoint in your own origin to handle the
responses on your server side. The following factors may have an impact on the
resulting UX.

* Whether One Tap or Sign in with Google is triggered.
* Whether the HTML API or the JavaScript API is used.
* Whether the [login URI](https://developers.google.com/identity/gsi/web/reference/html-reference#data-login_uri) or the [JavaScript callback function](https://developers.google.com/identity/gsi/web/reference/html-reference#data-callback) is used
  to handle the response.

The actual UX you get is described as following.

1. For the Sign in with Google button redirect UX mode:

   * Whether the HTML API or the JavaScript API is used, you need to set the
     login URI. It's impossible to use a JavaScript callback function to handle
     the response, since users have already been redirected away from your
     web page.
   * UX summary: after clicking the Sign in with Google button, users see a
     full-page redirect to a Google UI for session selection and approval.
     Once done, a full-page `POST` is submitted to the login URI you
     specified.
2. For One Tap or the Sign in with Google button pop-up UX mode, if the
   JavaScript API is used, or the HTML API is used and a JavaScript callback
   function is provided:

   * The auth responses are passed back to the JavaScript callback function.
   * UX summary: The One Tap prompt or a pop-up window is shown above your
     web page. After users finish the UX in the prompt or pop-up window for
     session selection and approval, the JavaScript callback function
     receives the responses. The subsequent UX is decided by how your
     callback function submits the responses to your server.**Key Point:** To authenticate without reloading your web page, a common
   practice is to receive the auth response by the JavaScript callback
   function, then submit it to your server using an XmlHttpRequest.**Key Point:** To enforce your own security measures, you can receive auth
   responses by the JavaScript callback function, then submit them with
   other parameters required by your website.
3. Otherwise (the HTML API with the login URI case):

   * The auth responses are submitted to the login URI.
   * UX summary: the One Tap prompt or a pop-up window is shown above your
     web page. After users finish the UX in the prompt or pop-up window for
     session selection and approval, the auth responses is submitted using
     a full-page `POST` submission to the login URL you specified.

You are recommended to use a consistent way to submit the One Tap responses and
the Sign in with Google button responses.

### Security considerations

To **prevent Cross-Site Request Forgery** attacks,

* For post submission triggered by the Google Identity Service client
  JavaScript library, you can use the built-in double-submit-cookie pattern.
  Refer to [Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) for more
  details.
* For submission to your own origin using an XmlHttpRequest, you can use the
  [custom HTTP header](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#use-of-custom-request-headers), or other security measures approved by your
  security team.

To **verify the ID tokens** in the auth responses, you are strongly recommended
to use a Google API client library for your platform, or a general-purpose JWT
library.

## Frequently asked questions (FAQ)

* **Is One Tap and Sign in with Google button available in webviews?**

  No. Due to security concerns, users shouldn't add Google sessions into
  webviews. Thus, GIS are disabled in webviews, since no Google sessions are
  supposed to be there.
* **Can I use my own Sign in with Google button?** No. With OAuth server side
  flow or the earlier version Google Sign In JavaScript library, relying
  parties were able to use the Sign-In Branding Guidelines to build their own
  versions of Google Sign In buttons.

  However, Sign in with Google has removed this feature. All Sign in with
  Google buttons must be generated by the Google Identity Services JavaScript
  library. There are two reasons for this change.

  + Some relying parties failed to follow the guidelines, which leads to
    inconsistent Sign in with Google buttons across websites.
  + By generating by the library, you don't need to make any changes when
    the Sign-In Branding Guidelines itself change.

  To enforce this rule, the JavaScript library only exposes an API to render a
  button, but not the API to start the sign in flow.
* **What if my website only enables One Tap but not Sign in with Google
  button?**

  You are recommended to use both One Tap and the Sign in with Google button
  on your website. Due to exponential cool-down, One Tap may not be displayed
  every time. When users really want to sign in to your website with their
  Google Accounts, they can go to your main login dialog and sign in with the
  Sign in with Google button there. A successful sign in using the Sign In
  with Google button will clear the One Tap cool-down status so that One Tap
  can display for the next login.
  **Other button flows from Google cannot clear the One Tap cool-down
  statuses**, since they are in different JavaScript binaries.

  If your website only enables One Tap but not the Sign in with Google button,
  you may see performance drop for your One Tap flow, since the exponential
  cool-down statuses is not cleared in time.
* **When is my HTML API code parsed, can I change it later?**

  The Google Identity Services JavaScript library parses and executes your
  HTML API code **either on the JavaScript library load event or the
  DomContentLoaded event, whichever is later**.

  + If the DomContentLoaded event is triggered when the JavaScript library
    is loaded, your HTML API code is parsed and executed immediately.
  + Otherwise, the JavaScript library adds a listener for the
    DomContentLoaded event. When triggered, the listener parses and
    executes your HTML API code.

  Also note that **the parsing and execution of your HTML API code is one
  off**.

  + After the parsing and execution, any subsequent changes to your HTML API
    code are ignored.
  + There is no API for developers to trigger the parsing or execution
    process.**Tip:** Use the JavaScript API if the above-mentioned behaviors don't meet your
  requirements.
