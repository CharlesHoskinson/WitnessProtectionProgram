# Method: files.listLabels Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels

Retrieved: 2026-09-19T16:31:18.320199+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.LabelList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/listLabels#try-it)

Lists the labels on a file. For more information, see [List labels on a file](https://developers.google.com/workspace/drive/api/guides/list-labels).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/listLabels`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID for the file. |

### Query parameters

| Parameters | |
| --- | --- |
| `maxResults` | `integer`  The maximum number of labels to return per page. When not set, defaults to 100. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of `nextPageToken` from the previous response. |

### Request body

The request body must be empty.

### Response body

A list of labels applied to a file.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "labels": [     {       object (Label)     }   ],   "nextPageToken": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `labels[]` | `object (Label)`  The list of labels. |
| `nextPageToken` | `string`  The page token for the next page of labels. This field will be absent if the end of the list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |
| `kind` | `string`  This is always `"drive#labelList"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
