# Integrate with Drive UI's "New" button Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/integrate-create

Retrieved: 2026-09-19T16:30:08.459524+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

When a user clicks [Drive UI's "New"
button](https://developers.google.com/workspace/drive/api/guides/about-apps#new) and selects an app in the
Drive UI, Drive redirects the user to that app's New URL
defined in [Configure a Drive UI
integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk).

Your app then receives a default set of template variables within a
[`state`](https://developers.google.com/workspace/drive/api/guides/enable-sdk#construct) parameter. The default `state`
information for a New URL is:

```
{
  "action":"create",
  "folderId":"FOLDER_ID",
  "folderResourceKey":"FOLDER_RESOURCE_KEY",
  "userId":"USER_ID"
}
```

This output includes the following values:

* `create`: The action being performed. The value is `create` when a user
  clicks [Drive UI's "New"
  button](https://developers.google.com/workspace/drive/api/guides/about-apps#new).
* FOLDER\_ID: The ID of the parent folder.
* FOLDER\_RESOURCE\_KEY: The resource key of the parent folder.
* USER\_ID: The profile ID that uniquely identifies the
  user.

Your app must act on this request by following these steps:

1. Verify that the `action` field has a value of `create`.
2. Use the `userId` value to create a new session for the user. For more
   information on signed-in users, see [Users & new events](https://developers.google.com/workspace/drive/api/guides/integrate-create#potential-logins).
3. Use the [`files.create`](https://developers.google.com/workspace/drive/api/v3/reference/files/create) method to
   create a file resource. If `folderId` was set on the request, set the
   `parents` field to the `folderId` value.
4. If `folderResourceKey` was set on the request, set the
   `X-Goog-Drive-Resource-Keys` request header. For more information on
   resource keys, see [Access link-shared files using resource
   keys](https://developers.google.com/workspace/drive/api/guides/resource-keys).

The `state` parameter is URL-encoded, so your app must handle the escape
characters and parse it as JSON.

## Users & new events

Drive apps should treat all "create" events as potential
sign-ins. Some users might have multiple accounts, so the user ID in the `state`
parameter might not match the current session. If the user ID in the `state`
parameter doesn't match the current session, end the current session for your
app and sign in as the requested user.
