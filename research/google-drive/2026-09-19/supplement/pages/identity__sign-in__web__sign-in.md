# Integrating Google Sign-In into your web app Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/sign-in/web/sign-in

Retrieved: 2026-09-19T16:30:28.643209+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Support for the Google Sign-In library is deprecated and will require an impact assessment for future compatibility with FedCM APIs.
* Google Sign-In manages the OAuth 2.0 flow and token lifecycle, simplifying integration with Google APIs while allowing users to revoke access.
* Implementing Google Sign-In involves creating authorization credentials, loading the Google Platform Library, specifying your app's client ID, and adding a Google Sign-In button.
* After signing in, you can access basic user profile information, but it is crucial to use ID tokens for secure backend communication.
* You can enable users to sign out of your app without signing out of Google by using the `GoogleAuth.signOut()` method.

**Warning:** The Google Sign-In library optionally uses FedCM APIs,
and their use will become a requirement.
[Conduct an impact assessment](https://developers.google.com/identity/sign-in/web/gsi-with-fedcm)
to confirm that user sign-in continues to function as expected.
  
  
Support for the Google Sign-In library is deprecated, see the
[Deprecation and Sunset](https://developers.google.com/identity/sign-in/web/deprecation-and-sunset) guide for more.

Google Sign-In manages the OAuth 2.0 flow and token lifecycle,
simplifying your integration with Google APIs. A user always has the option to
[revoke access](https://myaccount.google.com/permissions) to an
application at any time.

This document describes how to complete a basic Google Sign-In integration.

## Create authorization credentials

Any application that uses OAuth 2.0 to access Google APIs must have authorization credentials
that identify the application to Google's OAuth 2.0 server. The following steps explain how to
create credentials for your project. Your applications can then use the credentials to access APIs
that you have enabled for that project.

1. Go to the [Clients page](https://console.developers.google.com/auth/clients).
2. Click **Create Client**.
3. Select the **Web application** application type.
4. Name your OAuth 2.0 client and click **Create**

After configuration is complete, take note of the client ID that was created.
You will need the client ID to complete the next steps. (A client secret is also
created, but you need it only for server-side operations.)

## Load the Google Platform Library

You must include the Google Platform Library on your web pages that integrate
Google Sign-In.

```
<script src="https://apis.google.com/js/platform.js" async defer></script>
```

## Specify your app's client ID

Specify the client ID you created for your app in the Google Developers Console
with the `google-signin-client_id` meta element.

```
<meta name="google-signin-client_id" content="YOUR_CLIENT_ID.apps.googleusercontent.com">
```

**Note:** You can also specify your app's client ID with the `client_id` parameter
of the
[`gapi.auth2.init()`](https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams)
method.

## Add a Google Sign-In button

The easiest way to add a Google Sign-In button to your site is to use an
automatically rendered sign-in button. With only a few lines of code, you can
add a button that automatically configures itself to have the appropriate text,
logo, and colors for the sign-in state of the user and the scopes you request.

To create a Google Sign-In button that uses the default settings, add a `div`
element with the class `g-signin2` to your sign-in page:

```
<div class="g-signin2" data-onsuccess="onSignIn"></div>
```

## Get profile information

After you have signed in a user with Google using the default scopes, you can
access the user's Google ID, name, profile URL, and email address.

To retrieve profile information for a user, use the
[`getBasicProfile()`](https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile)
method.

```
function onSignIn(googleUser) {
  var profile = googleUser.getBasicProfile();
  console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
  console.log('Name: ' + profile.getName());
  console.log('Image URL: ' + profile.getImageUrl());
  console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
}
```

**Important:** Do not use the Google IDs returned by `getId()` or the user's
profile information to communicate the currently signed in user to your backend server.
Instead, [send ID tokens](https://developers.google.com/identity/sign-in/web/backend-auth), which can be securely validated
on the server.

## Sign out a user

You can enable users to sign out of your app without signing out of Google by
adding a sign-out button or link to your site. To create a sign-out link, attach
a function that calls the
[`GoogleAuth.signOut()`](https://developers.google.com/identity/sign-in/web/reference#googleauthsignout)
method to the link's `onclick` event.

```
<a href="#" onclick="signOut();">Sign out</a>
<script>
  function signOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      console.log('User signed out.');
    });
  }
</script>
```
