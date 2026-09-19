# Create access credentials Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/guides/create-credentials

Retrieved: 2026-09-19T16:28:56.984571+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Google Workspace APIs require credentials, which can be API keys, OAuth client IDs, or service accounts, depending on the type of access needed.
* API keys provide anonymous access to public data and are created in the Google Cloud console.
* OAuth client IDs are used for accessing user data with consent and require separate IDs for different platforms.
* Service accounts enable applications to access data or act on behalf of users and require role assignment and secure key management.
* Creating a service account involves assigning roles, generating keys, and optionally configuring domain-wide delegation for accessing user data on behalf of the application.

Credentials are used to obtain an access token from Google's authorization
servers so your app can call Google Workspace APIs. This document describes how to
choose and set up the credentials your app needs.

## Choose the access credential that's right for you

The required credentials depend on the type of data, platform, and access
methodology of your app. There are three types of credentials available:

| Use case | Authentication method | About this authentication method |
| --- | --- | --- |
| Access publicly available data anonymously in your app. | [API keys](https://developers.google.com/workspace/guides/create-credentials#api-key) | Check that the API you want to use supports API keys before using this authentication method. |
| Access user data such as their email address or age. | [OAuth client ID](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id) | Requires your app to request and receive consent from the user. |
| Access data owned by your app, specific shared documents (such as Google Sheets), or access Google Workspace resources on behalf of users through [domain-wide delegation.](https://developers.google.com/workspace/guides/create-credentials#set-up-domain-wide-delegation) | [Service account](https://developers.google.com/workspace/guides/create-credentials#service-account) | When an app authenticates as a service account, it has access to all resources that the service account has permission to access. |

**Note:** To be guided on how to choose a credential, see [Choose the right
authentication method for your use
case](https://docs.cloud.google.com/docs/authentication#auth-decision-tree) in
the Google Cloud console or use the [Help me choose
option](https://console.cloud.google.com/apis/credentials/wizard) in the Google Cloud console.

For definitions of terms found on this page, see the [Authentication and
authorization overview](https://developers.google.com/workspace/guides/auth-overview).

## API key credentials

An API key is a long string containing upper and lower case letters, numbers,
underscores, and hyphens, such as `AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe`.
This authentication method is used to anonymously access publicly available
data, such as Google Workspace files shared using the "Anyone on the
Internet with this link" sharing setting. For more details, see [Manage API
keys](https://docs.cloud.google.com/docs/authentication/api-keys).

To create an API key:

1. In the Google Cloud console, go to Menu
   > **APIs & Services**
   > **Credentials**.

   [Go to Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create credentials** >
   **API key**.
3. Your new API key is displayed.
   * Click Copy to copy your API key for use
     in your app's code. The API key can also be found in the "API Keys" section of your
     project's credentials.
   * To prevent unauthorized use, we recommend restricting where and for which APIs the API key
     can be used. For more details, see
     [Add API restrictions](https://cloud.google.com/docs/authentication/api-keys#adding-api-restrictions).

## OAuth client ID credentials

To authenticate end users and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.

Choose your [application
type](https://support.google.com/cloud/answer/15549257#zippy=%2Cweb-applications%2Cnative-applications-android-ios-desktop-uwp-chrome-extensions-tv-and-limited-input)
for specific instructions about how to create an OAuth client ID:

### Web application

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Web application**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Add authorized URIs related to your app:
   * **Client-side apps (JavaScript)**–Under **Authorized JavaScript origins**, click **Add URI**. Then, enter a URI to use for browser requests. This identifies the domains from which your application can send API requests to the OAuth 2.0 server.
   * **Server-side apps (Java, Python, and more)**–Under **Authorized redirect URIs**, click **Add URI**. Then, enter an endpoint URI to which the OAuth 2.0 server can send responses.
6. Click **Create**.

   The newly created credential appears under **OAuth 2.0 Client IDs**.

   Note that client secrets aren't used for Web applications.

### Android

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Android**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. In the **Package name** field, enter the package name from your `AndroidManifest.xml` file.
6. In the **SHA-1 certificate fingerprint** field, enter your [generated SHA-1 certificate fingerprint](https://support.google.com/cloud/answer/6158849#installedapplications&android&zippy=%2Cnative-applications%2Candroid).
7. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

### iOS

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **iOS**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. In the **Bundle ID** field, enter the bundle identifier as listed in the app's `Info.plist` file.
6. Optional: If your app appears in the Apple App Store, enter the App Store ID.
7. Optional: In the **Team ID** field, enter the unique 10-character string that's generated by Apple and assigned to your team.
8. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

### Chrome Extension

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Chrome Extension**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. In the **Item ID** field, enter your app's unique 32-character ID string. You can find this ID value in your app's Chrome Web Store URL and in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
6. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

### Desktop app

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **Desktop app**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

### TVs and Limited Input devices

1. In the Google Cloud Console, go to Menu
   > **Google Auth platform**
   > **Clients**.

   [Go to Clients](https://console.developers.google.com/auth/clients)
2. Click **Create Client**.
3. Click **Application type** > **TVs and Limited Input devices**.
4. In the **Name** field, type a name for the credential. This name is only shown in the Google Cloud Console.
5. Click **Create**.

   The newly created credential appears under "OAuth 2.0 Client IDs."

## Service account credentials

A service account is a special kind of account used by an application, rather
than a person. You can use a service account to access data or perform actions
by the robot account, or to access data on behalf of Google Workspace
or Cloud Identity users. For more information, see
[Service accounts overview](https://docs.cloud.google.com/iam/docs/service-account-overview).

Note that Identity and Access Management (IAM) roles configured in the
Google Cloud Console **don't** grant access to Google Workspace assets
(such as Sheets or Gmail). To give a service account
access to Google Workspace resources, you can use the following:

| If your app needs to... | Where to configure it... |
| --- | --- |
| Access specific files (such as a Google Sheet) | [Direct document sharing of a file or folder with the service account's email address](https://developers.google.com/workspace/guides/create-credentials#access-workspace-files) |
| Perform domain administration (such as creating Google Workspace users) | [Assign administrative roles directly to the service account](https://developers.google.com/workspace/guides/create-credentials#assign-role-service-account) |
| Access user data across the domain (such as reading any user's Gmail or Google Calendar events) | [Authorize the service account to use domain-wide delegation](https://developers.google.com/workspace/guides/create-credentials#set-up-domain-wide-delegation) |

### Create a service account

You can create a service account using the Google Cloud Console or the
`gcloud` command-line tool.

### Google Cloud Console

1. In the Google Cloud Console, go to Menu
   > **IAM & Admin**
   > **Service Accounts**.

   [Go to Service Accounts](https://console.developers.google.com/iam-admin/serviceaccounts)

   The remaining steps appear in the Google Cloud Console.
2. Select a Google Cloud project.
3. Click **Create service account**.
4. Enter a service account name to display in the Google Cloud Console.
   Note: By default, Google creates a unique service account ID based on the service account name.
   You can modify the ID in the service account ID field. You cannot change the ID later.
5. If you don't want to set access controls now, click **Done** to finish creating the service account. To set access controls now, click **Create and continue** and proceed to the next step.
   **Note:** Granting access control here only affects Google Cloud resources. Google Workspace resources (such as Google Sheets
   and Google Drive) are shared and configured separately.
6. Optional: Assign roles to your service account to grant access to your Google Cloud project's resources in addition to Google Workspace resources. For more details, refer to [Manage access to projects, folders, and organizations](https://docs.cloud.google.com/iam/docs/granting-changing-revoking-access).
7. Click **Continue**.
8. Optional: Enter users or groups that can manage and perform actions with this service account. For more details, refer to [Service account impersonation](https://docs.cloud.google.com/iam/docs/service-account-impersonation).
9. Click **Done** to finish creating the service account.

   Make a note of the email address for the service account.

### gcloud CLI

1. Create the service account:

   ```
   gcloud iam service-accounts create SERVICE_ACCOUNT_NAME \
     --display-name="SERVICE_ACCOUNT_NAME"
   ```
2. Optional: Assign roles to your service account to grant access to your Google Cloud project's resources in addition to Google Workspace resources. For more details, refer to [Manage access to projects, folders, and organizations](https://docs.cloud.google.com/iam/docs/granting-changing-revoking-access).

### Access Google Workspace files directly with a service account

If your app only needs to read or write specific files (such as a Google Sheet
or a Google Drive folder), you don't need to assign administrative roles or
configure domain-wide delegation. Instead, you can directly share individual
files with the service account's email address using the standard UI. You can
treat the service account's email address as a user account in the document's
share settings with no administrator privileges required.

To grant access:

1. Copy the email address of your service account. For example,
   `my-service-account@my-project.iam.gserviceaccount.com`.
2. Open the Sheets document or Drive folder you
   want to access.
3. Click **Share**.
4. Add the service account's email address and assign the appropriate access
   level (such as Editor or Viewer).
5. Deselect **Notify people** (since service accounts don't have inboxes it
   won't receive the invitation email, but the permission is still granted).
6. Click **Share**.

### Create a service account key

You need to obtain credentials in the form of a public/private key pair. These
credentials are used by your code to authorize service account actions within
your app.

To create a service account key:

1. In the Google Cloud Console, go to Menu
   > **IAM & Admin**
   > **Service Accounts**.

   [Go to Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

   The remaining steps appear in the Google Cloud Console.
2. Select a Google Cloud project.
3. Click the email address of the service account that you want to create a key for.
4. Click the **Keys** tab.
5. Click the **Add key** drop-down menu, then select **Create new key**.
6. Select **JSON** as the **Key type** and click **Create**.

   Your new public/private key pair is generated and downloaded to your
   machine as a service account key file. Save the downloaded JSON file as `credentials.json`
   in your working directory. This file is the only copy of this key. After you
   download the key file, you cannot download it again. For information about how to store
   your key securely, see
   [Best practices for managing service account keys](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys).

### Assign a Google Workspace administrator role to a service account

**Note:** Most apps don't require this step. Assign an administrator role only if
your app needs to perform domain-wide directory management (such as creating
users using the Directory API). For standard document access (like
Sheets), use [direct document sharing](https://developers.google.com/workspace/guides/create-credentials#access-workspace-files)
instead.

You can assign any prebuilt or custom Google Workspace role to a service
account, with the exception of the Super Admin role.

1. In the Google Admin console, go to Menu
   >
   **Account** > **Admin roles**.

   [Go to Admin roles](https://admin.google.com/ac/roles)

   *You must be signed in as a [Super Admin](https://knowledge.workspace.google.com/admin/users/prebuilt-administrator-roles#super-admin) for this task.*

   The remaining steps appear in the Google Admin console.
2. Point to the role that you want to assign, click the `Actions`
   drop-down menu, and select **Assign admin**.
3. Click **Assign service accounts**.
4. Enter the email address of the service account.
5. Click **Add > Assign role**.

### Optional: Set up domain-wide delegation for a service account

Use domain-wide delegation when your application needs to access Google Workspace data on behalf
of multiple individual users in your organization (such as sending emails using the Gmail API)
without requiring individual user consent.
To call APIs on behalf of users in a Google Workspace organization, grant your service account
domain-wide delegation of authority in the Google Admin console using a
[Super Admin](https://knowledge.workspace.google.com/admin/users/prebuilt-administrator-roles#super-admin)
account. For more information, see
[Delegate domain-wide authority to the service account](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority).

To set up domain-wide delegation of authority for a service account:

1. In the Google Cloud Console, go to Menu
   > **IAM & Admin**
   > **Service Accounts**.

   [Go to Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Select a Google Cloud project.
3. Click the email address of the service account that you want to set up domain-wide delegation for.
4. Click **Show advanced settings**.
5. Under "Domain-wide delegation", find your service account's "Client ID."
6. Click Copy to copy the client ID value to your clipboard.
7. If you have [Super Admin](https://knowledge.workspace.google.com/admin/users/prebuilt-administrator-roles#super-admin)
   access to the relevant Google Workspace account, click
   **View Google Workspace Admin Console**, sign in with your super administrator user
   account, and continue following these steps.

   If you don't have super administrator access to the relevant Google Workspace account,
   contact a super administrator for the account. Send them your service account's client ID
   and a list of OAuth Scopes required by your app so they can complete the following steps in the Google Admin console.

1. In the Google Admin console, go to Menu
   > **Security**
   > **Access and data control**
   > **API controls**.

   [Go to API controls](https://admin.google.com/ac/owl)
2. Click **Manage Domain Wide Delegation**.
3. Click **Add new**.
4. In the **Client ID** field, paste the client ID that you previously copied.
5. In the **OAuth Scopes** field, enter a comma-delimited list of the scopes required by your app. This is the same set of scopes you defined when configuring the OAuth consent screen.
6. Click **Authorize**.

   Changes can take up to 24 hours but typically happen more quickly. For more information, see [Control API access with domain-wide delegation](https://knowledge.workspace.google.com/admin/apps/control-api-access-with-domain-wide-delegation).

## Next step

You're ready to develop on Google Workspace! Review the list of [Google Workspace developer products](https://developers.google.com/workspace/products) and [how to
find help](https://developers.google.com/workspace/support).
