# Restricted scope verification Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

Retrieved: 2026-09-19T16:29:11.121059+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Apps requesting sensitive or restricted Google API scopes to access consumer data require additional verification and potentially a security assessment.
* Restricted scopes provide wide access to Google user data and require a scope verification process unless the app qualifies for an exception.
* Understanding and reviewing the scopes your app uses, ensuring minimal necessary access, and accurately declaring scopes in the Cloud Console are crucial steps for verification.
* Apps accessing restricted data from or through a third-party server must undergo an annual security assessment by a Google-approved third party.
* Exceptions to verification requirements include personal use, development/testing/staging environments, service-owned data only, internal use within an organization, and domain-wide installation.

Certain Google APIs (the ones that accept
[Sensitive](https://support.google.com/cloud/answer/9110914#sensitive-scopes) or
[Restricted](https://support.google.com/cloud/answer/9110914#restricted-scopes)
scopes) have requirements for apps seeking permission to access consumer data.
These [additional requirements for restricted
scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes)
require an app to demonstrate that they are a permitted application type and to
submit to additional reviews, which include a possible security assessment.

The applicability of restricted scopes within an API depends mostly on the
degree of access required to provide a relevant feature in your app: read-only,
write-only, read and write, etc.

When you use OAuth 2.0 to get permission from a Google Account to access this
data, you use strings called *scopes* to specify the type of data you want to
access and how much access you need. If your app requests
[sensitive](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
or
[restricted](https://support.google.com/cloud/answer/9110914#restricted-scopes)
scopes, you need to complete the verification process unless your app's use
qualifies for [an exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#exceptions).

Restricted scopes are fewer in number compared to sensitive scopes. The
[Verification OAuth API Verification
FAQ](https://support.google.com/cloud/answer/9110914) contains the current list
of Sensitive and Restricted scopes. These scopes provide wide access to Google
user data and require you to go through a scope verification process before you
request the scopes from any Google Account. For information on this requirement,
see [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
and [Additional requirements for specific API
scopes](https://developers.google.com/terms/api-services-user-data-policy#additional-requirements-for-specific-api-scopes)
or [the product specific Google Developer page.](https://developers.google.com/)
If you store or transmit restricted scope data on servers, then you need to
complete a [security assessment](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#security-assessment).

---

## Understand restricted scopes

If your app requests any restricted scopes and doesn't qualify for [an
exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#exceptions), you need to satisfy the [Additional requirements for
specific API
scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes)
of the Google API Services User Data Policy, or product specific requirements on
the product's [Google Developer page](https://developers.google.com/), which
requires a more extensive review process.

### Understand your scope use

* Review the scopes your app uses or you want to use. To find your existing
  scope usage, examine your app's source code for any scopes sent with
  authorization requests.
* Determine that each requested scope is necessary for your app feature's
  intended actions and uses the least privilege necessary to provide the
  feature. A Google API typically has reference documentation on the product's
  [Google Developer page](https://developers.google.com/) for its endpoints
  that includes the scope required to call the endpoint or specific properties
  within. For more information about the necessary scopes of access for the
  API endpoints that your app calls, read the reference documentation of those
  endpoints. For example, for an app that only uses Gmail APIs to occasionally
  send emails on a user's behalf, don't request the scope that provides full
  access to the user's email data.
* Data that you receive from a Google API must only be used in compliance with
  the policies of the API and in the way that you represent to your users in
  your app's actions and in your privacy policy.
* Reference the API documentation to learn more about each scope, including
  its potential
  [sensitive](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
  or restricted status.
* Declare all scopes used by your app in the Cloud Console's
  [Data Access page](https://console.developers.google.com/auth/scopes). Scopes you specify are grouped into
  sensitive or restricted categories to highlight any additional verification
  that's required.
* Find the best scope that matches the data used by your integration,
  understand its use, reconfirm that everything still works in a testing
  environment, and then prepare to submit for verification.

Be sure to account for the time needed to complete verification into your launch
plan for your app or any new features that require a new scope. One of these
additional requirements occurs if the app accesses or has the capability to
access Google user data from or through a server. In these cases, the system
must undergo an annual [security assessment](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#security-assessment) from an
independent, third-party assessor that is approved by Google. For this reason,
the restricted scopes verification process can potentially take several weeks to
complete. Note that all apps must complete the [brand
verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
step first, which typically takes 2-3 business days, if branding information has
changed since the last approved OAuth consent screen verification.

---

## Permitted application types

Certain application types can access restricted scopes for each product. You can
find the application types on the product-specific [Google Developer
Page](https://developers.google.com/) (for example, the Gmail API Policy).

It is your responsibility to understand and determine your application type.
However, if you are truly unsure of your app's application type, you can select
no options for the **What features will you use?** question when you submit the
app for verification. The Google API's verification team will then determine the
application type.

---

## Security assessment

Every app that requests access to Google users' restricted data and has the
ability to access data from or through a third-party server must go through a
security assessment from Google-empanelled security assessors. This assessment
helps keep Google users' data safe by verifying that all apps that access Google
user data demonstrate the capability to handle data securely and to delete user
data upon a user's request.

To standardize our security assessment we use the [App Defense
Alliance](https://appdefensealliance.dev/) and the [cloud application security
assessment framework (CASA).](https://appdefensealliance.dev/casa)

As mentioned previously, to keep access to any verified restricted scopes, apps
must be reverified for compliance and complete a security assessment at least
every 12 months after your assessor's Letter of Assessment (LOA) approval date.
If your app adds a new restricted scope, your app might need to be reassessed to
cover the additional scope if it wasn't included in a prior security assessment.

The Google review team emails you when it is time to recertify your app. To make
sure that the correct members of your team are notified of this annual
enforcement, associate additional Google Accounts with your Cloud Console project as an Owner or an Editor. It also helps to
keep up-to-date the user support and developer contact emails that are specified
in the Google Cloud Console OAuth Branding page.

---

## Steps to prepare for verification

All apps that use Google APIs to request access to data must perform the
following steps to complete brand verification:

1. Confirm that your app doesn't fall under any of the use cases in the
   [Exceptions to verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#exceptions) section.
2. Ensure that your app complies with the branding requirements of the
   associated APIs or product. For example, see the [branding guidelines](https://developers.google.com/identity/branding-guidelines) for Google Sign-In scopes.
3. Verify ownership of your project's [authorized domains](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#authorized-domains)
   within the [Google Search Console](https://search.google.com/search-console/about). Use a Google
   Account that's associated with your API Console project as an
   Owner or an Editor.
4. Make sure all branding information on the OAuth consent screen, such as the
   app name, support email, home page URI, privacy policy URI, etc., accurately
   represents the app's identity.

### Application home page requirements

Make sure that your home page meets the following requirements:

* Your home page must be publicly accessible, and not just accessible to your
  site's logged-in users.
* The relevance of your home page to the app that's under review must be
  clear.
* Links to your app's listing on the Google Play Store or its Facebook page
  aren't considered valid application home pages.

### Application privacy policy link requirements

Make sure your app's privacy policy meets the following requirements:

* The privacy policy must be visible to users, hosted within the same domain
  as your application's home page, and linked to on the OAuth consent screen
  of the Google API Console. Note that the home page must include a
  description of the app's functionality, as well as links to the privacy
  policy and optional terms of service.
* The privacy policy must disclose the manner in which your application
  accesses, uses, stores, or shares Google user data.
  The privacy policy must comply with the [Google API Services User Data
  Policy](https://developers.google.com/terms/api-services-user-data-policy) and the [Limited Use
  requirements](https://developers.google.com/terms/api-services-user-data-policy#limited-use) for restricted
  scopes.
  You must limit your use of Google user
  data to the practices that your published privacy policy discloses.
* \* Review [example
  cases](https://support.google.com/cloud/answer/9110914#inconsistent) of
  privacy policies that don't meet the Limited Use requirements.

## How to submit your app for brand verification

A [Google Cloud Console project](https://cloud.google.com/storage/docs/projects) organizes all of your Cloud Console resources. A project consists of a set of associated Google Accounts that have permission to perform project operations, a set of enabled APIs, and billing, authentication, and monitoring settings for those APIs. For example, a project can contain one or more OAuth clients, configure APIs for use by those clients, and configure an [OAuth consent screen](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#oauth-consent-screen) that's shown to users before they authorize access to your app.

If any of your OAuth clients aren't ready for production, we suggest that you delete them from the project that's requesting verification. You can do this in the [Clients page](https://console.developers.google.com/auth/clients).

To submit for verification, follow these steps:

1. Ensure your app complies with the [Google APIs Terms of Service](https://developers.google.com/terms), and the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).
2. Keep the owner and editor roles of your project's associated accounts current, as well as your OAuth consent screen's user support email and developer contact information, in your Cloud Console. This ensures that the correct members of your team are notified of any new requirements.
3. Go to the Cloud Console OAuth [Branding page](https://console.developers.google.com/auth/branding).
4. Click the **Project selector** button.
5. On the **Select from** dialog that appears, select your project. If you can't find your project but you know your project ID, you can construct a URL in your browser in the following format:

   ```
   https://console.developers.google.com/auth/branding?project=[PROJECT_ID]
   ```

   Replace [PROJECT\_ID] with the project ID you want to use.
6. In the **Branding** page, provide your app's branding information, including app name, logo, developer contact information, and relevant links. Any changes you make are saved as **Draft Branding**.
7. Click the **Verify Branding** button to start the evaluation process. The automated review usually completes in a few minutes.
   **Note:** Branding modifications are not permitted while verification is in progress. To make branding changes, you must first cancel any ongoing verification by clicking the **Cancel** button.
8. Once the evaluation is complete, review the status. If successful, the status changes to **Ready to publish**. If the automated verification fails, you can see the issues detected and either fix them or request a manual review.
9. Click the **Publish branding** button to make the new branding live.
   **Note:** Compliant verification results are valid for 7 days. If you don't publish within that timeframe, the status will change to **Need to re-verify** and you will have to run the brand verification again.
10. If your app also requires verification for sensitive or restricted scopes, navigate to the OAuth [Verification Center](https://console.developers.google.com/auth/verification) to track your **Data access status** and provide any additional information requested, such as a demonstration video. Note that you must have a published branding status before you can request verification for data access.
11. Use the **Add or remove scopes** button to declare all scopes requested by your app. An initial set of scopes that are necessary for Google Sign-In are pre-filled in the **Non-sensitive scopes** section. Added scopes are classified as non-sensitive,
    [sensitive](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
    or restricted
    .
12. Provide up to three links to any relevant documentation for related features in your app.
13. Provide any additional information that's requested about your app in the subsequent steps.
    1. Ensure your app complies with the [Additional requirements for specific API
    scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes),
    which includes undergoing an annual security assessment if your app accesses
    restricted scope Google users' data from or through a third-party server.
    2. Ensure your app is one of the allowed types specified in the **Limited Use**
    section of the [Additional requirements for specific API
    scopes](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes)
    page.
    3. If your app is a task automation platform, your demonstration video must
    showcase how multiple API workflows are created and automated, and in which
    directions user data flows.
    4. Prepare a video that fully demonstrates how a user initiates and grants
    access to the requested scopes and shows, in detail, the usage of the granted
    sensitive and restricted scopes in the app. Upload the video to YouTube
    Studio and set **Visibility** as **Unlisted**. You need to provide a link to
    the demonstration video in the YouTube link field.
    1. Show the OAuth grant process that users will experience, in English. This
    includes the consent flow and, if you use Google Sign-In, the sign-in
    flow.
    2. Show that the OAuth consent screen correctly displays the App Name.
    3. Show that the browser address bar of the OAuth consent screen correctly
    includes your app's OAuth client ID.
    4. To show how the data will be used, demonstrate the functionality that's
    enabled by each sensitive and restricted scope that you request.
    5. If you use multiple clients, and therefore have multiple OAuth client IDs,
    show how the data is accessed on each OAuth client.
    5. Select your permitted application type from the "What features will you use?"
    list.
    6. Describe how you will use the restricted scopes in your app and why more
    limited scopes aren't sufficient.

After you publish your branding or submit a data access request, Google's Trust & Safety team may follow up by email with any additional information they need or steps you must complete. Check your email addresses in the **Developer contact information** section and the support email of your OAuth consent screen for requests for additional information. You can also view your project's Branding or Verification Center pages to confirm your project's current review status, including whether the review process is paused while we wait for your response.

## Exceptions to verification requirements

If your app is going to be used in any of the scenarios described in the following sections, you don't need to submit it for review.

### Personal use

One use case is if you are the only user of your app or if your app is used by only a few users, all of whom are known personally to you. You and your limited number of users might be comfortable with advancing through the [unverified app screen](https://support.google.com/cloud/answer/7454865#unverified-app-screen) and granting your personal accounts access to your app.

**Note:** A [user cap](https://support.google.com/cloud/answer/7454865#unverified-app-user-cap) restricts the number of Google Accounts able to grant access to your unverified app.

### Projects used in Development, Testing, or Staging tiers

In order to [comply](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#separate-projects-testing-production) with Google OAuth 2.0 Policies, we recommend that you have different projects for testing and production environments. We recommend that you only submit your app for verification if you want to make your app available to any user with a Google Account. Therefore, if your app is in the development, testing, or staging phases, verification isn't required.

If your app is in the development or testing phases, you can leave the [Publishing Status](https://support.google.com/cloud/answer/10311615#publishing-status) in the default setting of [**Testing**](https://support.google.com/cloud/answer/10311615#publishing-status-testing). This setting means that your app is still in development and is only available to users you add to the list of test users. You must manage the list of Google Accounts that are involved in the development or testing of your app.

**Note:** Your app is still subject to a tester warning screen, as shown in figure 1, a user cap is in effect, and the refresh token lifetime is limited.![Warning message that Google hasn't verified an app that's undergoing testing.](/static/identity/protocols/oauth2/images/examples/tester-warning-screen.png)

**Figure 1.** Tester warning screen

### Service-owned data only

If your app uses a service account to access only its own data, and it doesn't access any user data (linked to a Google Account), then you don't need to submit for verification.

To understand what service accounts are, see [Service accounts](https://cloud.google.com/compute/docs/access/service-accounts) in Google Cloud's documentation. For instructions on how to use a service account, see [Using OAuth 2.0 for server to server applications](https://developers.google.com/identity/protocols/oauth2/service-account).

### Internal use only

This means the app is used only by people in your Google Workspace or Cloud Identity [organization](https://cloud.google.com/resource-manager/docs/creating-managing-organization). The project must be owned by the organization, and its OAuth consent screen needs to be configured for an [**Internal** user type](https://support.google.com/cloud/answer/10311615#user-type-internal). In this case, your app might need approval from an organization administrator. For more information, see [Additional considerations for Google Workspace](https://developers.google.com/identity/protocols/oauth2/production-readiness/google-workspace).

* Learn more about [public and internal applications](https://support.google.com/cloud/answer/6158849#public-and-internal).
* Learn how to mark your app as internal in the FAQ [How can I mark my app as internal-only?](https://support.google.com/cloud/answer/9110914#mark-internal)

### Domain-wide installation

If you plan for your app to only target users of a Google Workspace or Cloud Identity organization and always use [domain-wide installation](https://support.google.com/a/answer/162106), then your app won't require brand verification. However, if your app utilizes [restricted or sensitive scopes](https://developers.google.com/identity/protocols/oauth2/policies#submit-for-verification), [app verification](https://support.google.com/cloud/answer/13461325) is required. This is because a domain-wide installation lets a domain administrator grant third-party and internal applications access to your users' data. Organization administrators are the only accounts that can add the app to an allowlist for use within their domains.

Learn how to make your app a Domain-Wide Install in the FAQ [My application has users with enterprise accounts from another Google Workspace Domain](https://support.google.com/cloud/answer/9110914#enterprise).
