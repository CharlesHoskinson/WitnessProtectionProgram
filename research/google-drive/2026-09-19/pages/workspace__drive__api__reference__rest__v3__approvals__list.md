# Method: approvals.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list

Retrieved: 2026-09-19T16:30:42.642438+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.ApprovalList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list#try-it)

Lists the approvals on a file. For more information, see [Manage approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

By default, this method returns a minimal response that may not include the `items` array. To retrieve approval details, you must explicitly specify the fields you want using the `fields` query parameter. To return the exact fields you need, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/approvals`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the file that the approval is on. |

### Query parameters

| Parameters | |
| --- | --- |
| `pageSize` | `integer`  The maximum number of approvals to return. When not set, at most 100 approvals are returned. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of `nextPageToken` from a previous response. |

### Request body

The request body must be empty.

### Response body

The response of an approvals list request.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "kind": string,   "items": [     {       object (Approval)     }   ],   "nextPageToken": string } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  This is always drive#approvalList |
| `items[]` | `object (Approval)`  The list of approvals. If `nextPageToken` is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `nextPageToken` | `string`  The page token for the next page of approvals. This is absent if the end of the approvals list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
