# Share files, folders, and drives Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/manage-sharing

Retrieved: 2026-09-19T16:29:47.383452+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Every Google Drive file, folder, and shared drive has associated
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resources. Each resource
identifies the permission for a specific
[`type`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.type) (`user`,
`group`, `domain`, `anyone`) and
[`role`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.role) (`owner`,
`organizer`, `fileOrganizer`, `writer`, `commenter`, `reader`). For example, a
file might have a permission granting a specific user (`type=user`) read-only
access (`role=reader`) while another permission grants members of a specific
group (`type=group`) the ability to add comments to a file (`role=commenter`).

For a complete list of roles and the operations permitted by each, see [Roles
and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).

**Note:** The list of all permission resources associated with a file, folder, or
shared drive, is known as an *Access Control List (ACL)*.

## How permissions propagate

Permissions propagate downward from parent folders to all child items:

* **Inherited by default**: All child files and folders automatically inherit
  permissions from their parent folder.
* **Cannot be reduced on children**: You cannot remove or reduce an inherited
  permission on a child item. Changes must be made on the originating parent,
  or the folder must use the
  [limited access setting](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access).
* **Can be expanded on children**: A child item can grant a more permissive
  role, such as granting `role=writer` on a file inside a folder where the
  user has `role=reader`.
* **Re-evaluated on move**: Moving an item to a new parent folder re-evaluates
  and applies the new parent's permissions to the item and its children.

### File links and access control

When you share a file or folder with a specific user or group, the URL to access
the item doesn't change, and a unique link isn't generated for each user.
Instead, the item has a single, constant link based on its `fileId`.

Drive controls access by evaluating the item's ACL. When a user
attempts to open a link, Drive verifies their authenticated
identity against the ACL. If a permission is revoked or reaches its expiration
date, the user is removed from the ACL. If the user attempts to visit the link
again, Drive denies access.

## Understand file capabilities

