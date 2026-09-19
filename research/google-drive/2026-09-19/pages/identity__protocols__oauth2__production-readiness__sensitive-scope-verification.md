# Sensitive scope verification Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification

Retrieved: 2026-09-19T16:29:09.836729+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Your app might need to complete a verification process if it requests sensitive or restricted Google user data scopes using Google APIs and OAuth 2.0, unless an exception applies.
* Sensitive scopes require review by Google before a Google Account can grant access and might be restricted by Google Workspace organization administrators.
* You must request the narrowest scope necessary for your app's functionality and ensure data usage complies with API policies and your privacy policy.
* Preparation for verification includes checking exceptions, complying with branding, verifying domain ownership, and ensuring accurate OAuth consent screen information and policy links.
* Submitting your app for verification involves confirming policy compliance, keeping contact information current, using the Cloud Console Verification Center, declaring all scopes, and providing detailed justification and a video demonstration for sensitive scopes.

If your app asks for permission to use Google APIs to access Google users' data,
you might have to complete a verification process before you make your app
publicly available for the first time.

Whether this requirement applies to your app depends mostly on two factors:

1. The type of user data you access—public profile information, calendar
   entries, files in Drive, certain health and fitness data, etc.
2. The degree of access you need—read-only, read and write, etc.

When you use OAuth 2.0 to get permission from a Google Account to access their
data, you use strings called *scopes* to specify the type of data you want to
access on their behalf. If your app requests scopes categorized as *sensitive*
or
[restricted](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification),
you probably need to complete the verification process unless your app's use
qualifies for [an exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification#exceptions).

Examples of sensitive scopes include reading events stored in Google Calendar,
storing a new contact in Google Contacts, or deleting a YouTube video. For more
information about available scopes and their classifications, refer to the
reference documentation of the API endpoints called by your app and any related
authorization guide published for the API.

You must [request scopes that require the least amount of
access](https://developers.google.com/identity/protocols/oauth2/policies#scope-requests) to user data
necessary to provide that functionality. For example, an app that only reads
data must not request access to read, write, and delete content when a more
narrow scope is available for the API and its related endpoints. Data that you
receive from a Google API must only be used in compliance with the policies of
the API and in the way that you represent to your users in your app's actions
and in your privacy policy.

Be sure to account for the time needed to complete verification into your launch
plan for your app or any new features that require a new scope. The sensitive
scope verification process typically takes 3-5 business days to complete. Note
that your app might be eligible to complete [brand
verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
as a subset of your sensitive scope verification request.

---

## Understand sensitive scopes

Sensitive scopes require review by Google before any Google Account can grant
access. Google Workspace organization administrators might [restrict
access](https://developers.google.com/identity/protocols/oauth2/production-readiness/google-workspace) to
sensitive scopes to prevent access by OAuth client IDs that the organization
doesn't explicitly mark as trusted.

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
  endpoints.
* Data that you receive from a Google API must only be used in compliance with
  the policies of the API and in the way that you represent to your users in
  your app's actions and in your privacy policy.
* Reference the API documentation to learn more about each scope, including
  its potential sensitive or
  [restricted](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
  status.
* Declare all scopes used by your app in the Cloud Console's
  [Data Access page](https://console.developers.google.com/auth/scopes). Scopes you specify are grouped into
  sensitive or restricted categories to highlight any additional verification
  that's required.
* Find the best scope that matches the data used by your integration,
  understand its use, reconfirm that everything still works in a testing
  environment, and then prepare to submit for verification.

![A table displays the name of an API, one of its sensitive scopes, and a
         description of what the scope covers.](/static/identity/protocols/oauth2/images/examples/sensitive-scope-example.png)

**Figure 2.** An example of a
sensitive scope shown in the OAuth consent screen configuration scopes page.

---

## Steps to prepare for verification

All apps that use Google APIs to request access to data must perform the
following steps to complete brand verification:

1. Confirm that your app doesn't fall under any of the use cases in the
   [Exceptions to verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification#exceptions) section.
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
  accesses, uses, stores, or shares Google user data. You must limit your use of Google user
  data to the practices that your published privacy policy discloses.

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
    sensitive, or
    [restricted](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
    .
12. Provide up to three links to any relevant documentation for related features in your app.
13. Provide any additional information that's requested about your app in the subsequent steps.
    1. Prepare a detailed justification for each requested sensitive scope, as well
    as an explanation for why a narrower scope isn't sufficient. For example: "My
    app will use `https://www.googleapis.com/auth/calendar` to show a
    user's Google calendar data on the scheduling screen of my app. This lets
    users manage their schedules through my app and sync the changes with their
    Google calendar."
    2. Prepare a video that fully demonstrates how a user initiates and grants
    access to the requested scopes and shows, in detail, the usage of the granted
    sensitive and restricted scopes in the app. Upload the video to YouTube
    Studio and set its **Visibility** as **Unlisted**. You need to provide a link
    to the demonstration video in the YouTube link field.
    1. Show the OAuth grant process that users will experience, in English. This
    includes the consent flow and, if you use Google Sign-In, the sign-in
    flow.
    2. Show that the OAuth consent screen correctly displays the App Name.
    3. Show that the browser address bar of the OAuth consent screen correctly
    includes your app's OAuth client ID.
    4. To show how the data will be used, demonstrate the functionality that's
    enabled by each sensitive scope that you request.

After you publish your branding or submit a data access request, Google's Trust & Safety team may follow up by email with any additional information they need or steps you must complete. Check your email addresses in the **Developer contact information** section and the support email of your OAuth consent screen for requests for additional information. You can also view your project's Branding or Verification Center pages to confirm your project's current review status, including whether the review process is paused while we wait for your response.

## Exceptions to verification requirements

If your app is going to be used in any of the scenarios described in the following sections, you don't need to submit it for review.

### Personal use

One use case is if you are the only user of your app or if your app is used by only a few users, all of whom are known personally to you. You and your limited number of users might be comfortable with advancing through the [unverified app screen](https://support.google.com/cloud/answer/7454865#unverified-app-screen) and granting your personal accounts access to your app.

**Note:** A [user cap](https://support.google.com/cloud/answer/7454865#unverified-app-user-cap) restricts the number of Google Accounts able to grant access to your unverified app.

### Projects used in Development, Testing, or Staging tiers

In order to [comply](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#separate-projects-testing-production) with Google OAuth 2.0 Policies, we recommend that you have different projects for testing and production environments. We recommend that you only submit your app for verification if you want to make your app available to any user with a Google Account. Therefore, if your app is in the development, testing, or staging phases, verification isn't required.

If your app is in the development or testing phases, you can leave the [Publishing Status](https://support.google.com/cloud/answer/10311615#publishing-status) in the default setting of [**Testing**](https://support.google.com/cloud/answer/10311615#publishing-status-testing). This setting means that your app is still in development and is only available to users you add to the list of test users. You must manage the list of Google Accounts that are involved in the development or testing of your app.

**Note:** Your app is still subject to a tester warning screen, as shown in figure 2, a user cap is in effect, and the refresh token lifetime is limited.![Warning message that Google hasn't verified an app that's undergoing testing.](/static/identity/protocols/oauth2/images/examples/tester-warning-screen.png)

**Figure 2.** Tester warning screen

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
