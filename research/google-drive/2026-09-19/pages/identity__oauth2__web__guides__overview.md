# Authorizing for Web Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/oauth2/web/guides/overview

Retrieved: 2026-09-19T16:29:22.121894+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Web apps need access tokens to securely call Google APIs.
* The Google Identity Services JavaScript library supports both user sign-in (authentication) and obtaining access tokens (authorization) for use with Google APIs in browsers.
* This library offers improved user usability through separate flows for sign-in and consent, better control over data sharing, and browser-based pop-up dialogs.
* For developers, this library simplifies integration by using a single library for both implicit and authorization code flows and separating authentication and authorization objects.

Web apps must obtain an access token to securely call Google APIs.

The Google Identity Services JavaScript library supports both authentication for
user sign-in and authorization to obtain an access token for use with Google
APIs. The library is intended only for use in browsers.

Authentication establishes who someone is, and is commonly referred to as user
sign-up or sign-in. Authorization is the process of granting or rejecting access
to data or resources. It includes obtaining and managing user consent, limiting
the amount of data or resources shared with scopes, and retrieving an access
token for use with Google APIs.

These guides cover authorization and data sharing topics.

[How user authorization works](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works) describes the individual steps of user
authorization in detail and includes user dialog examples.

If you are looking for help with authentication and how to implement user
sign-up and sign-in see [Sign In With Google](https://developers.google.com/identity/gsi/web/guides/overview).

**Note:** The `email`, `profile`, and `openid` scopes are used for user
authentication. If your app only uses these scopes [Sign In With Google](https://developers.google.com/identity/gsi/web) is
recommended instead.

This library is not intended for use with server-side JavaScript frameworks such
as Node.js, instead use Google's [Node.js](https://github.com/googleapis/google-api-nodejs-client)
client library.

## What's changed

For users, the Google Identity Services library offers numerous usability
improvements over earlier JavaScript libraries, including:

* Authentication for user sign-in, and authorization to obtain an access token
  to call Google APIs, now have two separate and distinct user flows; one for
  [sign-in](https://developers.google.com/identity/gsi/web/guides/overview#how_it_works) and another for [consent](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works#user_consent) during authorization, with separate
  user flows to clearly differentiate who you are, from what an app can do.
* Improved visibility and granular control of data sharing during [user
  consent](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works#user_consent).
* Browser-based dialogs to reduce friction, and which don't require
  users to leave your site to:
  + obtain an access token from Google, or
  + send an authorization code to your backend platform.

For developers, our focus has been to reduce complexity, improve security, and
simplify your integration. Some of these changes are:

* User [authentication](https://developers.google.com/identity/gsi/web/reference/js-reference) for sign-in, and [authorization](https://developers.google.com/identity/oauth2/web/reference/js-reference) used to obtain
  an access token to call Google APIs, are two separate and distinct sets of
  JavaScript objects, and methods. This reduces the complexity and amount of
  detail required to implement authentication or authorization.
* A single JavaScript library now supports both the:
  + OAuth 2.0 implicit flow, used to obtain an access token for use
    in-browser
  + OAuth 2.0 authorization code flow, also known as offline access, and
    initiates securely delivering an authorization code to your backend
    platform, where it can be exchanged for an access token and refresh
    token. Previously, these flows were only available by using multiple
    libraries and through direct calls to OAuth 2.0 endpoints. A single
    library decreases your integration time and effort, instead of including
    and learning multiple libraries and OAuth 2.0 concepts you can focus on
    a single, unified interface.
* Indirection through getter style functions has been removed for simplicity
  and readability.
* When handling authorization responses you choose whether or not to use a
  [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) to fulfill requests, instead of that decision
  being made for you.
* The [Google API Client Library for JavaScript](https://github.com/google/google-api-javascript-client) has been
  updated with these changes:
  + the `gapi.auth2` module and associated objects and methods are no longer
    automatically loaded for you behind the scenes, and have been replaced
    with more explicit Google Identity Services library objects and methods.
  + Automatic refresh of expired access tokens has been removed to improve
    user security and awareness. After an access token expires your app must
    handle Google API error responses, request, and obtain a new, valid
    access token.
  + To support a clear separation of authentication and authorization
    moments, simultaneously signing a user in to your app and to their
    Google Account while also issuing an access token is no longer
    supported. Previously, requesting an access token also signed users into
    their Google Account and returned a JWT ID token credential for user
    authentication.
* To increase user security and privacy, per user [credentials](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis#example_credentials) issued for
  authorization follow the principle of least privilege by including only an
  access token and information required to manage it.
