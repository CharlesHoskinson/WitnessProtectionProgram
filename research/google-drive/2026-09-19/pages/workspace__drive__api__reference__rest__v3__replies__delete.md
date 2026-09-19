# Method: replies.delete Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete

Retrieved: 2026-09-19T16:31:31.790040+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies/delete#try-it)

Deletes a reply. For more information, see [Manage comments and replies](https://developers.google.com/workspace/drive/api/guides/manage-comments).

### HTTP request

`DELETE https://www.googleapis.com/drive/v3/files/{fileId}/comments/{commentId}/replies/{replyId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |
| `commentId` | `string`  The ID of the comment. |
| `replyId` | `string`  The ID of the reply. |

### Request body

The request body must be empty.

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
