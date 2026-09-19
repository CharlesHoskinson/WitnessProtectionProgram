# Implement shared drive support Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/enable-shareddrives

Retrieved: 2026-09-19T16:30:13.308487+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document describes how to implement shared drive support in your app using
the Google Drive API.

Shared drives follow different organization, sharing, and ownership models from
My Drive. If your app is going to create and manage files on
shared drives, you must implement shared drive support in your app. The
complexity of your implementation depends on the functionality of your app.

To begin, you must include the `supportsAllDrives=true` query parameter in your
requests when your app performs the following operations:

### Drive API v3

* `files.get`
* `files.list`
* `files.create`
* `files.update`
* `files.copy`
* `files.delete`
* `changes.list`
* `changes.getStartPageToken`
* `permissions.list`
* `permissions.get`
* `permissions.create`
* `permissions.update`
* `permissions.delete`

### Drive API v2

* `files.get`
* `files.list`
* `files.insert`
* `files.update`
* `files.patch`
* `files.copy`
* `files.trash`
* `files.untrash`
* `files.delete`
* `files.touch`
* `children.insert`
* `parents.insert`
* `changes.list`
* `changes.getStartPageToken`
* `changes.get`
* `permissions.list`
* `permissions.get`
* `permissions.insert`
* `permissions.update`
* `permissions.patch`
* `permissions.delete`

The `supportsAllDrives=true` parameter informs Google Drive that your app is
designed to handle files on shared drives.

Apps that read or modify permissions, track changes, or search across multiple
corpora require additional shared drive capabilities. The remainder of this
document highlights additional changes required to perform these tasks.

## Search for content on a shared drive

Use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource to find user files in shared drives. To
search for a shared drive, see [Search for shared
drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives).

The `list` method contains the following shared drive-specific query parameters:

* `driveId`: ID of the shared drive to search.
* `corpora`: Bodies of items (files or documents) to which the query applies.
  Supported bodies are `user`, `domain`, `drive`, and `allDrives`. Prefer
  `user` or `drive` to `allDrives` for efficiency. By default, corpora is set
  to `user`.
* `includeItemsFromAllDrives`: Whether both My Drive and shared
  drive items should be included in results. If not present or set to false,
  then shared drive items are not returned.
* `supportsAllDrives`: Whether the requesting application supports both My
  Drive and shared drive. If false, shared drive items are not
  included in the response.

The following query modes are specific to shared drives:

| `includeItemsFromAllDrives` | `corpora` | Query description |
| --- | --- | --- |
| `true` | `user` | Queries files that the user has accessed, including both shared drive and My Drive files. |
| `true` | `domain` | Queries files that are shared to the domain, including both shared drive and My Drive files. |
| `true` | `drive` | Queries all items in the specified shared drive. The `driveId` must be specified in the request. |
| `true` | `allDrives` | Queries files that the user has accessed and all shared drives in which they're a member. Note that the response might include `incompleteSearch:true`, indicating that some corpora were not searched for this request. |

The following code samples show how to search files on all shared drives as well as My Drive:

### Python

```
files = []
page_token = None
while True:
    response = drive_service.files().list(
        q="mimeType='application/vnd.google-apps.folder'",
        spaces='drive',
        corpora='allDrives',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        fields='nextPageToken, files(id, name)',
        pageToken=page_token
    ).execute()
    files.extend(response.get('files', []))
    page_token = response.get('nextPageToken', None)
    if not page_token:
        break
```

### Node.js

```
let files = [];
let pageToken = null;
do {
  const response = await drive_service.files.list({
    q: "mimeType='application/vnd.google-apps.folder'",
    spaces: 'drive',
    corpora: 'allDrives',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'nextPageToken, files(id, name)',
    pageToken: pageToken
  });
  files = files.concat(response.data.files);
  pageToken = response.data.nextPageToken;
} while (pageToken);
```

### Java

```
List<File> files = new ArrayList<>();
String pageToken = null;
do {
  FileList result = driveService.files().list()
      .setQ("mimeType='application/vnd.google-apps.folder'")
      .setSpaces("drive")
      .setCorpora("allDrives")
      .setSupportsAllDrives(true)
      .setIncludeItemsFromAllDrives(true)
      .setFields("nextPageToken, files(id, name)")
      .setPageToken(pageToken)
      .execute();
  files.addAll(result.getFiles());
  pageToken = result.getNextPageToken();
} while (pageToken != null);
```

### curl

```
curl -X GET \
  'https://www.googleapis.com/drive/v3/files?corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=nextPageToken%2Cfiles(id%2Cname)' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Accept: application/json'
```

