# Revoke ID tokens Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/gsi/web/guides/revoke

Retrieved: 2026-09-19T16:30:27.853049+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* User consent for sharing an ID token can be revoked.
* Users provide consent to share profile information upon first sign-in, which results in an ID token being shared.
* Revoking consent stops Google from sharing the ID token on subsequent visits.
* Consent can be revoked by the user in their Google Account settings or by your platform calling the `google.accounts.id.revoke` method.
* The revoke method discussed applies only to ID token sharing, not OAuth 2.0 authorization scopes.

## Overview

User consent to share an ID token can be revoked.

Users signing in for the first time are prompted for consent to share their
Google Account profile information with your platform.

If user consent is given a JSON Web Token (JWT)
[credential](https://developers.google.com/identity/gsi/web/reference/js-reference#credential) known as an
ID token is shared when any of the Sign In With Google, One Tap or Automatic
sign-in buttons are loaded.

A common scenario is for a new user account to be created on your platform
during sign up. Later, a user may choose to delete their account and "unlink"
your platform from their Google Account, stopping ID token sharing.

Calling the revoke method requires the Google Account owner to re-consent to
share the ID token on their next visit to your site.

## Revocation methods

Google uses an OAuth 2.0 grant to manage user consent and ID token sharing to
your platform's Client ID. Revoking consent stops Google from sharing the
ID token when the client library is loaded by any pages on your site.

These methods can be used to revoke consent,

1. Users sign in to their Google Account, find your app in the
   [Third-party apps with account access](https://myaccount.google.com/permissions)
   settings and select **Remove Access**.
2. Your platform calls
   [`google.accounts.id.revoke`](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.revoke).

The following code sample shows how to use the `revoke` method.

```
  google.accounts.id.revoke('user@google.com', done => {
    console.log('consent revoked');
  });
```

**Key Point:** This method applies only to ID token sharing and cannot be used to
manage OAuth2.0 authorization scopes. OAuth revocation methods cannot be used
to manage ID token grants.
