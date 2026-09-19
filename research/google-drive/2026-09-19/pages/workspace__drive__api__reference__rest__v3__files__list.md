# Method: files.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list

Retrieved: 2026-09-19T16:31:17.131671+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.FileList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.aspect)
* [Corpus](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#Corpus)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#try-it)

Lists the user's files. For more information, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files).

This method accepts the `q` parameter, which is a search query combining one or more search terms.

This method returns *all* files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.

### HTTP request

`GET https://www.googleapis.com/drive/v3/files`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `corpora` | `string`  Specifies a collection of items (files or documents) to which the query applies. Supported items include:   * `user` * `domain` * `drive` * `allDrives`   Prefer `user` or `drive` to `allDrives` for efficiency. By default, corpora is set to `user`. However, this can change depending on the filter set through the `q` parameter. For more information, see [File organization](https://developers.google.com/workspace/drive/api/guides/about-files#file-organization). |
| `corpus (deprecated)` | `enum (Corpus)`  Deprecated: The source of files to list. Use `corpora` instead. |
| `driveId` | `string`  ID of the shared drive to search. |
| `includeItemsFromAllDrives` | `boolean`  Whether both My Drive and shared drive items should be included in results. |
| `includeTeamDriveItems (deprecated)` | `boolean`  Deprecated: Use `includeItemsFromAllDrives` instead. |
| `orderBy` | `string`  A comma-separated list of sort keys. Valid keys are:   * `createdTime`: When the file was created. Avoid using this key for queries on large item collections as it might result in timeouts or other issues. For time-related sorting on large item collections, use `modifiedTime desc` instead. * `folder`: The folder ID. This field is sorted using alphabetical ordering. * `modifiedByMeTime`: The last time the file was modified by the user. * `modifiedTime`: The last time the file was modified by anyone. * `name`: The name of the file. This field is sorted using alphabetical ordering, so 1, 12, 2, 22. * `name_natural`: The name of the file. This field is sorted using natural sort ordering, so 1, 2, 12, 22. * `quotaBytesUsed`: The number of storage quota bytes used by the file. * `recency`: The most recent timestamp from the file's date-time fields. * `sharedWithMeTime`: When the file was shared with the user, if applicable. * `starred`: Whether the user has starred the file. * `viewedByMeTime`: The last time the file was viewed by the user.   Each key sorts ascending by default, but can be reversed with the `desc` modifier. Example usage: `?orderBy=folder,modifiedTime desc,name`. |
| `pageSize` | `integer`  The maximum number of files to return. The service may return fewer than this value.  If unspecified, at most 100 files will be returned for shared drives, and the entire list of files for non-shared drives.  The maximum value is 1000; values above 1000 will be coerced to 1000. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of `nextPageToken` from the previous response. |
| `q` | `string`  A query for filtering the file results. For supported syntax, see [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files). |
| `spaces` | `string`  A comma-separated list of spaces to query within the corpora. Supported values are `drive` and `appDataFolder`. For more information, see [File organization](https://developers.google.com/workspace/drive/api/guides/about-files#file-organization). |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `teamDriveId (deprecated)` | `string`  Deprecated: Use `driveId` instead. |
| `includePermissionsForView` | `string`  Specifies which additional view's permissions to include in the response. Only `published` is supported. |
| `includeLabels` | `string`  A comma-separated list of IDs of labels to include in the `labelInfo` part of the response. |

### Request body

The request body must be empty.

### Response body

A list of files.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "files": [     {       object (File)     }   ],   "nextPageToken": string,   "kind": string,   "incompleteSearch": boolean } ``` |

| Fields | |
| --- | --- |
| `files[]` | `object (File)`  The list of files. If `nextPageToken` is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `nextPageToken` | `string`  The page token for the next page of files. This will be absent if the end of the files list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#fileList"`. |
| `incompleteSearch` | `boolean`  Whether the search process was incomplete. If true, then some search results might be missing, since all documents were not searched. This can occur when searching multiple drives with the `allDrives` corpora, but all corpora couldn't be searched. When this happens, it's suggested that clients narrow their query by choosing a different corpus such as `user` or `drive`. |

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

## Corpus

| Enums | |
| --- | --- |
| `user` | Files owned by or shared to the user. |
| `domain` | Files shared to the user's domain. |
