# Configure the OAuth consent screen and choose scopes Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/guides/configure-oauth-consent

Retrieved: 2026-09-19T16:28:55.843369+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* When using OAuth 2.0 for authorization with Google Workspace APIs, you need to configure an OAuth consent screen that defines the access your app requests and displays this information to users.
* You should carefully select authorization scopes to provide your app with the minimum necessary access to Google Workspace data, as users are more likely to grant consent to apps with limited and clearly defined scopes.
* All apps require an OAuth consent screen, but explicitly listing scopes is necessary only for apps used outside your organization, and certain scope categories necessitate additional reviews by Google.
* To configure your OAuth consent screen, you'll need to provide app details, select the user type (internal or external), define the necessary scopes, and potentially add test users if applicable.
* Sensitive and restricted scopes require additional verification and security assessments due to their access levels to user data, so consider using non-sensitive alternatives whenever possible.

When you use OAuth 2.0 for authorization, Google displays a consent screen to
the user including a summary of your project, its policies, and the requested
authorization scopes of access. Configuring your app's OAuth consent screen
defines what is displayed to users and app reviewers, and registers your app
so you can publish it later.

**Note:** Some Google Workspace APIs, such as the Drive API, have
documentation covering API-specific authentication and authorization
information. Ensure you read that documentation before continuing with this
page.

To define the level of access granted to your app, you need to identify and
declare *authorization scopes*. An authorization scope is an OAuth 2.0 URI string
that contains the Google Workspace app name, what kind of data it accesses, and
the level of access. Scopes are your app's requests to work with Google Workspace data, including
users' Google Account data.

When your app is installed, a user is asked to validate the scopes used
by the app. Generally, you should choose the most narrowly focused scope
possible and avoid requesting scopes that your app doesn't require. Users more
readily grant access to limited, clearly described scopes.

All apps using OAuth 2.0 require a consent screen configuration, but you only
need to list scopes for apps used by people outside your Google Workspace
organization.

**Tip:** If you don't know required consent screen information, you can use
placeholder information prior to release.

For security reasons, you can't remove the OAuth 2.0 consent screen
after you've configured it.

## Configure OAuth consent

1. In the Google API Console, go to Menu
   > **Google Auth platform**
   > **Branding**.

   [Go to Branding](https://console.developers.google.com/auth/branding)
2. If you have already configured the Google Auth platform, you can configure the following OAuth Consent Screen settings in [Branding](https://console.developers.google.com/auth/branding), [Audience](https://console.developers.google.com/auth/audience), and [Data Access](https://console.developers.google.com/auth/scopes).
   If you see a message that says **Google Auth platform not configured yet**, click **Get Started**:

1. Under **App Information**, in **App name**, enter an **App name**.
2. In **User support email**, choose a support email address where users can contact you if they have questions about their consent.
3. Click **Next**.
4. Under **Audience**, select the user type for your app.
5. Click **Next**.
6. Under **Contact Information**, enter an **Email address** where you can be notified about any changes to your project.
7. Click **Next**.
8. Under **Finish**, review the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) and if you agree, select **I agree to the Google API Services: User Data Policy**.
9. Click **Continue**.
10. Click **Create**.
11. If you selected **External** for user type, add test users:
    1. Click **Audience**.
    2. Under **Test users**, click **Add users**.
    3. Enter your email address and any other authorized test users, then click **Save**.

3. If you're creating an app for use outside of your Google Workspace
   organization, click **Data Access** **>** **Add or Remove Scopes**. We recommend the following best practices when
   selecting scopes:

   * Select the scopes that provide the minimum level of access required by your app. For a list of
     available scopes, see
     [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes).
   * Review the scopes listed in each of the three sections: non-sensitive
     scopes, sensitive scopes, and restricted scopes. For any scopes listed in the
     "Your sensitive scopes" or "Your restricted scopes" sections, try to identify
     alternative non-sensitive scopes to avoid unnecessary additional reviews.
   * Some scopes require additional reviews by Google. For apps used only
     internally by your Google Workspace organization, scopes aren't listed on the
     consent screen and use of restricted or sensitive scopes doesn't require
     further review by Google. For more information, see
     [Scope categories](https://developers.google.com/workspace/guides/configure-oauth-consent#scope_categories).
4. After selecting the scopes required
   by your app, click **Save**.

For more information about configuring OAuth consent, see
[Get started with the Google Auth platform](https://support.google.com/cloud/answer/15544987).

## Scope categories

Some scopes require additional reviews and requirements
because of the level or type of access they grant. Consider the following types
of scopes:

|  |  |  | [Basic app verification](https://support.google.com/cloud/answer/9110914#ver-prep&zippy=%2Csteps-to-prepare-for-verification) required | [Additional app verification](https://support.google.com/cloud/answer/9110914#ver-prep&zippy=%2Csteps-to-submit-your-app) required | [Security assessment](https://support.google.com/cloud/answer/9110914#sec-assess&zippy=%2Csecurity-assessment) required |
| --- | --- | --- | --- | --- | --- |
|  | **Non-sensitive scopes** *(recommended)* | Grant access only to limited data that's immediately relevant to a specific action. |  | — | — |
|  | **Sensitive scopes** | Grant access to personal user data, resources, or actions. |  |  | — |
|  | **Restricted scopes** | Grant access to highly-sensitive or extensive user data or actions. |  |  |  |

## Next step

[Create access credentials](https://developers.google.com/workspace/guides/create-credentials) for your app.
