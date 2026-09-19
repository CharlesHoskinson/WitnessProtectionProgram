# Method: changes.getStartPageToken Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken

Retrieved: 2026-09-19T16:30:49.535590+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.StartPageToken.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken#try-it)

Gets the starting pageToken for listing future changes. For more information, see [Retrieve changes](https://developers.google.com/workspace/drive/api/guides/manage-changes).

### HTTP request

`GET https://www.googleapis.com/drive/v3/changes/startPageToken`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `driveId` | `string`  The ID of the shared drive for which the starting pageToken for listing future changes from that shared drive will be returned. |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `teamDriveId (deprecated)` | `string`  Deprecated: Use `driveId` instead. |

### Request body

The request body must be empty.

### Response body

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "startPageToken": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `startPageToken` | `string`  The starting page token for listing future changes. The page token doesn't expire. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#startPageToken"`. |

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
