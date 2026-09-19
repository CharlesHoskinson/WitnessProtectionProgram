# Method: approvals.cancel Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel

Retrieved: 2026-09-19T16:30:39.498320+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.request_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.request_body.SCHEMA_REPRESENTATION)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel#try-it)

Cancels an approval. For more information, see [Manage approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

Updates the approval `Status` to `CANCELLED`. This can be called by any user with the `writer` permission on the file while the approval `Status` is `IN_PROGRESS`.

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/approvals/{approvalId}:cancel`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the file that the approval is on. |
| `approvalId` | `string`  Required. The ID of the approval to cancel. |

### Request body

The request body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "message": string } ``` |

| Fields | |
| --- | --- |
| `message` | `string`  Optional. A message to accompany the cancellation of the approval. This message is included in notifications for the action and in the approval activity log. |

### Response body

If successful, the response body contains an instance of `Approval`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
