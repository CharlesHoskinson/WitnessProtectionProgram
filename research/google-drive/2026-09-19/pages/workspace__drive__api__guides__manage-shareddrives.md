# Manage shared drives Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/manage-shareddrives

Retrieved: 2026-09-19T16:30:14.092266+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document contains tasks related to managing shared drives, such as creating
shared drives and managing members and permissions, using the Google Drive API.

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions)
with any method of the [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource. If you
don't specify the `fields` parameter, the server returns a default set of fields
specific to the method. For example, the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list) method returns only the `kind`, `id`,
and `name` fields for each shared drive. For more information, see [Return
specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

To learn more about shared drive folder limits, see [Shared drive folder
limits](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#folder-limits).

## Prerequisites

Before you can create and manage shared drives, ensure that you meet the
following requirements:

* **Google Workspace account:** Shared drives are available with supported
  Google Workspace editions (such as Business Standard, Business Plus,
  Enterprise, and Education). Personal Google Accounts (`@gmail.com`) cannot
  create shared drives.
* **Creation permission:** Domain administrators can configure whether users
  in their organization can create shared drives. The authenticated user must
  belong to an organizational unit that is permitted to create shared drives.
* **OAuth 2.0 scope:** Your app must be authorized with the
  `https://www.googleapis.com/auth/drive` scope.
* **Roles:** When a user creates a shared drive, they are automatically
  assigned the `organizer` role on that shared drive. Managing drive
  settings, renaming the drive, adding or removing members, and deleting the
  shared drive all require the `organizer` role. For more information about
  roles, see [Roles for shared
  drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives#roles).
* **Domain administrator access:** Domain administrators can manage any
  shared drive within their organization regardless of membership by passing
  `useDomainAdminAccess=true`. For more information, see [Manage shared
  drives as domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).

## Create a shared drive

To create a shared drive, use the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create)
method on the [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the
`requestId` parameter.

The `requestId` parameter identifies the logical attempt for idempotent creation
of a shared drive. If the request times out or returns an indeterminate backend
error, the same request can be repeated and won't create duplicates. The
`requestId` and body of the request must remain the same.

**Note:** If you're using the earlier Drive API v2, use the [`insert`](https://developers.google.com/workspace/drive/api/reference/rest/v2/drives/insert) method. You can find code samples in
[GitHub](https://github.com/googleworkspace).

The following code sample shows how to create a shared drive:

### Java

drive/snippets/drive\_v3/src/main/java/CreateDrive.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/CreateDrive.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.Drive;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;

/* class to demonstrate use-case of Drive's create drive. */
public class CreateDrive {

  /**
   * Create a drive.
   *
   * @return Newly created drive id.
   * @throws IOException if service account credentials file not found.
   */
  public static String createDrive() throws IOException {
        /*Load pre-authorized user credentials from the environment.
        TODO(developer) - See https://developers.google.com/identity for
        guides on implementing OAuth2 for your application.*/
    GoogleCredentials credentials =
        GoogleCredentials.getApplicationDefault().createScoped(Arrays.asList(DriveScopes.DRIVE));
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    com.google.api.services.drive.Drive service =
        new com.google.api.services.drive.Drive.Builder(new NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            requestInitializer)
            .setApplicationName("Drive samples")
            .build();

    Drive driveMetadata = new Drive();
    driveMetadata.setName("Project Resources");
    String requestId = UUID.randomUUID().toString();
    try {
      Drive drive = service.drives().create(requestId,
              driveMetadata)
          .execute();
      System.out.println("Drive ID: " + drive.getId());

      return drive.getId();
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to create drive: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/drive\_snippet/create\_drive.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/drive_snippet/create_drive.py)

```
import uuid

import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def create_drive():
  """Create a drive.
  Returns:
      Id of the created drive

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    drive_metadata = {"name": "Project Resources"}
    request_id = str(uuid.uuid4())
    # pylint: disable=maybe-no-member
    drive = (
        service.drives()
        .create(body=drive_metadata, requestId=request_id, fields="id")
        .execute()
    )
    print(f'Drive ID: {drive.get("id")}')

  except HttpError as error:
    print(f"An error occurred: {error}")
    drive = None

  return drive.get("id")


if __name__ == "__main__":
  create_drive()
```

### Node.js

drive/snippets/drive\_v3/drive\_snippets/create\_drive.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/drive_snippets/create_drive.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';
import {v4 as uuid} from 'uuid';

/**
 * Creates a new shared drive.
 * @return {Promise<string>} The ID of the created shared drive.
 */
async function createDrive() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // The metadata for the new shared drive.
  const driveMetadata = {
    name: 'Project resources',
  };

  // A unique request ID to avoid creating duplicate shared drives.
  const requestId = uuid();

  // Create the new shared drive.
  const Drive = await service.drives.create({
    requestBody: driveMetadata,
    requestId,
    fields: 'id',
  });

  // Print the ID of the new shared drive.
  console.log('Drive Id:', Drive.data.id);
  if (!Drive.data.id) {
    throw new Error('Drive ID not found.');
  }
  return Drive.data.id;
}
```

### PHP

drive/snippets/drive\_v3/src/DriveCreateDrive.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveCreateDrive.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
use Ramsey\Uuid\Uuid;
function createDrive()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);

        $driveMetadata = new Drive\Drive(array(
                'name' => 'Project Resources'));
        $requestId = Uuid::uuid4()->toString();
        $drive = $driveService->drives->create($requestId, $driveMetadata, array(
                'fields' => 'id'));
        printf("Drive ID: %s\n", $drive->id);
        return $drive->id;
    } catch(Exception $e)  {
        echo "Error Message: ".$e;
    }  

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/CreateDrive.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/CreateDrive.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use of Drive's create drive.
    public class CreateDrive
    {
        /// <summary>
        /// Create a drive.
        /// </summary>
        /// <returns>newly created drive Id.</returns>
        public static string DriveCreateDrive()
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

                var driveMetadata = new Drive()
                {
                    Name = "Project Resources"
                };
                var requestId = Guid.NewGuid().ToString();
                var request = service.Drives.Create(driveMetadata, requestId);
                request.Fields = "id";
                var drive = request.Execute();
                Console.WriteLine("Drive ID: " + drive.Id);
                return drive.Id;
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

Calls to the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create) method are
idempotent.

If the shared drive was successfully created on a previous request or due to a
retry, the method returns an instance of the `drives` resource. Sometimes, such
as after a prolonged time or if the body of the request has changed, a `409`
error might be returned indicating the `requestId` must be discarded.

## Get a shared drive

To get metadata for a shared drive, use the
[`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/get) method on the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the `driveId` path
parameter. If you don't know the drive ID, you can
[list all shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#list-shared-drives) using the `list` method.

The `get` method returns a shared drive as an instance of a `drives` resource.

To issue the request as a domain administrator, set the `useDomainAdminAccess`
query parameter to `true`. For more information, see [Manage shared drives as
domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).

## List shared drives

To list a user's shared drives, use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list)
method on the [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource. The method returns
a list of shared drives.

Pass the following query parameters to customize pagination of, or to filter,
shared drives:

* `pageSize`: The maximum number of shared drives to return per page.
* `pageToken`: A page token, received from a previous list call. Provide this
  token to retrieve the subsequent page.
* `q`: Query string for searching shared drives. For more information, see
  [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives).
* `useDomainAdminAccess`: Set to `true` to issue the request as a domain
  administrator to return all shared drives of the domain in which the
  requester is an administrator. For more information, see [Manage shared
  drives as domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).

## Update a shared drive

To update the metadata for a shared drive, use the
[`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/update) method on the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the `driveId` path
parameter.

The method returns a shared drive as an instance of a `drives` resource.

To issue the request as a domain administrator, set the `useDomainAdminAccess`
query parameter to `true`. For more information, see [Manage shared drives as
domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).

## Hide and unhide a shared drive

To hide a shared drive from the default view, use the
[`hide`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/hide) method on the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the `driveId` parameter.

When a shared drive is hidden, Drive marks the shared drive
resource as `hidden=true`. Hidden shared drives don't appear in the
Drive UI or in the list of returned files.

To restore a shared drive to the default view, use the
[`unhide`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide) method on the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the `driveId` parameter.

Both methods return a shared drive as an instance of a `drives` resource.

## Delete a shared drive

To permanently delete a shared drive, use the
[`delete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete) method on the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource with the `driveId` parameter.

Before deleting a shared drive, all content in the shared drive must be moved to
the trash or deleted. The user must also have `role=organizer` on the shared
drive folder. For more information, see [Trash or delete files and folders](https://developers.google.com/workspace/drive/api/guides/delete).

Pass the following query parameters:

* `useDomainAdminAccess`: Set to `true` to issue the request as a domain
  administrator. For more information, see [Manage shared drives as
  domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators).
* `allowItemDeletion`: Set to `true` to delete items within the shared drive.
  Only supported when `useDomainAdminAccess` is also set to `true`.

## Add or remove shared drive members

Add or remove shared drive members using the
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource.

To add a member, create the permission on the shared drive. Permission methods
can also be used on individual files within a shared drive to grant members
additional privileges or allow non-members to collaborate on specific items.

For more information and sample code, see
[Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

## Manage shared drives as domain administrators

Apply the `useDomainAdminAccess` parameter with the
[`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) and
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resources to manage shared
drives across an organization.

Users calling these methods with `useDomainAdminAccess=true` must have the
`Drive and Docs` [administrator
privilege](https://support.google.com/a/answer/1219251#drive_and_docs).
Administrators can [search for shared
drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives) or update permissions for shared
drives owned by their organization, regardless of the administrator's membership
in any given shared drive.

When using service accounts, you might have to impersonate an authenticated
administrator using [service account
impersonation](https://cloud.google.com/iam/docs/service-account-impersonation).
Note that service accounts *do not* belong to your Google Workspace domain,
unlike user accounts. If you share Google Workspace assets, like documents or
events, with your entire Google Workspace domain, they're not shared with
service accounts. For more information, see [Service accounts
overview](https://cloud.google.com/iam/docs/service-account-overview).

### Recover a shared drive that doesn't have an organizer

The following code sample shows how to recover shared drives that no longer have
an organizer.

### Java

drive/snippets/drive\_v3/src/main/java/RecoverDrive.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/RecoverDrive.java)

```
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.Drive;
import com.google.api.services.drive.model.DriveList;
import com.google.api.services.drive.model.Permission;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/* class to demonstrate use-case of Drive's shared drive without an organizer. */
public class RecoverDrive {

  /**
   * Find all shared drives without an organizer and add one.
   *
   * @param realUser User's email id.
   * @return All shared drives without an organizer.
   * @throws IOException if shared drive not found.
   */
  public static List<Drive> recoverDrives(String realUser)
      throws IOException {
        /*Load pre-authorized user credentials from the environment.
        TODO(developer) - See https://developers.google.com/identity for
        guides on implementing OAuth2 for your application.*/
    GoogleCredentials credentials =
        GoogleCredentials.getApplicationDefault().createScoped(Arrays.asList(DriveScopes.DRIVE));
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    com.google.api.services.drive.Drive service =
        new com.google.api.services.drive.Drive.Builder(new NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            requestInitializer)
            .setApplicationName("Drive samples")
            .build();
    List<Drive> drives = new ArrayList<Drive>();

    // Find all shared drives without an organizer and add one.
    // Note: This example does not capture all cases. Shared drives
    // that have an empty group as the sole organizer, or an
    // organizer outside the organization are not captured. A
    // more exhaustive approach would evaluate each shared drive
    // and the associated permissions and groups to ensure an active
    // organizer is assigned.
    String pageToken = null;
    Permission newOrganizerPermission = new Permission()
        .setType("user")
        .setRole("organizer");

    newOrganizerPermission.setEmailAddress(realUser);


    do {
      DriveList result = service.drives().list()
          .setQ("organizerCount = 0")
          .setFields("nextPageToken, drives(id, name)")
          .setUseDomainAdminAccess(true)
          .setPageToken(pageToken)
          .execute();
      for (Drive drive : result.getDrives()) {
        System.out.printf("Found drive without organizer: %s (%s)\n",
            drive.getName(), drive.getId());
        // Note: For improved efficiency, consider batching
        // permission insert requests
        Permission permissionResult = service.permissions()
            .create(drive.getId(), newOrganizerPermission)
            .setUseDomainAdminAccess(true)
            .setSupportsAllDrives(true)
            .setFields("id")
            .execute();
        System.out.printf("Added organizer permission: %s\n",
            permissionResult.getId());

      }

      drives.addAll(result.getDrives());

      pageToken = result.getNextPageToken();
    } while (pageToken != null);

    return drives;
  }
}
```

### Python

drive/snippets/drive-v3/drive\_snippet/recover\_drives.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/drive_snippet/recover_drives.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def recover_drives(real_user):
  """Find all shared drives without an organizer and add one.
  Args:
      real_user:User ID for the new organizer.
  Returns:
      drives object

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()
  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    drives = []

    # pylint: disable=maybe-no-member
    page_token = None
    new_organizer_permission = {
        "type": "user",
        "role": "organizer",
        "emailAddress": "user@example.com",
    }
    new_organizer_permission["emailAddress"] = real_user

    while True:
      response = (
          service.drives()
          .list(
              q="organizerCount = 0",
              fields="nextPageToken, drives(id, name)",
              useDomainAdminAccess=True,
              pageToken=page_token,
          )
          .execute()
      )
      for drive in response.get("drives", []):
        print(
            "Found shared drive without organizer: "
            f"{drive.get('title')}, {drive.get('id')}"
        )
        permission = (
            service.permissions()
            .create(
                fileId=drive.get("id"),
                body=new_organizer_permission,
                useDomainAdminAccess=True,
                supportsAllDrives=True,
                fields="id",
            )
            .execute()
        )
        print(f'Added organizer permission: {permission.get("id")}')

      drives.extend(response.get("drives", []))
      page_token = response.get("nextPageToken", None)
      if page_token is None:
        break

  except HttpError as error:
    print(f"An error occurred: {error}")

  return drives


if __name__ == "__main__":
  recover_drives(real_user="gduser1@workspacesamples.dev")
```

### Node.js

drive/snippets/drive\_v3/drive\_snippets/recover\_drives.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/drive_snippets/recover_drives.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Finds all shared drives without an organizer and adds one.
 * @param {string} userEmail The email of the user to assign ownership to.
 * @return {Promise<object[]>} A list of the recovered drives.
 */
async function recoverDrives(userEmail) {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // The permission to add to the shared drive.
  const newOrganizerPermission = {
    type: 'user',
    role: 'organizer',
    emailAddress: userEmail, // e.g., 'user@example.com'
  };

  // List all shared drives with no organizers.
  const result = await service.drives.list({
    q: 'organizerCount = 0',
    fields: 'nextPageToken, drives(id, name)',
    useDomainAdminAccess: true,
  });

  // Add the new organizer to each found shared drive.
  for (const drive of result.data.drives ?? []) {
    if (!drive.id) {
      continue;
    }

    console.log('Found shared drive without organizer:', drive.name, drive.id);
    await service.permissions.create({
      requestBody: newOrganizerPermission,
      fileId: drive.id,
      useDomainAdminAccess: true,
      supportsAllDrives: true,
      fields: 'id',
    });
  }
  return result.data.drives ?? [];
}
```

### PHP

drive/snippets/drive\_v3/src/DriveRecoverDrives.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveRecoverDrives.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
use Ramsey\Uuid\Uuid;
function recoverDrives()
{
   try {
    $client = new Client();
    $client->useApplicationDefaultCredentials();
    $client->addScope(Drive::DRIVE);
    $driveService = new Drive($client);

    $realUser = readline("Enter user email address: ");

    $drives = array();
    // Find all shared drives without an organizer and add one.
    // Note: This example does not capture all cases. Shared drives
    // that have an empty group as the sole organizer, or an
    // organizer outside the organization are not captured. A
    // more exhaustive approach would evaluate each shared drive
    // and the associated permissions and groups to ensure an active
    // organizer is assigned.
    $pageToken = null;
    $newOrganizerPermission = new Drive\Permission(array(
        'type' => 'user',
        'role' => 'organizer',
        'emailAddress' => 'user@example.com'
    ));
    $newOrganizerPermission['emailAddress'] = $realUser;
    do {
        $response = $driveService->drives->listDrives(array(
            'q' => 'organizerCount = 0',
            'fields' => 'nextPageToken, drives(id, name)',
            'useDomainAdminAccess' => true,
            'pageToken' => $pageToken
        ));
        foreach ($response->drives as $drive) {
            printf("Found shared drive without organizer: %s (%s)\n",
                $drive->name, $drive->id);
            $permission = $driveService->permissions->create($drive->id,
                $newOrganizerPermission,
                array(
                    'fields' => 'id',
                    'useDomainAdminAccess' => true,
                    'supportsAllDrives' => true
                ));
            printf("Added organizer permission: %s\n", $permission->id);
        }
        array_push($drives, $response->drives);
        $pageToken = $response->pageToken;
    } while ($pageToken != null);
    return $drives;
   } catch(Exception $e) {
      echo "Error Message: ".$e;
   }
}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/RecoverDrives.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/RecoverDrives.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of Drive's shared drive without an organizer.
    public class RecoverDrives
    {
        /// <summary>
        /// Find all shared drives without an organizer and add one.
        /// </summary>
        /// <param name="realUser">User ID for the new organizer.</param>
        /// <returns>all shared drives without an organizer.</returns>
        public static IList<Drive> DriveRecoverDrives(string realUser)
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

                var drives = new List<Drive>();
                // Find all shared drives without an organizer and add one.
                // Note: This example does not capture all cases. Shared drives
                // that have an empty group as the sole organizer, or an
                // organizer outside the organization are not captured. A
                // more exhaustive approach would evaluate each shared drive
                // and the associated permissions and groups to ensure an active
                // organizer is assigned.
                string pageToken = null;
                var newOrganizerPermission = new Permission()
                {
                    Type = "user",
                    Role = "organizer",
                    EmailAddress = realUser
                };

                do
                {
                    var request = service.Drives.List();
                    request.UseDomainAdminAccess = true;
                    request.Q = "organizerCount = 0";
                    request.Fields = "nextPageToken, drives(id, name)";
                    request.PageToken = pageToken;
                    var result = request.Execute();
                    foreach (var drive in result.Drives)
                    {
                        Console.WriteLine(("Found abandoned shared drive: {0} ({1})",
                            drive.Name, drive.Id));
                        // Note: For improved efficiency, consider batching
                        // permission insert requests
                        var permissionRequest = service.Permissions.Create(
                            newOrganizerPermission,
                            drive.Id
                        );
                        permissionRequest.UseDomainAdminAccess = true;
                        permissionRequest.SupportsAllDrives = true;
                        permissionRequest.Fields = "id";
                        var permissionResult = permissionRequest.Execute();
                        Console.WriteLine("Added organizer permission: {0}", permissionResult.Id);
                    }

                    pageToken = result.NextPageToken;
                } while (pageToken != null);

                return drives;
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

## Prevent users from downloading, printing, or copying files

You can limit how users can download, print, and copy files within shared
drives.

To determine whether the user can change organizer-applied download restrictions
of a shared drive, check the [`capabilities.canChangeDownloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.inlinedField_20) boolean field. If
`capabilities.canChangeDownloadRestriction` is set to `true`, download
restrictions can be applied to the shared drive. For more information, see
[Understand file capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities).

The [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource contains a collection of
boolean [`restrictions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.restrictions)
fields used to indicate whether an action can be performed on a shared drive.
Restrictions apply to a shared drive or items inside a shared drive.
Restrictions can be set using the [`drives.update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/update) method.

To apply download restrictions to a shared drive, a shared drive manager can set
the [`restrictions.downloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.inlinedField_30) field of the `drives`
resource using the
[`DownloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestriction) object.
Setting the `restrictedForReaders` boolean field to `true` declares that both
download and copy are restricted for readers. Setting the `restrictedForWriters`
boolean field to `true` declares that both download and copy are restricted for
writers. Note that if the `restrictedForWriters` field is `true`, download and
copy is also restricted for readers. Similarly, setting `restrictedForWriters`
to `true` and `restrictedForReaders` to `false` is equivalent to setting both
`restrictedForWriters` and `restrictedForReaders` to `true`.

### Backward compatibility

With the introduction of the [`DownloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestriction) object, the functionality of the
[`restrictions.copyRequiresWriterPermission`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.inlinedField_25)
boolean field has been updated.

Now, setting `restrictions.copyRequiresWriterPermission` to `true` updates the
`restrictedForReaders` boolean field of the [`DownloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestriction) object to `true` to declare that
both download and copy are restricted for readers.

Setting the `copyRequiresWriterPermission` field to `false` updates both the
`restrictedForWriters` and `restrictedForReaders` fields to `false`. This means
download or copy restriction settings are removed for all users.

**Warning:** You should only use the legacy `copyRequiresWriterPermission` field
*or* the [`DownloadRestriction`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestriction)
object to set download, print, and copy restrictions. The fields are not meant
to be used together as the two field values might conflict.

### Fields that control download, print, and copy features

The following table lists [`drives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives) resource fields
that affect download, print, and copy functionality:

| Field | Description | Version |
| --- | --- | --- |
| `capabilities.canCopy` | Whether the current user can copy files in a shared drive. | v2 & v3 |
| `capabilities.canDownload` | Whether the current user can download files in a shared drive. | v2 & v3 |
| `capabilities.canChangeCopyRequiresWriterPermissionRestriction` | Whether the current user can change the `copyRequiresWriterPermission` restriction of a shared drive. | v2 & v3 |
| `capabilities.canResetDriveRestrictions` | Whether the current user can reset the shared drive restrictions to defaults. | v2 & v3 |
| `capabilities.canChangeDownloadRestriction` | Whether the current user can change the download restriction of a shared drive. | v3 only |
| `restrictions.copyRequiresWriterPermission` | Whether the options to copy, print, or download files inside a shared drive are disabled for readers and commenters. When `true`, it sets the similarly named field to `true` for any file inside this shared drive. | v2 & v3 |
| `restrictions.downloadRestriction` | The download restrictions applied by shared drive managers. | v3 only |

## Folder limits

Shared drives have item and folder depth limits. In addition, storage usage is
managed against the organization's pooled storage rather than an individual
user's personal My Drive storage quota. For more information,
see [Shared drive limits in
Google Drive](https://support.google.com/a/users/answer/7338880).

### Item cap

A shared drive can contain a maximum of 500,000 items, including files,
folders, and shortcuts.

When the limit is reached, the shared drive can no longer accept items. To
resume receiving files, users must permanently delete items from the shared
drive. Note that items in the trash count toward the limit, but
permanently-deleted items don't. For more information, see [Trash or delete
files and folders](https://developers.google.com/workspace/drive/api/guides/delete).

### Folder-depth limit

A folder in a shared drive can't contain more than 100 levels of nested folders.
This means that a child folder cannot be stored under a folder that's more than
99 levels deep. This limitation only applies to child folders.

Attempts to add more than 100 levels of folders returns a
[`teamDriveHierarchyTooDeep`](https://developers.google.com/workspace/drive/api/guides/handle-errors#shared-drive-folder-levels)
HTTP status code response.

**Note:** If you want to determine the folder depth of a resource, you must
manually ascend the folder hierarchy.

## Related topics

* [Shared drives overview](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
* [Implement shared drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)
* [Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
* [File and folder limits in files](https://developers.google.com/workspace/drive/api/guides/folder#folder-limits)
* [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