Replace ACCESS\_TOKEN with your app's [OAuth
2.0](https://developers.google.com/identity/protocols/oauth2) token.

## Track changes on a shared drive

Use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list) method on the [`changes`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes) resource to track changes on a shared drive. For
more information, see [Track changes for users and shared
drives](https://developers.google.com/workspace/drive/api/guides/about-changes).

The `list` method contains the following shared drive-specific query parameters:

* `driveId`: The shared drive from which changes are returned. If specified,
  the change IDs refer to changes to items within the shared drive providing
  the current state of a file. To refer to a specific shared drive change,
  both the shared drive ID and change ID must be used as an identifier.
* `includeItemsFromAllDrives`: Whether shared drive files or changes should be
  included in the list of changes.
* `supportsAllDrives`: Whether the requesting application supports shared
  drives. If false, then shared drive items, including both shared drives and
  files within a shared drive, aren't returned.

The following query modes are specific to shared drives:

| `includeItemsFromAllDrives` | `driveId` | Query description |
| --- | --- | --- |
| `true` | No | Changes are reflective of changes to files inside or outside of shared drives that the user has accessed, as well as changes to shared drives in which the user is a member. |
| `true` | Yes | Changes are reflective of changes to the particular shared drive that was specified and items inside that shared drive. |

**Note:** If you're using the older Drive API v2, the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v2/changes/get) and
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v2/changes/list) methods have several parameters
specific to shared drives.

The following code samples show how to track changes on a shared drive:

### Python

```
# 1. Get the start page token for the shared drive.
response = drive_service.changes().getStartPageToken(
    supportsAllDrives=True,
    driveId='SHARED_DRIVE_ID'
).execute()
start_page_token = response.get('startPageToken')

# 2. List changes starting from the page token.
response = drive_service.changes().list(
    pageToken=start_page_token,
    supportsAllDrives=True,
    includeItemsFromAllDrives=True,
    driveId='SHARED_DRIVE_ID'
).execute()
changes = response.get('changes', [])
```

### Node.js

```
// 1. Get the start page token for the shared drive.
const tokenResponse = await drive_service.changes.getStartPageToken({
  supportsAllDrives: true,
  driveId: 'SHARED_DRIVE_ID'
});
const startPageToken = tokenResponse.data.startPageToken;

// 2. List changes starting from the page token.
const response = await drive_service.changes.list({
  pageToken: startPageToken,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  driveId: 'SHARED_DRIVE_ID'
});
const changes = response.data.changes;
```

### Java

```
// 1. Get the start page token for the shared drive.
StartPageToken tokenResult = driveService.changes().getStartPageToken()
    .setSupportsAllDrives(true)
    .setDriveId("SHARED_DRIVE_ID")
    .execute();
String startPageToken = tokenResult.getStartPageToken();

// 2. List changes starting from the page token.
ChangeList changesResult = driveService.changes().list(startPageToken)
    .setSupportsAllDrives(true)
    .setIncludeItemsFromAllDrives(true)
    .setDriveId("SHARED_DRIVE_ID")
    .execute();
List<Change> changes = changesResult.getChanges();
```

### curl

```
# 1. Get the start page token for the shared drive.
curl -X GET \
  'https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true&driveId=SHARED_DRIVE_ID' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Accept: application/json'

# 2. List changes starting from the page token.
curl -X GET \
  'https://www.googleapis.com/drive/v3/changes?pageToken=START_PAGE_TOKEN&supportsAllDrives=true&includeItemsFromAllDrives=true&driveId=SHARED_DRIVE_ID' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Accept: application/json'
```

Replace the following:

* SHARED\_DRIVE\_ID: The ID of the shared drive.
* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.
* START\_PAGE\_TOKEN: The start page token for the shared
  drive.

Replace SHARED\_DRIVE\_ID with the ID of the shared drive

## Enable shared drive support in the Drive UI

To access shared drive content using the Drive UI, make sure you
have checked the
**Shared drives support** box on the **Drive UI integration** tab
of the Google Drive API in the
[Google Cloud console](https://console.cloud.google.com/apis/dashboard). For more
information, see [Configure a Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk).

## Use the Google Picker with shared drives

The [Google Picker](https://developers.google.com/workspace/drive/api/guides/picker) supports selecting items in shared
drives. For details about enabling shared drive support and adding shared drives
views in the picker, see the [Google Picker API](https://developers.google.com/drive/picker/reference/picker).

## Related topics

* [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives)
* [Overview of the Google Picker](https://developers.google.com/workspace/drive/picker/guides/overview)
