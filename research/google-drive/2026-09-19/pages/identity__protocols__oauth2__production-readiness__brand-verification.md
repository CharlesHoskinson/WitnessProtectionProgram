# Submit for brand verification Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification

Retrieved: 2026-09-19T16:29:08.714192+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Apps accessing Google APIs must verify their identity and intent according to Google's API Services User Data Policy.
* Your app requires verification if configured for external users and displays a logo or display name on the OAuth consent screen.
* Verified brand information increases user trust and recognition, potentially leading to fewer access revocations.
* The brand verification process typically takes 2-3 business days after submission.
* Certain app use cases, such as personal use or internal use only, are exempt from verification requirements.

All apps that access Google APIs must verify that they accurately represent
their identity and intent as specified by [Google's API Services User Data
Policy](https://developers.google.com/terms/api-services-user-data-policy). To protect you and the shared
users of Google and your app, your consent screen and application might need
verification by Google.

Your app requires verification if it meets all the following criteria:

* In the Google API Console, your app's configuration is set for a user type
  of **External** and a published status of **Published**. This means your
  app is in production and is available to any user with a Google Account.
* You want your app to display a logo or display name on the [OAuth
  consent screen](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#oauth-consent-screen).

If you verify brand information of your app, you can increase the likelihood that
a user recognizes your brand and decides to grant access to your app. Verified
brand information can also lead to fewer revocations later on when a user or
Google Workspace administrator [reviews third-party apps and services with
access to the account](https://support.google.com/accounts/answer/3466521). The
automated brand verification process typically takes a few minutes after you
click the **Verify Branding** button. In some cases, where a result cannot be
automatically determined, your app may undergo a manual review process that
usually takes [2-3 business days](https://support.google.com/cloud/answer/9110914#verification-types).

**Note:** If you change any of the details that appear on your [OAuth consent
screen](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#oauth-consent-screen), such as the app's logo, name, home page, privacy
policy URI, or [authorized domains](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#authorized-domains), the changes are saved
as **Draft Branding**. You need to verify the new branding configuration and
click the **Publish branding** button before the updates take effect on your
**Published Branding** and appear on your [OAuth consent screen](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#oauth-consent-screen).
Branding modifications are not permitted while verification is in progress. To
make branding changes, you must first cancel any ongoing verification by
clicking the **Cancel** button.

If your app's branding information remains unverified, it might result in
decreased user trust of your request for their data, which can lead to fewer
user authorizations and more revocations later.

---

## OAuth consent screen

The consent screen tells users who is requesting access to their data and what
kind of data your app needs to access on their behalf, as highlighted in Box 2
of figure 1.

When your app goes through the brand verification process and receives approval,
your application's identity and user data policies are more likely to be clearly
understood by the account that's granting permission. This clear understanding
can increase the likelihood an account holder authorizes your requests and
maintains access when they review possible revocations on their [Google
Account](https://myaccount.google.com/permissions) page. The content you
configure on the OAuth [Branding page](https://console.developers.google.com/auth/branding) in the Cloud Console populates the following components:

1. Your app name and logo (as shown in Box 1 of figure 1)
2. Your user support email, which appears after your app name is selected (Box
   2 of figure 1)
3. Links to your privacy policy and terms of service (Box 3 of figure 1)

![Mock-up of the OAuth consent screen.](/static/identity/protocols/oauth2/images/examples/oauth-consent-screen-components.png)**Figure 1.** Mock-up of the OAuth consent screen.

---

## Authorized domains

As part of the brand verification process, Google requires verification of all
domains that are associated with an application's OAuth consent screen and
credentials. We ask you to verify the domain component available for
registration on a public suffix: the "[top private domain](https://github.com/google/guava/wiki/InternetDomainNameExplained)." For
example, an OAuth consent screen that's configured with an application home page
of `https://sub.example.com/product` asks the account holder to verify ownership
of the `example.com` domain.

The **Authorized domains** section of the OAuth consent screen editor needs to
contain the top private domains that are used in the URIs of the **App domain**
section. These domains include the app home page, privacy policy, and terms of
service. The **Authorized domains** section also needs to include the redirect
URIs or JavaScript origins authorized in your "Web application" OAuth client
types.

Verify the ownership of your authorized domains using the [Google Search Console](https://search.google.com/search-console/about). A Google Account with
owner [permissions for a domain](https://support.google.com/webmasters/answer/7687615) must be associated
with the API Console project that uses that authorized domain. For
more information about domain verifications in Google Search Console, see
[Verify your site ownership](https://support.google.com/webmasters/answer/9008080).

---

## Steps to prepare for verification

All apps that use Google APIs to request access to data must perform the
following steps to complete brand verification:

1. Confirm that your app doesn't fall under any of the use cases in the
   [Exceptions to verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#exceptions) section.
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
    [sensitive](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
    or
    [restricted](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
12. Provide up to three links to any relevant documentation for related features in your app.
13. Provide any additional information that's requested about your app in the subsequent steps.

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
