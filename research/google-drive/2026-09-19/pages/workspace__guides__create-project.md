# Create a Google Cloud project Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/guides/create-project

Retrieved: 2026-09-19T16:28:53.388282+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* A Google Cloud project is a prerequisite for utilizing Google Workspace APIs and developing Google Workspace add-ons or applications.
* You can create a new Cloud project through the Google Cloud console or the gcloud command-line interface, providing a foundation for your Google Workspace integrations.
* Depending on your usage of Google Workspace APIs, enabling billing for your Cloud project might be necessary to access certain features and services.
* After creating your Cloud project, the next crucial step is to enable the specific Google Workspace APIs that your application or add-on will interact with.

A Google Cloud project is required to use Google Workspace APIs and build
Google Workspace add-ons or apps. A Cloud project forms the
basis for creating, enabling, and using all Google Cloud services, including
managing APIs, enabling billing, adding and removing collaborators, and managing
permissions.

## Create a Cloud project

### Google Cloud console

1. In the Google Cloud console, go to Menu
   > **IAM & Admin**
   > **Create a Project**.

   [Go to Create a Project](https://console.cloud.google.com/projectcreate)
2. In the **Project Name** field, enter a descriptive name for your project.

   Optional: To edit the **Project ID**, click **Edit**. The project ID can't be changed
   after the project is created, so choose an ID that meets your needs for the lifetime of the
   project.
3. In the **Location** field, click **Browse** to display potential locations for your
   project. Then, click **Select**.
   **Caution: Can't find your Google Workspace organization?**  
   This means you aren't signed in to a Google Workspace account. Some of the features
   described in Google Workspace developer documentation are only available to projects
   associated with an organization.
4. Click **Create**. The Google Cloud console navigates to the Dashboard page and your project is created
   within a few minutes.

### gcloud CLI

In one of the following development environments, access the Google Cloud
CLI (`gcloud`):

* **Cloud Shell**: To use an online terminal with the gcloud CLI
  already set up, activate Cloud Shell.
    
  [Activate Cloud Shell](https://console.cloud.google.com/?cloudshell=true)
* **Local Shell**: To use a local development environment,
  [install](https://cloud.google.com/sdk/docs/install) and
  [initialize](https://cloud.google.com/sdk/docs/initializing)
  the gcloud CLI.
    
  To create a Cloud project, use the `gcloud projects create` command:

  ```
  gcloud projects create PROJECT_ID
  ```

  Replace PROJECT\_ID by setting the ID for the project you want to create.

For further information on Cloud projects, refer to
[Creating and managing projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects)
in the Google Cloud documentation.

## Optional: Enable billing for your Cloud project

Depending on the Google Workspace APIs and features that you want to
use, you might also need to enable billing for your Cloud project:

If you're unable to link a billing account, you don't have the
permissions needed to make this change. For more information, see
[Permissions required to enable billing](https://cloud.google.com/billing/docs/how-to/modify-project#required-permissions-enable).

### Google Cloud console

1. In the Google Cloud console, go to **Billing**. Click
   **Menu**
   > **Billing**
   > **My Projects**.

   [Go to Billing for My Projects](https://console.cloud.google.com/billing/projects)
2. In **Select an organization**, choose the organization associated with
   your Google Cloud project.
3. In the project row, open the **Actions** menu
   (),
   click **Change billing**, and choose the
   Cloud Billing account.
4. Click **Set account**.

### gcloud CLI

1. To list available billing accounts, run:

   ```
   gcloud billing accounts list
   ```
2. Link a billing account with a Google Cloud project:

   ```
   gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
   ```

   Replace the following:

   * `PROJECT_ID` is the **Project ID** for the
     Cloud project for which you want to enable billing.
   * `BILLING_ACCOUNT_ID` is the **billing account ID** to link with
     the Google Cloud project.

For further information about billing, see
[Enable, disable, or change billing for a project](https://cloud.google.com/billing/docs/how-to/modify-project)
in the Google Cloud Billing documentation.

## Next step

[Enable Google Workspace APIs](https://developers.google.com/workspace/guides/enable-apis)
in your Cloud project.
