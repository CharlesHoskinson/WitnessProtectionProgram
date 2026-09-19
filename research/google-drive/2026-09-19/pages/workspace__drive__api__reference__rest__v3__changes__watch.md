# Method: changes.watch Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch

Retrieved: 2026-09-19T16:30:51.917796+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch#body.aspect)

Subscribes to changes for a user. For more information, see [Notifications for resource changes](https://developers.google.com/workspace/drive/api/guides/push).

### HTTP request

`POST https://www.googleapis.com/drive/v3/changes/watch`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `driveId` | `string`  The shared drive from which changes will be returned. If specified the change IDs will be reflective of the shared drive; use the combined drive ID and change ID as an identifier. |
| `includeCorpusRemovals` | `boolean`  Whether changes should include the file resource if the file is still accessible by the user at the time of the request, even when a file was removed from the list of changes and there will be no further change entries for this file. |
| `includeItemsFromAllDrives` | `boolean`  Whether both My Drive and shared drive items should be included in results. |
| `includeRemoved` | `boolean`  Whether to include changes indicating that items have been removed from the list of changes, for example by deletion or loss of access. |
| `includeTeamDriveItems (deprecated)` | `boolean`  Deprecated: Use `includeItemsFromAllDrives` instead. |
| `pageSize` | `integer`  The maximum number of changes to return. The service may return fewer than this value.  If unspecified, at most 100 changes will be returned.  The maximum value is 1000; values above 1000 will be coerced to 1000. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response or to the response from the getStartPageToken method. |
| `restrictToMyDrive` | `boolean`  Whether to restrict the results to changes inside the My Drive hierarchy. This omits changes to files such as those in the Application Data folder or shared files which have not been added to My Drive. |
| `spaces` | `string`  A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'. |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `teamDriveId (deprecated)` | `string`  Deprecated: Use `driveId` instead. |
| `includePermissionsForView` | `string`  Specifies which additional view's permissions to include in the response. Only 'published' is supported. |
| `includeLabels` | `string`  A comma-separated list of IDs of labels to include in the `labelInfo` part of the response. |

### Request body

The request body contains an instance of `Channel`.

### Response body

If successful, the response body contains an instance of `Channel`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.photos.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
