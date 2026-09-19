# Overview Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/overview

Retrieved: 2026-09-19T16:29:15.913573+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Sign in with Google provides quick and secure user authentication on your website by allowing users to sign in with their Google Account and share profile information.
* The service supports customizable buttons and multiple flows for user sign-up and sign-in, including personalized buttons, One Tap, and Automatic sign-in.
* Sign in with Google does not use user data for ads or other non-security purposes and can be used to pre-populate accounts, protect forms, and enable easy return visits.
* The service includes supported features like signing up, signing in with account choosers or One Tap, automatic sign-in, and signing out across devices.
* Google Identity Services, on which Sign in with Google is based, aims to offer an easier and more secure experience for developers than standard OAuth and OpenID Connect protocols.

Sign in with Google helps you to quickly manage user authentication on your
website. Users sign into a Google Account, provide their consent, and securely
share their profile information with your platform.

Customizable buttons and multiple flows are supported for user sign-up and
sign-in.

Sign-up refers to the steps to obtain a Google Account holder's consent to share
their profile information with your platform. Typically, a new account is
created on your site using this shared data, but this is not a requirement.

Sign-in refers to logging users into your website using their active Google
Account with a [personalized sign-in button](https://developers.google.com/identity/gsi/web/guides/personalized-button) or [One Tap](https://developers.google.com/identity/gsi/web/guides/display-google-one-tap) and
[Automatic sign-in](https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out) for users already logged in to their Google Account.

See the [Case Studies](https://developers.google.com/identity/sign-in/case-studies) for some success stories
of Sign In With Google integrations.

You can also use the [Google Identity Services authorization API](https://developers.google.com/identity/oauth2/web/guides/overview), which lets
you obtain an access token for use with Google APIs, or to access user data.

## User privacy

Data from Sign in with Google is not used for ads or other non-security
purposes.

## Use cases

Some of the reasons to add Sign in with Google to your site are:

* Add a visibly trusted and secure Sign in with Google button to an account
  creation or settings page.
* Pre-populate new accounts with consensually shared data from a Google
  Account profile.
* Users can sign in once to a Google Account without re-entering usernames or
  passwords on other sites.
* On return visits, users can sign in automatically or with one click across
  an entire site.
* Use verified Google Accounts to protect comments, voting or forms from
  abuse, while allowing anonymity.

## Supported features

These features are supported by Sign in with Google:

* Sign up, to optionally create a new account auto-filled from a Google
  Account profile.
* Sign in, using an account chooser to select from multiple accounts.
* Sign in with one tap, if you've already signed in to your Google Account.
* Sign in automatically, on return visits using your computer, phone or even
  multiple browser tabs.
* Sign out, to disable automatic sign-in across all your devices.

Note how account states may affect Sign in with Google:

* Suspending your Google Account stops sign in to all sites using Sign in with
  Google.
* Deleting your Google or partner account affects one, but not the other.

## Compare to OAuth and OpenId Connect

OAuth and OpenId Connect are open standards that offer a wide range of
configurable options to fine-tune the behavior of authentication and
authorization flows. Refer to Google's
[OAuth documentation](https://developers.google.com/identity/protocols/oauth2) for more details.

Sign in with Google offers a single SDK to encompass several related offerings
including a personalized button, One Tap, Automatic sign-in, and authorization.
It aims to offer an easier and more secure experience for developers than the
standard OAuth and OpenID Connect protocols, while providing a more seamless
user experience.

* Sign in with Google is based on OAuth 2.0. The permissions that users
  granted through Sign in with Google are the same as those that they grant
  for OAuth, and the other way around.
* OAuth 2.0 is also the industry-standard protocol for authorization. It
  provides for a set of endpoints with which relying parties integrate using
  HTTP.
* Google Identity Services (GIS) APIs are available in several languages
  including JavaScript and HTML, that provide for both authentication and
  authorization.
* GIS separates the authentication moment from the authorization moment. In
  the authentication moment, a quick integration can be achieved by just
  integrating some UI elements into your website, such as the personalized
  button, One Tap, and automatic sign-in. These UI elements provide a
  consistent authentication UX across all third party websites. In the
  authorization moment, GIS triggers OAuth flows to return tokens for data
  access on behalf of the user.
* GIS authentication makes integration with relying parties easier, and
  reduces most of the OAuth and security knowledge burden on developers. You
  don't need to choose from various approaches to obtain access tokens or
  authorization code, or risk the consequences of choosing the wrong approach.
  While the OAuth 2.0 protocol exposes many details such as the request and
  response parameters of the HTTP endpoints, GIS handles these implementation
  details for you. Also, GIS includes some security implementations for
  Cross-Site Request Forgery (CSRF) protection by default.
* With the HTML API and [Code Generator](https://developers.google.com/identity/gsi/web/tools/configurator), the GIS authentication
  lowers the bar for relying parties integration even further. You don't need
  a JavaScript developer to generate the code. This reduces the level of OAuth
  experience required as well as time to implement.
* The GIS authorization UX is fully based on OAuth UX. However, the GIS
  JavaScript library adds some restrictions for easier and safer relying party
  integration.
* GIS also provides some features beyond the OAuth protocol. For example, it
  integrates [Password Credential Manager API](https://developers.google.com/identity/gsi/web/guides/display-browsers-native-credential-manager) and
  [Federated Credential Manager API](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies).

With Google Identity Services, developers can use a dedicated and integrated
service to help their users to sign in to the developer's website and apps with
whatever login credentials the user chooses. The mission of GIS is to support
and streamline the UX for multiple types of credentials, to lower the technical
bar for the relying party integration.

### Federated Credential Manager (FedCM)

As part of the [Privacy Sandbox](https://privacysandbox.com/intl/en_us/) initiative, Chrome is
[phasing out support for third-party cookies](https://privacysandbox.com/intl/en_us/open-web/#the-privacy-sandbox-timeline). GIS [integrates](https://developers.googleblog.com/2024/02/federated-credential-management-migration-for-google-identity-services.html) the
[FedCM API](https://developers.google.com/identity/gsi/web/guides/supported-browsers#third-party_cookies), which is a new privacy-preserving alternative to third-party
cookies for federated identity providers. GIS begins a migration of all websites
to FedCM on the Chrome browser in April 2024.

**Key Point:** For new web apps, you should always [enable FedCM](https://developers.google.com/identity/gsi/web/reference/js-reference#use_fedcm_for_button) when
integrating GIS to your website. For existing apps, you should
[migrate to FedCM](https://developers.google.com/identity/gsi/web/guides/fedcm-migration) to determine if your existing integration with GIS needs
to be updated.

### Separated authentication and authorization moments

To obtain an access token for use with Google APIs, or to access user data, you
need to call the [Google Identity Services authorization
API](https://developers.google.com/identity/oauth2/web/guides/overview). It's a separate JavaScript API, but
packaged together with the authentication API.

If your website needs to call both authentication and authorization APIs, you
need to call them separately at different moments. At the authentication moment,
your website can integrate with One Tap, automatic sign-in and the Sign In
with Google button to allow users to sign in or sign up to your website. At a
later time, when accessing data from Google is required, you call the
authorization API to ask for the consent and get access tokens for data access.
This separation complies with our recommended [incremental
authorization](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth) best
practice, in which the permissions are requested in context.

To enforce this separation, the authentication API can only return ID tokens
which are used to sign in to your website, whereas the authorization API can
only return code or access tokens which are used only for data access but not
sign-in.

Thanks to this separation, users have consistent authentication experiences
across different websites, which may increase user trust and usage, and
result in better user conversion rates on your website. Also, due to this
separation, Google Identity Services reduces the level of OAuth experience
required and time to implement for authentication developers.

**Key Point:** Google Identity Services designates Sign in with Google for the
authentication moment API and features. Google Identity Services designates the
[Authorization API](https://developers.google.com/identity/oauth2/web/guides/overview) for the authorization
moment API and features.
