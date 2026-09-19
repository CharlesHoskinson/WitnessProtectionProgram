# Choose a user authorization model Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model

Retrieved: 2026-09-19T16:29:23.005001+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* This guide helps you choose between Google Identity Services library and implementing your own JavaScript library for user authorization and select the best OAuth 2.0 flow for your web app.
* The Google Identity Services library simplifies implementation with features like popup consent flows, security features, and helper methods.
* Implementing without the library requires you to manage requests and responses, optimize user experience, implement security, confirm user consent, and handle errors.
* You must choose either the implicit or authorization code OAuth 2.0 flow, regardless of using the GIS library.
* Authorization code flow is recommended due to its higher security and support for offline use, though it requires a backend platform.

This guide helps you to choose between using the Google Identity Services
library for user authorization or implementing your own JavaScript library. It
helps you decide which OAuth 2.0 authorization flow is best for your web
application.

Prior to reading this guide it is assumed that you are familiar with the terms
and concepts described in the [Overview](https://developers.google.com/identity/oauth2/web/guides/overview) and
[How user authorization works](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works) guide.

The GIS library runs in these [supported browsers](https://developers.google.com/identity/gsi/web/guides/supported-browsers) on the user's device. It
is not intended for use with server-side JavaScript frameworks such as Node.js,
instead use Google's [Node.js](https://github.com/googleapis/google-api-nodejs-client)
client library.

This guide only covers authorization and data sharing topics. It does not review
user authentication, instead see [Sign In With Google](https://developers.google.com/identity/gsi/web) and the [Migrating
from Google Sign-In](https://developers.google.com/identity/gsi/web/guides/migration) guide for user sign-up and sign-in.

## Deciding if the GIS library is right for you

You must choose if using Google's library, or creating your own best fits your
needs. An overview of features and functionality:

* Google's Identity Services JavaScript library implements:
  + Dialog-based consent flows to minimize redirects, letting users
    remain on your site throughout the authorization process.
  + Security features such as Cross-site Request Forgery (CRSF).
  + Helper methods to request individual scopes and confirm user consent.
  + Human friendly error handling and documentation links for use by
    engineers during development and later for visitors to your site.
* When implementing without the Identity Services library you are responsible
  for:
  + Managing requests and responses with Google's OAuth 2.0 endpoints,
    including redirects.
  + Optimizing the user experience.
  + Implementation of security features to validate requests, responses, and
    to prevent CSRF.
  + Methods to confirm a user has granted consent for any requested scopes.
  + Managing OAuth 2.0 error codes, creating human readable messages, and
    links to user help.

In summary, Google offers the GIS library to help you to quickly, and securely
implement an OAuth 2.0 client and optimize the user's authorization experience.

## Choosing an authorization flow

You will need to choose one of two OAuth 2.0 authorization flows: implicit or
authorization code -- regardless if you decide to use the Google Identity
Services JavaScript library or to create your own library.

Both flows result in an access token which can be used to call Google APIs.

The primary differences between the two flows are:

* the number of user actions,
* whether your app will call Google APIs without the user present,
* if a backend platform is needed to host an endpoint and to store per-user
  refresh tokens for individual user accounts, and
* higher or lower levels of user security.

When comparing flows and evaluating your security requirements, a factor to
consider is that the level of user security varies depending on the scopes you
choose. For example, viewing calendar invites as read-only might be considered
less risky than using a read-and-write scope to edit files in Drive.

**Key Point:** Authorization code flow is recommended because it provides a more
secure flow.

## OAuth 2.0 flow comparison

|  |  |  |
| --- | --- | --- |
|  | **Implicit flow** | **Authorization code flow** |
| **User consent required** | For every token request, including replacing expired tokens. | Only for the first token request. |
| **User must be present** | Yes | No, supports offline use. |
| **User security** | Least | Most, has client authentication and avoids in-browser token handling risks. |
| **Access token issued** | Yes | Yes |
| **Refresh token issued** | No | Yes |
| **Supported browser required** | Yes | Yes |
| **Access token used to call Google APIs** | only from a web app running in the user's browser. | either from a server running on backend platform, or from a web app running in the user's browser. |
| **Requires backend platform** | No | Yes, for endpoint hosting and storage. |
| **Secure storage needed** | No | Yes, for refresh token storage. |
| **Requires hosting of an authorization code endpoint** | No | Yes, to receive authorization codes from Google. |
| **Access token expiration behavior** | A user gesture such as button press or clicking on a link is required to request and obtain a new, valid access token. | After an initial user request, your platform exchanges the stored refresh token to obtain a new, valid access token necessary to call Google APIs. |