The [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource defines *who has
access* (the ACL), but does not directly indicate whether the current user can
perform a specific action in your application's UI.

Instead, the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource contains a collection
of boolean [`capabilities`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.capabilities)
fields (such as `canComment`, `canShare`, or `canDelete`) that the
Google Drive API computes dynamically based on the user's role and item settings.

### Get file capabilities

When rendering your app's UI, check `files.capabilities` rather than parsing
permissions directly:

* Call the [`files.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method with
  `fields=capabilities`. For more information, see
  [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).
* Use the returned boolean flags to enable or disable corresponding actions in
  your interface. For example, disable commenting if `canComment` is `false`.

## Scenarios for sharing Drive resources

The following table shows the required roles and conditions for sharing
Drive resources across different locations and item types:

| Location | Item | Required roles | Key constraints |
| --- | --- | --- | --- |
| My Drive | File or folder | `owner` or `writer` | Requires `owner` if `writersCanShare=false`. Expiring access on folders requires `reader` (see [Set an expiration date](https://developers.google.com/workspace/drive/api/guides/manage-sharing#expiration-date)). |
| Shared drive | File | `organizer`, `fileOrganizer`, or `writer` | [`writersCanShare`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.writers_can_share) is always treated as `true`. |
| Shared drive | Folder | `organizer` | `fileOrganizer` can also share if [`sharingFoldersRequiresOrganizerPermission`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.inlinedField_29) is `false`. |
| Shared drive | Membership | `organizer` | Applies to `user` or `group` only (not domains). |

## Manage permissions

The following table summarizes the methods available on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource:

| Method | API endpoint | Key parameters | Reference |
| --- | --- | --- | --- |
| **Create** | `POST https://www.googleapis.com/drive/v3/files/{fileId}/permissions` | `role`, `type`, `emailAddress` or `domain` | [`permissions.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) |
| **Get** | `GET https://www.googleapis.com/drive/v3/files/{fileId}/permissions/{permissionId}` | `fields` | [`permissions.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/get) |
| **List** | `GET https://www.googleapis.com/drive/v3/files/{fileId}/permissions` | `pageSize`, `supportsAllDrives`, `pageToken` | [`permissions.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list) |
| **Update** | `PATCH https://www.googleapis.com/drive/v3/files/{fileId}/permissions/{permissionId}` | `role`, `allowFileDiscovery` | [`permissions.update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/update) |
| **Delete** | `DELETE https://www.googleapis.com/drive/v3/files/{fileId}/permissions/{permissionId}` | `supportsAllDrives` | [`permissions.delete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete) |

## Create a permission

To share a file, folder, or shared drive, call the
[`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) method on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the `fileId`.
Creating a permission adds a new ACL entry to the item and returns an assigned
`permissionId`.

In the request body, provide the following fields:

* [`role`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.role): The access
  level to grant (for example, `reader`, `commenter`, or `writer`). For a
  complete list, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).
* [`type`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.type): The scope
  of the grantee (`user`, `group`, `domain`, or `anyone`).
* **Grantee identifier** (required based on `type`):
  + [`emailAddress`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.email_address):
    Required when `type` is `user` or `group`.
  + [`domain`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.domain):
    Required when `type` is `domain`.

The following code sample shows how to create a permission. The response returns an instance of a `permissions` resource, including the assigned `permissionId`.

**Request**

```
POST https://www.googleapis.com/drive/v3/files/FILE_ID/permissions
```

```
{
  "role": "commenter",
  "type": "user",
  "emailAddress": "alex@altostrat.com"
}
```

**Response**

```
{
  "kind": "drive#permission",
  "id": "PERMISSION_ID",
  "type": "user",
  "role": "commenter"
}
```

**Note:** The `permissions.create` method creates one permission per request. To
create or update multiple permissions in a single batch, see [Update multiple
permissions with batch requests](https://developers.google.com/workspace/drive/api/guides/manage-sharing#update-multiple-permissions).

### Share with target audiences

Target audiences are groups of people—such as departments or teams—that you can
recommend for users to share their items with. You can encourage users to share
items with a more specific or limited audience rather than your entire
organization. Target audiences can help you improve the security and privacy of
your data, and make it easier for users to share appropriately.

To share with a target audience, set `type=domain` and set `domain` to
`<TARGET_AUDIENCE_ID>.audience.googledomains.com`. For details on locating or
creating target audiences in the Google Admin console, see [About target
audiences](https://support.google.com/a/answer/9934697).

To view how users interact with target audiences, see [User experience for link
sharing](https://support.google.com/a/answer/9934697#ue).

## Get a permission

To get a permission, call the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/get) method
on the [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the
`fileId` and `permissionId` path parameters. If you don't know the permission
ID, [list all permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing#list-permissions) first.

## List permissions

To list permissions for a file, folder, or shared drive, call the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list) method on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the required
`fileId` path parameter.

You can include any of the following optional [query
parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#query-parameters) to paginate or
filter the response:

* `pageSize` (optional): The maximum number of permissions to return per page.
  If not set for files in a shared drive, at most 100 results are returned. If
  not set for files that aren't in a shared drive, the entire list is returned.
* `pageToken` (optional): A page token from a previous list call to retrieve
  the subsequent page.
* `supportsAllDrives` (optional): Whether the requesting app supports both My
  Drive and shared drives.
* `useDomainAdminAccess` (optional): Set to `true` to issue the request as a
  domain administrator. The requester is granted access if the `fileId`
  parameter refers to a shared drive and the requester is an administrator of
  the domain to which the shared drive belongs. For more information, see
  [Manage shared drives as domain
  administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).
* `includePermissionsForView` (optional): Additional view permissions to
  include in the response. Only `published` is supported.
* `fields` (optional): Specific fields to return in the response. By default,
  `list` returns only `id`, `type`, `kind`, and `role`. To return additional
  fields (such as `permissionDetails`), specify them using this parameter. For
  more information, see
  [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

### Determine the role source

To change the role on a file or folder, you must know the source of the role.
For shared drives, the source of a role can be based on membership to the shared
drive, the role on a folder, or the role on a file.

To determine the role source for a shared drive, or items within that drive,
call the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/get) method on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the `fileId` and
`permissionId` path parameters, and the `fields` parameter set to the
`permissionDetails` field.

To find the `permissionId`, use the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list) method on the `permissions`
resource with the `fileId` path parameter. To fetch the `permissionDetails`
field on the `list` request, set the `fields` parameter to
`permissions/permissionDetails`.

This field enumerates all inherited and direct file permissions for the user,
group, or domain.

The following code sample shows how to determine the role source. The response returns the `permissionDetails` of a `permissions` resource. The `inheritedFrom` field provides the ID of the item from which the permission is inherited.

**Request**

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID/permissions/PERMISSION_ID?fields=permissionDetails&supportsAllDrives=true
```

**Response**

```
{
  "permissionDetails": [
    {
      "permissionType": "member",
      "role": "commenter",
      "inheritedFrom": "INHERITED_FROM_ID",
      "inherited": true
    },
    {
      "permissionType": "file",
      "role": "writer",
      "inherited": false
    }
  ]
}
```

## Update a permission

To update permissions on a file or folder, you can change the assigned role. For
more information on finding the role source, see [Determine the role
source](https://developers.google.com/workspace/drive/api/guides/manage-sharing#role-source).

1. Call the [`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/update) method on the
   [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the `fileId`
   path parameter set to the associated file, folder, or shared drive and the
   `permissionId` path parameter set to the permission to change. To find the
   `permissionId`, use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list) method
   on the `permissions` resource with the `fileId` path parameter.

   **Note:** The `permissionId` represents the user or group to which the
   permission is granted, such as `alex@altostrat.com` or
   `hiking-club@altostrat.com`. The `permissionId` remains the same for that
   user or group across all files, folders, and shared drives.
2. In the request, identify the new `role`.

You can grant permissions on individual files or folders in a shared drive even
if the user or group is already a member. For example, Alex has `role=commenter`
as part of their membership to a shared drive. However, your app can grant Alex
`role=writer` for a file in a shared drive. In this case, because the new role
is more permissive than the role granted through their membership, the new
permission becomes the *effective role* for the file or folder.

You can apply updates through patch semantics, meaning you can make partial
modifications to a resource. You must explicitly set the fields that you intend
to modify in your request. Any fields not included in the request retain their
existing values. For more information, see [Working with partial resources](https://developers.google.com/workspace/drive/api/guides/performance#partial).

In addition to changing roles, you can also modify the discoverability of an
item when the permission `type` is `domain` or `anyone`. To make a shared file
searchable or unlisted, include the [`allowFileDiscovery`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.allow_file_discovery) boolean
field in your patch request. Setting this to `true` allows the item to appear in
search results for the specified audience, even if they haven't been given the
direct link. You don't need to delete and recreate the permission to change this
setting.

The following code sample shows how to change permissions on a file or folder from `commenter` to `writer`. The response returns an instance of a `permissions` resource.

**Request**

```
PATCH https://www.googleapis.com/drive/v3/files/FILE_ID/permissions/PERMISSION_ID
```

```
{
  "role": "writer"
}
```

**Response**

```
{
  "kind": "drive#permission",
  "id": "PERMISSION_ID",
  "type": "user",
  "role": "writer"
}
```

## Update multiple permissions with batch requests

Concurrent permission modifications on the same file, folder, or shared drive
aren't supported. This limitation applies to all mutating operations (such as
update or delete), regardless of whether you're modifying permissions for the
same recipient or different recipients, and whether requests originate from a
single app or multiple users.

Drive evaluates and updates an item's permissions as a single
ACL. Simultaneous operations cause race conditions where "last write wins,"
which can silently overwrite permission changes or trigger
[`sharingRateLimitExceeded`](https://developers.google.com/workspace/drive/api/guides/handle-errors#sharing-rate-limit)
errors.

To avoid conflicts, execute permission changes on the same item sequentially, or
use [batch requests](https://developers.google.com/workspace/drive/api/guides/performance#batch-requests) to modify
multiple permissions in a single request.

The following is an example of performing a batch permission modification with a
client library.

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Java

drive/snippets/drive\_v3/src/main/java/ShareFile.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/ShareFile.java)

```
import com.google.api.client.googleapis.batch.BatchRequest;
import com.google.api.client.googleapis.batch.json.JsonBatchCallback;
import com.google.api.client.googleapis.json.GoogleJsonError;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.Permission;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/* Class to demonstrate use-case of modify permissions. */
public class ShareFile {

  /**
   * Batch permission modification.
   * realFileId file Id.
   * realUser User Id.
   * realDomain Domain of the user ID.
   *
   * @return list of modified permissions if successful, {@code null} otherwise.
   * @throws IOException if service account credentials file not found.
   */
  public static List<String> shareFile(String realFileId, String realUser, String realDomain)
      throws IOException {
        /* Load pre-authorized user credentials from the environment.
         TODO(developer) - See https://developers.google.com/identity for
         guides on implementing OAuth2 for your application.application*/
    GoogleCredentials credentials = GoogleCredentials.getApplicationDefault()
        .createScoped(Arrays.asList(DriveScopes.DRIVE_FILE));
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    Drive service = new Drive.Builder(new NetHttpTransport(),
        GsonFactory.getDefaultInstance(),
        requestInitializer)
        .setApplicationName("Drive samples")
        .build();

    final List<String> ids = new ArrayList<String>();


    JsonBatchCallback<Permission> callback = new JsonBatchCallback<Permission>() {
      @Override
      public void onFailure(GoogleJsonError e,
                            HttpHeaders responseHeaders)
          throws IOException {
        // Handle error
        System.err.println(e.getMessage());
      }

      @Override
      public void onSuccess(Permission permission,
                            HttpHeaders responseHeaders)
          throws IOException {
        System.out.println("Permission ID: " + permission.getId());

        ids.add(permission.getId());

      }
    };
    BatchRequest batch = service.batch();
    Permission userPermission = new Permission()
        .setType("user")
        .setRole("writer");

    userPermission.setEmailAddress(realUser);
    try {
      service.permissions().create(realFileId, userPermission)
          .setFields("id")
          .queue(batch, callback);

      Permission domainPermission = new Permission()
          .setType("domain")
          .setRole("reader");

      domainPermission.setDomain(realDomain);

      service.permissions().create(realFileId, domainPermission)
          .setFields("id")
          .queue(batch, callback);

      batch.execute();

      return ids;
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to modify permission: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/file\_snippet/share\_file.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/file_snippet/share_file.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def share_file(real_file_id, real_user, real_domain):
  """Batch permission modification.
  Args:
      real_file_id: file Id
      real_user: User ID
      real_domain: Domain of the user ID
  Prints modified permissions

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)
    ids = []
    file_id = real_file_id

    def callback(request_id, response, exception):
      if exception:
        # Handle error
        print(exception)
      else:
        print(f"Request_Id: {request_id}")
        print(f'Permission Id: {response.get("id")}')
        ids.append(response.get("id"))

    # pylint: disable=maybe-no-member
    batch = service.new_batch_http_request(callback=callback)
    user_permission = {
        "type": "user",
        "role": "writer",
        "emailAddress": "user@example.com",
    }
    batch.add(
        service.permissions().create(
            fileId=file_id,
            body=user_permission,
            fields="id",
        )
    )
    domain_permission = {
        "type": "domain",
        "role": "reader",
        "domain": "example.com",
    }
    domain_permission["domain"] = real_domain
    batch.add(
        service.permissions().create(
            fileId=file_id,
            body=domain_permission,
            fields="id",
        )
    )
    batch.execute()

  except HttpError as error:
    print(f"An error occurred: {error}")
    ids = None

  return ids


if __name__ == "__main__":
  share_file(
      real_file_id="1dUiRSoAQKkM3a4nTPeNQWgiuau1KdQ_l",
      real_user="gduser1@workspacesamples.dev",
      real_domain="workspacesamples.dev",
  )
```

### Node.js

drive/snippets/drive\_v3/file\_snippets/share\_file.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/file_snippets/share_file.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Shares a file with a user and a domain.
 * @param {string} fileId The ID of the file to share.
 * @param {string} targetUserEmail The email address of the user to share with.
 * @param {string} targetDomainName The domain to share with.
 * @return {Promise<Array<string>>} A promise that resolves to an array of permission IDs.
 */
async function shareFile(fileId, targetUserEmail, targetDomainName) {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  /** @type {Array<string>} */
  const permissionIds = [];

  // The permissions to create.
  const permissions = [
    {
      type: 'user',
      role: 'writer',
      emailAddress: targetUserEmail, // e.g., 'user@partner.com'
    },
    {
      type: 'domain',
      role: 'writer',
      domain: targetDomainName, // e.g., 'example.com'
    },
  ];

  // Iterate through the permissions and create them one by one.
  for (const permission of permissions) {
    const result = await service.permissions.create({
      requestBody: permission,
      fileId,
      fields: 'id',
    });

    if (result.data.id) {
      permissionIds.push(result.data.id);
      console.log(`Inserted permission id: ${result.data.id}`);
    } else {
      throw new Error('Failed to create permission');
    }
  }
  return permissionIds;
}
```

### PHP

drive/snippets/drive\_v3/src/DriveShareFile.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveShareFile.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function shareFile()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $realFileId = readline("Enter File Id: ");
        $realUser = readline("Enter user email address: ");
        $realDomain = readline("Enter domain name: ");
        $ids = array();
            $fileId = '1sTWaJ_j7PkjzaBWtNc3IzovK5hQf21FbOw9yLeeLPNQ';
            $fileId = $realFileId;
            $driveService->getClient()->setUseBatch(true);
            try {
                $batch = $driveService->createBatch();

                $userPermission = new Drive\Permission(array(
                    'type' => 'user',
                    'role' => 'writer',
                    'emailAddress' => 'user@example.com'
                ));
                $userPermission['emailAddress'] = $realUser;
                $request = $driveService->permissions->create(
                    $fileId, $userPermission, array('fields' => 'id'));
                $batch->add($request, 'user');
                $domainPermission = new Drive\Permission(array(
                    'type' => 'domain',
                    'role' => 'reader',
                    'domain' => 'example.com'
                ));
                $userPermission['domain'] = $realDomain;
                $request = $driveService->permissions->create(
                    $fileId, $domainPermission, array('fields' => 'id'));
                $batch->add($request, 'domain');
                $results = $batch->execute();

                foreach ($results as $result) {
                    if ($result instanceof Google_Service_Exception) {
                        // Handle error
                        printf($result);
                    } else {
                        printf("Permission ID: %s\n", $result->id);
                        array_push($ids, $result->id);
                    }
                }
            } finally {
                $driveService->getClient()->setUseBatch(false);
            }
            return $ids;
    } catch(Exception $e) {
        echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/ShareFile.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/ShareFile.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Requests;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of Drive modify permissions.
    public class ShareFile
    {
        /// <summary>
        /// Batch permission modification.
        /// </summary>
        /// <param name="realFileId">File id.</param>
        /// <param name="realUser">User id.</param>
        /// <param name="realDomain">Domain id.</param>
        /// <returns>list of modified permissions, null otherwise.</returns>
        public static IList<String> DriveShareFile(string realFileId, string realUser, string realDomain)
        {
            try
            {
                /* Load pre-authorized user credentials from the environment.
                 TODO(developer) - See https://developers.google.com/identity for
                 guides on implementing OAuth2 for your application. */
                GoogleCredential credential = GoogleCredential.GetApplicationDefault()
                    .CreateScoped(DriveService.Scope.Drive);

                // Create Drive API service.
                var service = new DriveService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Drive API Snippets"
                });

                var ids = new List<String>();
                var batch = new BatchRequest(service);
                BatchRequest.OnResponse<Permission> callback = delegate(
                    Permission permission,
                    RequestError error,
                    int index,
                    HttpResponseMessage message)
                {
                    if (error != null)
                    {
                        // Handle error
                        Console.WriteLine(error.Message);
                    }
                    else
                    {
                        Console.WriteLine("Permission ID: " + permission.Id);
                    }
                };
                Permission userPermission = new Permission()
                {
                    Type = "user",
                    Role = "writer",
                    EmailAddress = realUser
                };

                var request = service.Permissions.Create(userPermission, realFileId);
                request.Fields = "id";
                batch.Queue(request, callback);

                Permission domainPermission = new Permission()
                {
                    Type = "domain",
                    Role = "reader",
                    Domain = realDomain
                };
                request = service.Permissions.Create(domainPermission, realFileId);
                request.Fields = "id";
                batch.Queue(request, callback);
                var task = batch.ExecuteAsync();
                task.Wait();
                return ids;
            }
            catch (Exception e)
            {
                // TODO(developer) - handle error appropriately
                if (e is AggregateException)
                {
                    Console.WriteLine("Credential Not found");
                }
                else
                {
                    throw;
                }
            }
            return null;
        }
    }
}
```

## Delete a permission

To revoke access to a file or folder, call the
[`delete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete) method on the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource with the `fileId` and
`permissionId` path parameters.

Inherited permissions cannot be revoked directly on child items. Update or
delete the permission on the parent folder instead (or use the
[limited access setting](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access)).

Note that removing a user's access from a parent item only revokes permissions
inherited from that parent. If the user was also granted direct permissions on a
child item, that direct access persists. To confirm that a permission is removed,
call [`list`](https://developers.google.com/workspace/drive/api/guides/manage-sharing#list-permissions) with the `fileId`.

## Set an expiration date

To grant temporary access to a file or folder, set the
[`expirationTime`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.expiration_time)
field ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)) when
calling the [`create`](https://developers.google.com/workspace/drive/api/guides/manage-sharing#create-permission) or [`update`](https://developers.google.com/workspace/drive/api/guides/manage-sharing#update-permissions)
methods.

Expiration times have the following restrictions:

* Can only be set on `user` and `group` permissions (not `domain` or `anyone`).
* Time must be in the future, up to a maximum of one year.
* For folders, temporary access is only supported with the `reader` role.

**Note:** If you're using the older Drive API v2, use the
[`expirationDate`](https://developers.google.com/workspace/drive/api/reference/rest/v2/permissions) field. Learn how to
[migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

## Related topics

* [Manage pending access proposals](https://developers.google.com/workspace/drive/api/guides/pending-access)
* [Manage folders with limited and expansive access](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access)
* [Transfer file ownership](https://developers.google.com/workspace/drive/api/guides/transfer-file)
* [Protect file content](https://developers.google.com/workspace/drive/api/guides/content-restrictions)
* [Access link-shared Drive files using resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys)
* [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
