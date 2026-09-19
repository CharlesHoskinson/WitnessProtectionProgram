# Configure the Drive MCP server Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/configure-mcp-server

Retrieved: 2026-09-19T16:29:32.978933+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

**Developer Preview:** Available as part of the
[Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview),
which grants early access to certain features.

Google Drive offers a remote
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction)
server that allows AI agents to securely interact with Google Drive data.
By configuring the Google Drive MCP server, you enable AI applications
like Google Antigravity and Claude to perform actions
in Google Drive.

The Google Drive MCP server provides a standardized way for AI agents to:

* **Read data**: Search files, retrieve metadata, and read file content.
* **Take action**: Create files and download content.
* **Respect security**: Inherit the same permissions and data governance
  controls as the user.

## Prerequisites

* Membership in the
  [Google Workspace Developer Preview Program](https://developers.google.com/workspace/preview).
* A Google Cloud project. To create a project, see
  [Create a project](https://developers.google.com/workspace/guides/create-project).
* An MCP host, like [Google Antigravity](https://antigravity.google/).
* To run the commands on this page, set up the gcloud CLI in a local
  development environment by following these steps:

  1. [Install the Google Cloud CLI](https://cloud.google.com/sdk/docs/install).
     If you installed the gcloud CLI previously, make sure you have the
     latest version by running `gcloud components update`.
  2. If you're using an external identity provider (IdP), sign in to the
     gcloud CLI with your federated identity. For more information, see
     [Sign in to the gcloud CLI with your federated identity](https://docs.cloud.google.com/iam/docs/workforce-log-in-gcloud).
  3. [Initialize the gcloud CLI](https://docs.cloud.google.com/sdk/docs/initializing).

## Configure the Google Drive MCP server

To use the Google Drive MCP server, you must enable it in your
Google Cloud project and then configure your MCP client to connect to it.

### Enable the APIs

To use the Google Drive MCP server, you must enable the following API
in your Google Cloud project:

* Google Drive API

### CLI

```
gcloud services enable drive.googleapis.com --project=PROJECT_ID
```

Replace `PROJECT_ID`
with your Google Cloud project ID.

### Console

Enable the APIs in the Google Cloud console:

[Enable the APIs](https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com)

### Enable the MCP services

To enable the MCP components for Google Drive, you must
enable the following service in your Google Cloud project:

* Google Drive MCP API

### CLI

```
gcloud services enable drivemcp.googleapis.com --project=PROJECT_ID
```

Replace `PROJECT_ID`
with your Google Cloud project ID.

### Console

Enable the MCP services in the Google Cloud console:

[Enable the MCP services](https://console.cloud.google.com/flows/enableapi?apiid=drivemcp.googleapis.com)

### Set up the OAuth consent screen

The Google Drive MCP server uses OAuth 2.0 for authentication and
authorization. You must configure the OAuth consent screen before you can
create an OAuth client ID.

1. In the Google Cloud console, go to **Google Auth Platform** **>** **Branding**.

   [Go to Branding](https://console.cloud.google.com/auth/branding)
2. If you have already configured the **Google Auth Platform**, you can
   configure the following OAuth Consent Screen settings in
   [Branding](https://console.cloud.google.com/auth/branding),
   [Audience](https://console.cloud.google.com/auth/audience),
   and [Data Access](https://console.cloud.google.com/auth/scopes).
   If you see a message that says **Google Auth Platform not configured
   yet**, click **Get Started**:

   1. Under **App Information**, in **App name**, type `Drive MCP Server`.
   2. In **User support email**, select your email address or an appropriate
      Google group.
   3. Click **Next**.
   4. Under **Audience**, select **Internal**. If you can't select
      **Internal**, select **External**.
   5. Click **Next**.
   6. Under **Contact Information**, enter an **Email address** where you can
      be notified about any changes to your project.
   7. Click **Next**.
   8. Under **Finish**, review the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
      and if you agree, select **I agree to the Google API Services: User
      Data Policy**.
   9. Click **Continue**.
   10. Click **Create**.
   11. If you selected **External** for user type, add test users:
       1. Click **Audience**.
       2. Under **Test users**, click **Add users**.
       3. Enter your email address and any other authorized test users, then
          click **Save**.
3. Click **Data Access** **>** **Add or Remove Scopes**. A panel appears with
   a list of scopes for each API that you've enabled in your Google Cloud
   project.

   1. Under **Manually add scopes**, paste the scopes for the Google Drive
      MCP server:

      * `https://www.googleapis.com/auth/drive.readonly`
      * `https://www.googleapis.com/auth/drive.file`
   2. Click **Add to Table**.
   3. Click **Update**.
   4. After selecting the scopes required by your app, on the **Data Access**
      page, click **Save**.

### Configure your MCP client

To add the Google Drive remote MCP server to your MCP client, follow the
instructions for your client.

### Antigravity

To add the Google Drive remote MCP server to Antigravity,
add the server configuration to your `mcp_config.json` file. These
instructions support Antigravity 2.0, Antigravity IDE, and Antigravity CLI.

1. Create an OAuth 2.0 client ID and secret:

   1. In the Google Cloud console, go to **Google Auth Platform** **>**
      **Clients** **>**
      **Create Client**

      [Go to Create Client](https://console.cloud.google.com/auth/clients/create)
   2. Select **Web application** as the application type.
   3. Enter a **Name**.
   4. In the **Authorized redirect URIs** section, click **+ Add URI**,
      and then add `https://antigravity.google/oauth-callback` in the
      **URIs** field.
   5. Click **Create** and copy your **Client ID** and **Client Secret**.
2. Open or create the configuration file `~/.gemini/config/mcp_config.json`.
3. Add the `mcpServers` configuration to `mcp_config.json`:

   ```
   {
     "mcpServers": {
       "drive": {
         "serverUrl": "https://drivemcp.googleapis.com/mcp/v1",
         "oauth": {
           "clientId": "OAUTH_CLIENT_ID",
           "clientSecret": "OAUTH_CLIENT_SECRET"
         }
       }
     }
   }
   ```

   Replace the following:

   * `OAUTH_CLIENT_ID`: The
     client ID you created.
   * `OAUTH_CLIENT_SECRET`:
     The client secret you created.
4. Save `mcp_config.json`.
5. Authenticate the MCP server. You can authenticate using either the
   GUI settings or the CLI:

   * **For Antigravity IDE or GUI (Antigravity 2.0):**

     1. Open your settings screen (e.g., click **Settings** at the
        bottom-left or open **Antigravity User Settings**).
     2. Navigate to **Customizations**.
     3. Under **Installed MCP Servers**, click **Refresh**.
     4. Find `drive` in the list, click **Authenticate**,
        sign in to your Google Account, copy the authorization code,
        paste it into the input dialog, and click **Submit**.
   * **For Antigravity CLI:**

     1. Start Antigravity CLI:

        ```
        agy
        ```
     2. Open the interactive MCP management panel by running:

        ```
        /mcp
        ```
     3. Use the arrow keys to select `drive`, move to the
        **Authenticate** action, and press **Enter**. Complete the
        sign-in flow in your browser, copy the authorization code, paste
        it into the terminal prompt, and press **Enter**.
6. Verify that the server is correctly configured and running:

   * **For Antigravity IDE or GUI:** A **Sign out** button is displayed
     next to the server under **Customizations** >
     **Installed MCP Servers**.
   * **For Antigravity CLI:** Open the `/mcp` panel to view your
     configured MCP servers. Verified and authenticated servers display
     **Authed** next to their names inside the interactive TUI panel.
     You can select any server under the dashboard view to inspect its
     status and list all of its available tools.

The remote MCP server is ready to use in Antigravity.

### Claude

To use the Google Drive remote MCP server with Claude.ai or Claude
Desktop, you must have the Claude Enterprise, Pro, Max, or Team plan.

To add the Google Drive remote MCP server to Claude, configure a
custom connector with an OAuth client ID and secret.

1. Create an OAuth 2.0 client ID and secret:

   1. In the Google Cloud console, go to **Google Auth Platform** **>**
      **Clients** **>**
      **Create Client**

      [Go to Create Client](https://console.cloud.google.com/apis/credentials/oauthclient)
   2. Select **Web application** as the application type.
   3. Enter a **Name**.
   4. In the **Authorized redirect URIs** section, click **+ Add URI**,
      and then add `https://claude.ai/api/mcp/auth_callback` in the
      **URIs** field.
   5. Click **Create** and copy your **Client ID** and **Client Secret**.
2. Configure the MCP server in Claude:

   1. In Claude.ai or Claude Desktop, go to **Settings** (or
      **Admin settings**) > **Connectors**.
   2. Click **Add custom connector**.
   3. Enter the connection details for the Google Drive product:
      * **Server name**: `Google Drive`.
      * **Remote MCP server URL**: `https://drivemcp.googleapis.com/mcp/v1`
   4. In **Advanced settings**, enter your **OAuth client ID** and **OAuth client secret**.
   5. Click **Add**.

### Others

Many AI applications have ways to connect to a remote MCP server. You
typically need to enter details about the server, like its name, endpoints,
transport protocol, and authentication method. For the Google Drive
remote MCP server, enter the following:

* **Server name**: `drive`
* **Server URL**: `https://drivemcp.googleapis.com/mcp/v1`
* **Transport**: [Streamable HTTP](https://modelcontextprotocol.io/specification/latest/basic/transports/streamable-http)
* **Authentication**: The Google Drive remote MCP server
  uses OAuth 2.0. For details, see
  [Learn about authentication and authorization](https://developers.google.com/workspace/guides/auth-overview).

For more details on connecting different types of clients, see
[Configure MCP in an AI application](https://docs.cloud.google.com/mcp/configure-mcp-ai-application).

## Test the Google Drive MCP server

After you configure the MCP client, you can verify the connection by
running some test prompts.

Try asking your MCP client the following questions:

* **"Summarize the file Marketing Plan."**

  The client calls `drive.search_files` to locate "Marketing Plan", then uses
  `drive.read_file_content` to retrieve and summarize its content.

If the tools execute successfully and you receive relevant responses, your
Google Drive MCP server is correctly configured.

## Troubleshooting

If you encounter issues connecting to the MCP server, you can check for errors
in the OAuth logs. Ask your administrator to check the **OAuth log events**
in the [security investigation tool](https://support.google.com/a/answer/7575955).

## Tool reference

The following tools are available for the Google Drive MCP server:

* `copy_file`
* `create_file`
* `download_file_content`
* `get_file_metadata`
* `get_file_permissions`
* `list_recent_files`
* `read_file_content`
* `search_files`

## Important security consideration: Indirect prompt injection

When you expose a language model to untrusted data, there is a risk of an
[indirect prompt injection attack](https://en.wikipedia.org/wiki/Prompt_injection).
Because MCP hosts like Google Antigravity have access to
powerful tools and APIs through the Google Drive MCP server, they can
read, modify, and delete data in your Google Account.

To mitigate these risks, you must screen prompts and responses for malicious
content or prompt injection attacks. You can use the Google-provided
Model Armor or you can use your own solution if you document it in
order for users to accept that risk. For more information, see
[Configure security for Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-security).

Follow these best practices:

* **Only use trusted tools.** Never connect Google Drive MCP server to
  untrusted or unverified applications.
* **Be cautious with untrusted inputs.** Avoid asking your MCP client to
  process documents or other resources from unverified sources. These
  inputs may contain hidden instructions that can hijack your session,
  allowing an attacker to modify, steal, or delete your data.
* **Review all actions.** Always carefully review the actions taken by your AI
  client on your behalf to ensure they are correct and align with your
  intentions.

## Related topics

* [Configure security for Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-security)
* [Google Workspace MCP servers in Antigravity (codelab)](https://codelabs.developers.google.com/google-workspace-mcp-antigravity#0)
* [List of Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers#support-products)
