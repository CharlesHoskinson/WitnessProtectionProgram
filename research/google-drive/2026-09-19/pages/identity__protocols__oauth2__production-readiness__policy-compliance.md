# Comply with OAuth 2.0 policies Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance

Retrieved: 2026-09-19T16:29:07.847798+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This guide outlines how to come into compliance with the most common developer
issues encountered when you prepare your app for production.

## Overview

When you're ready to deploy your implemented solution beyond your development
environment to your app's users, you might need to take additional steps to
comply with [Google's OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies).
In this guide, we outline how to come into compliance with the most common
developer issues encountered when you prepare your app for production. This
helps you reach the largest possible audience with limited errors.

* [Use separate projects for testing and
  production](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#separate-projects-testing-production)
* [Maintain a list of relevant contacts for the
  project](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#maintain-project-contact-list)
* [Accurately represent your identity](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#accurately-represent-your-identity)
* [Only request scopes that you need](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#only-request-needed-scopes)
* [Submit production apps that use sensitive or restricted scopes for
  verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#sensitive-restricted-scope-verification)
* [Only use domains you own](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#only-use-domains-you-own)
* [Host a home page for production apps](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#host-homepage-production-apps)
* [Use secure redirect URIs and JavaScript
  origins](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#use-secure-redirect-uris-javascript)

---

## Use separate projects for testing and production

Google's OAuth policies [require separate projects for testing and production](https://developers.google.com/identity/protocols/oauth2/policies#separate-projects). Some policies and requirements only apply to production apps. You might need to create and configure a separate [project](https://cloud.google.com/storage/docs/projects) that includes OAuth clients that correspond to the production version of your app available to all Google Accounts.

Google OAuth clients used in production help provide a more stable, predictable, and secure data collection and storage environment than similar OAuth clients that test or debug the same application. Your production project can submit for verification and therefore be subject to [additional requirements for specific API scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes), which might include third-party security assessments.

1. Go to the [Google API Console](https://console.developers.google.com/project). Click **Create project**, enter a name, and click **Create**.
2. Review the OAuth clients in this project that might be associated with your testing tier. If applicable, create similar OAuth clients for the production clients inside your production project.
3. [Enable any APIs](https://console.developers.google.com/apis/enabled) in use by your clients.
4. Review your OAuth Consent Screen configuration for the new project in the Cloud Console's [Branding page](https://console.developers.google.com/auth/branding).

Google OAuth clients used in production must not contain test environments, redirect URIs, or JavaScript origins available to only you or your development team. The following are some examples:

* The test servers of individual developers
* Test or pre-release versions of your app

---

## Maintain a list of relevant contacts for the project

Google, and the individual APIs you enable, might need to contact you about changes to its services or new configurations required of your project and its clients. Review your project's [IAM](https://console.developers.google.com/iam-admin/iam) listings to make sure relevant people on your team have access to edit or view your project configuration. These accounts might also receive emails about required changes to your project.

A [role](https://cloud.google.com/iam/docs/roles-overview#basic) contains a set of permissions that lets you perform specific actions on project resources. Project editors have permissions for actions that modify state, such as the ability to make changes to your project's OAuth consent screen. Project owners who have all editor permissions can add or remove accounts associated with the project, or delete the project. Project owners can also provide context for why billing information might be set. Project owners can set up billing information for a project that uses paid APIs.

Project owners and editors must be kept up-to-date. You can add multiple relevant accounts to your project to help ensure continued access to the project and related maintenance. We send emails to those accounts when there are notifications about your project or updates to our services. Google Cloud organization administrators must ensure that a reachable contact is associated with every project in their organization. If we don't have up-to-date contact information for your project, you might miss out on important messages that require your action.

**Caution:** Failure to act on timely notifications about your project could result in the loss of access to the Google APIs.**Note:** One of the "relevant contacts" for the project is the user support email configured for your OAuth consent screen. If users have issues with your app, or Google Cloud organization administrators have questions on behalf of their users, this email address is displayed so that they can get in contact.

---

## Accurately represent your identity

Provide a valid app name and, optionally, a logo to show to users. This brand information must [accurately represent the identity](https://developers.google.com/terms/api-services-user-data-policy#accurately_represent_your_identity_and_intent) of your application. App branding information is configured from the OAuth [Branding page](https://console.developers.google.com/auth/branding).

For production apps, brand information defined in your OAuth consent screen [must be verified](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) before it displays to users. Users might be more likely to grant access to your app after it completes its brand verification. Basic application information, which includes the app's name, home page, terms of service, and privacy policy, are shown to users on the grant screen, when they review their existing grants, or to Google Workspace administrators that review app use by their organization.

Google can revoke or suspend access to Google API Services and other Google products and services for apps that misrepresent their identity or attempt to deceive users.

---

## Only request scopes that you need

During your application's development, you might have used an example scope provided by the API to create a proof-of-concept within your application to learn more about the API's features and functionality. These example scopes often request more information than the final implementation of your app needs, because they provide comprehensive coverage of all possible actions for a particular API. For example, the example scope might request read, write, and delete permissions while your application requires only read permissions. [Request relevant permissions](https://developers.google.com/terms/api-services-user-data-policy#request_relevant_permissions) that are limited to the critical information necessary to implement your application.

Review the reference documentation for the API endpoints that your app calls and note the scopes that they require to access the relevant data your app needs. Review any authorization guides that the API offers and describe their scopes in more detail to include the most common usage. Choose the most minimal data access that your application needs to power the related features.

For more information about this requirement, read the [Only request scopes that you need](https://developers.google.com/identity/protocols/oauth2/policies#scope-requests) section of the OAuth 2.0 Policies, along with the [Request relevant permissions](https://developers.google.com/terms/api-services-user-data-policy#request_relevant_permissions) section of the Google API Services User Data Policy.

---

## Submit production apps that use sensitive or restricted scopes for verification

Certain scopes are classified as "sensitive" or "restricted" and can't be used in [production apps](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#separate-projects-testing-production) without review. Enter all scopes your production app uses in its [OAuth Consent Screen configuration](https://console.developers.google.com/auth/branding). If your production app uses sensitive or restricted scopes, you must submit your use of those scopes for verification before you include the scopes in an authorization request.

---

## Only use domains you own

Google's OAuth consent screen verification process requires verification of all domains associated with your project's home page, privacy policy, terms of service, authorized redirect URIs, or authorized JavaScript origins. Review the list of domains in use by your app, summarized in the **Authorized domains** section of the OAuth consent screen editor, and identify any domains that you don't own and would therefore be unable to verify. To verify ownership of your project's [authorized domains](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#authorized-domains), use the [Google Search Console](https://search.google.com/search-console/about). Use a Google Account that's associated with your API Console project as an Owner or an Editor.

If your project uses a service provider with a common, shared domain, we recommend that you enable configurations that would allow use of your own domain. Some providers offer to map their services to a subdomain of a domain you already own.

---

## Host a home page for production apps

Every production app that uses OAuth 2.0 must have a publicly accessible home page. Potential users of your app might visit the home page to learn more about the features and functionality that the app offers. Existing users might review their list of existing grants and visit your app's home page as a reminder of their continued use of your offering.

Your application's home page must include a description of the app's functionality, as well as links to a privacy policy and optional terms of service. The home page must exist on a verified domain under your ownership.

---

## Use secure redirect URIs and JavaScript origins

[OAuth 2.0 clients for web apps](https://support.google.com/googleapi/answer/6158849#web-applications) must secure their data using HTTPS redirect URIs and JavaScript origins, not plain HTTP. Google can reject OAuth requests that don't originate from or resolve to a secure context.

Consider which third-party applications and scripts might have access to tokens and other user credentials that return to your page. Limit access to sensitive data with redirect URI locations that are limited to verifying and storing token data.

---

## Next steps

After you ensure that your app complies with the OAuth 2.0 policies on this page, see [Submit for brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) for details about the verification process.
