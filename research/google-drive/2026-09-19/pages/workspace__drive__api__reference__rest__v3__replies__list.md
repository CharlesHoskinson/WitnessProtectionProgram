# Method: replies.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list

Retrieved: 2026-09-19T16:31:34.046030+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.ReplyList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/list#try-it)

Lists a comment's replies. For more information, see [Manage comments and replies](https://developers.google.com/workspace/drive/api/guides/manage-comments).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/comments/{commentId}/replies`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |
| `commentId` | `string`  The ID of the comment. |

### Query parameters

| Parameters | |
| --- | --- |
| `includeDeleted` | `boolean`  Whether to include deleted replies. Deleted replies don't include their original content. |
| `pageSize` | `integer`  The maximum number of replies to return. The service may return fewer than this value.  If unspecified, at most 20 replies will be returned.  The maximum value is 100; values above 100 will be coerced to 100. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of `nextPageToken` from the previous response. |

### Request body

The request body must be empty.

### Response body

A list of replies to a comment on a file.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "replies": [     {       object (Reply)     }   ],   "kind": string,   "nextPageToken": string } ``` |

| Fields | |
| --- | --- |
| `replies[]` | `object (Reply)`  The list of replies. If `nextPageToken` is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#replyList"`. |
| `nextPageToken` | `string`  The page token for the next page of replies. This will be absent if the end of the replies list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
