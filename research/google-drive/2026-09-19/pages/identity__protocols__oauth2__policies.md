# OAuth 2.0 Policies Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/policies

Retrieved: 2026-09-19T16:29:06.970701+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Last modified: August 5, 2026

The applications and services you design and build with Google APIs must do more than provide
value to users and businesses. We also require that they be secure and provide the appropriate
level of privacy demanded by users. The following policies are part of the
[Google APIs Terms of Service](https://developers.google.com/terms). They apply to all developers who use
OAuth 2.0, which includes
[OpenID Connect](https://developers.google.com/identity/protocols/oauth2/openid-connect) for authentication
only. The policies below are a minimum set of requirements; we recommend that you take any
additional steps necessary to ensure that your applications and systems are safe and secure.

## Comply with all terms of service and policies

The use of Google API Services, which includes our implementation of OAuth 2.0, is governed by
the [Google APIs Terms of Service](https://developers.google.com/terms) and
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).
In addition, the use of OAuth 2.0 is governed by this policy. Please read these documents
carefully, as well as any other terms or policies that apply to any other Google products or
services you are using. Be sure to check for updates periodically as these documents are
occasionally updated.

## Register an appropriate OAuth client

Every app that uses Google's OAuth 2.0 infrastructure for authentication or authorization must
have at least one registered OAuth client. You must create a separate OAuth client for each
platform on which your app will run, such as a web server, an Android app, an iOS app, or a
limited-input device. You must choose the client type that best matches the platform. For
instance, you should not use a "web" client type for your native Android or iOS app. You can
[register OAuth clients](https://support.google.com/cloud/answer/6158849 "Google Cloud Console Help: Setting up OAuth 2.0")
in the [Google Cloud Console](https://console.developers.google.com/). Note that additional
[terms](https://cloud.google.com/terms/ "Google Cloud Platform Terms of Service")
apply to your use of the Google Cloud Platform.

If you use [Apps Script](https://developers.google.com/apps-script), OAuth clients are automatically created on
your behalf, and you are still subject to the policies on this page. If you need to modify or
manage your OAuth clients, you must
[switch your script project to a standard Cloud project](https://developers.google.com/apps-script/guides/cloud-platform-projects#switching_to_a_different_standard_gcp_project).

Some Google development platforms, such as Firebase and Actions on Google, automatically create
Google Cloud projects and OAuth clients on your behalf. If you develop on these platforms, you
are still subject to the policies on this page.

Google reserves the right to
[delete unused
OAuth clients](https://support.google.com/cloud/answer/15549257#unused-client-deletion) if the client is inactive for at least 6 months. Unused clients are clients
that have not been used in token exchanges or had their configuration edited for at least 6
months. Deleted clients can be restored in the Google Cloud Console for 30 days following
deletion.

## Use separate projects for testing and production

For the purposes of these requirements, a "production" app meets the following criteria:

* It isn't for personal use. An app is considered to be for personal use if it's not shared
  with anyone else or will be used by fewer than 100 people
  (all of whom are known personally to you).
* It isn't used for development, testing, or staging.
* It isn't for internal use; that is, restricted to people in your Google Workspace or
  Cloud Identity organization.

Some policies and requirements only apply to production apps. For this reason, you must create
separate projects in the [Google Cloud Console](https://console.developers.google.com/) for each deployment tier,
such as development, staging, and production.

## Maintain a list of relevant contacts for the project

Project owners and editors must be kept up-to-date. We'll send emails to those accounts when
there are notifications about your project or updates to our services. Organization
administrators must ensure that a reachable contact is associated with every project in
their organization. If we don't have updated contact information for your project, you might
miss out on important messages that require your action. This could result in the loss of your
access to the Google APIs.

## Google Workspace users: Associate your project with an organization

At this time, your projects aren't required to exist within a Google Workspace or
Cloud Identity
[Organization resource](https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy#organizations).
However, you're strongly recommended to
[create new projects in an organization](https://cloud.google.com/resource-manager/docs/creating-managing-projects "Google Cloud: Creating and Managing Projects")
and
[migrate existing projects into an organization](https://cloud.google.com/resource-manager/docs/migrating-projects-billing "Google Cloud: Migrating Projects into an Organization").
This configuration allows your project to benefit from enterprise management including
intra-domain usage. It can also prevent your project from becoming orphaned if the current
project owner leaves your organization.

## Handle client credentials securely

Treat your OAuth client credentials with extreme care, as they allow anyone who has them to use
your app's identity to gain access to user information. Store your OAuth client information in a
secure place and protect it, especially your client secret, just as you would a password.
Where possible, use a secret manager, such as
[Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs/overview "Google Cloud: Secret Manager conceptual overview"),
to store client credentials. You must never commit client credentials into publicly available
code repositories. We highly recommend that you avoid committing them to any code
repository.

## Handle user tokens securely

OAuth 2.0 tokens are entrusted to you by users who give you permission to act and access data
on their behalf. Never transmit tokens in plaintext, and always store encrypted tokens at rest
to provide an extra layer of protection in the event of a data breach.
[Revoke tokens](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke) when you no
longer need access to a user's account or when your app no longer needs access to permissions
that a user previously granted. After the tokens are revoked, delete them permanently from your
application or system.

## Accurately represent your identity

Provide a valid name and (optionally) a logo to show to users.
This brand information must accurately represent the identity of the application.
App branding information is configured when you set up OAuth 2.0 in the
Google Cloud Console
[Consent Screen page](https://console.developers.google.com/apis/credentials/consent).

For production apps, brand information
[must be verified](https://support.google.com/cloud/answer/9110914 "Google Cloud Platform Console Help: OAuth verification requirements").
Google can revoke or suspend access to Google API Services and other Google products and
services for apps that misrepresent their identity or attempt to deceive users.

If you use Apps Script and want to verify your brand information, you must
[switch your script project to a standard Cloud project](https://developers.google.com/apps-script/guides/cloud-platform-projects#switching_to_a_different_standard_gcp_project "Apps Script: Switching to a different standard GCP project").
If you use a Google development platform that manages OAuth clients on your behalf,
such as Firebase or Actions on Google, your app settings there are used to configure your brand
information. However, you must still use the [Google Cloud Console](https://console.developers.google.com/) to submit your brand information for review.

## Only request scopes that you need

You must only request the smallest set of scopes that are necessary for providing functionality
knowingly chosen by the user. You must request scopes that require the least amount of access to
user data necessary to provide that functionality. For example, an app that only uses Gmail APIs
to occasionally send emails on a user's behalf shouldn't request the scope that provides full
access to the user's email data. Data that you receive from Google APIs must only be used in the
way that you represent to your users.

Your project configuration in the Google Cloud Console
[Consent Screen page](https://console.developers.google.com/apis/credentials/consent) must match the list of scopes requested
by your app. When a change in app functionality or in Google APIs necessitates an update to the
scopes that are used, you must
[revoke](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke) the tokens with the
previously-used scopes that are no longer in use at the earliest opportunity and update your
project configuration in the Google Cloud Console. Proper configuration is
particularly important for
[scopes that require verification](https://support.google.com/cloud/answer/9110914#sensitive-restricted-scopes);
if an app is no longer approved to use them, Google may revoke tokens that contain these scopes
at any time without notice.

If you use Apps Script, the OAuth client that's automatically created for you is configured to
use the scopes that Apps Script identifies from your script.
If your script requires different scopes, you must
[specify these scopes
explicitly in your script's manifest file](https://developers.google.com/apps-script/concepts/scopes#setting_explicit_scopes "Apps Script: Setting explicit scopes").

## Submit production apps that use sensitive or restricted scopes for verification

Certain scopes are classified as "sensitive" or "restricted," and they can't be used in
production apps without review. If your production app uses sensitive or restricted scopes, you
must
[submit your use of those scopes for verification](https://support.google.com/cloud/answer/9110914 "Google Cloud Platform Console Help: OAuth verification requirements").
You can submit for verification in the Google Cloud Console from the
[Consent Screen page](https://console.developers.google.com/apis/credentials/consent).

If you use Apps Script and you're writing a production script that uses sensitive or
restricted scopes, you must
[switch your script project to a standard Google Cloud Platform project](https://developers.google.com/apps-script/guides/cloud-platform-projects#switching_to_a_different_standard_gcp_project "Apps Script: Switching to a different standard GCP project")
before you submit your use of those scopes for verification.

## Only use domains you own

Only use redirect URIs and JavaScript origins that refer to domains that you own, that you have
been authorized to use (for example, as part of your employment or
as a vendor or contractor of a business), or that you have been explicitly given license to use
(for example, as part of a service agreement for an identity management platform).

## Host a homepage for production apps

Every production app that uses OAuth 2.0 must have a publicly accessible home page.
The homepage must include a description of the app's functionality, as well as links to terms of
service and a privacy policy. The homepage must exist on a verified domain under
your ownership.

## Use secure browsers

A developer must not direct a Google OAuth 2.0 authorization request to an embedded user-agent
under the developer's control. Embedded user-agents include, but are not limited to, software
libraries that allow a developer to insert arbitrary scripts, alter the default routing of a
request to the Google OAuth server, or access session cookies. All browsing environments must
allow the user to verify the current connection to the Google OAuth server including the
requested URI and connection security information.

## Use secure JavaScript origins and redirect URIs

[OAuth 2.0 clients for web apps](https://support.google.com/googleapi/answer/6158849#web-applications)
must use redirect URIs and JavaScript origins that are compliant with
[Google’s validation rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation),
including using the HTTPS scheme. Google may reject OAuth requests that don't
originate from or resolve to a secure context.

## Handle consent for multiple scopes

When you obtain consent for multiple scopes, a user might choose to grant one or more requested
scopes or deny the request. If a user doesn't grant a scope that you requested, you need to
disable any related functionality in your app and not make any related API calls that will fail.
If a user doesn't grant a requested scope, you may only request a new authorization after the
user clearly indicates an intent to use the feature or functionality provided by the scope.
Where possible, you must ask for scopes in context with
[incremental authorization](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth)
and provide a justification to the user before you request authorization.

## Handle refresh token revocation and expiration

Refresh tokens can be invalidated at any time. For example, the user could choose to revoke
access to your app, a manual or automated process designed to protect users could purge the
token, or the token could expire. If your app requires notification of token revocation to
provide a good experience for users, you must integrate with our
[Cross-Account Protection](https://developers.google.com/identity/protocols/risc) service.

## Security signals

Session metadata and Account Metadata signals available in the OpenID Connect ID
token and Security Event Tokens must only be used for the limited purpose
of assisting you in internally investigating, remediating, and developing
systems to protect against security breaches and abusive behavior that may
impact your systems, customers, or users. These signals are strictly
prohibited from any other use.

## Continuous improvements

To continuously enhance your experience, we may add or remove features, modify service limits,
introduce or retire services, and conduct experiments to test new improvements. If we make
material changes that negatively impact your use of our services or if we stop offering a
service, we'll provide you with reasonable advance notice, except in urgent situations such as
preventing abuse, responding to legal requirements, or addressing security and operability
issues.

## Changelog

October 27, 2025 -  Added policy for unused client deletion.

December 15, 2025 -  Added policy for continuous improvements.

August 5, 2026 - 
Added policy for security signals handling.
