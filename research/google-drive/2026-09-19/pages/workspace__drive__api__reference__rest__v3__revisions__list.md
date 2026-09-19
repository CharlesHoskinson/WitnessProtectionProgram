# Method: revisions.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list

Retrieved: 2026-09-19T16:31:38.213369+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.RevisionList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list#try-it)

Lists a file's revisions. For more information, see [Manage file revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions).

**Important:** The list of revisions returned by this method might be incomplete for files with a large revision history, including frequently edited Google Docs, Sheets, and Slides. Older revisions might be omitted from the response, meaning the first revision returned may not be the oldest existing revision. The revision history visible in the Workspace editor user interface might be more complete than the list returned by the API.

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/revisions`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |

### Query parameters

| Parameters | |
| --- | --- |
| `pageSize` | `integer`  The maximum number of revisions to return. The service may return fewer than this value.  If unspecified, at most 200 revisions will be returned.  The maximum value is 1000; values above 1000 will be coerced to 1000. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response. |

### Request body

The request body must be empty.

### Response body

A list of revisions of a file.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "revisions": [     {       object (Revision)     }   ],   "nextPageToken": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `revisions[]` | `object (Revision)`  The list of revisions. If nextPageToken is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `nextPageToken` | `string`  The page token for the next page of revisions. This will be absent if the end of the revisions list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#revisionList"`. |

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
