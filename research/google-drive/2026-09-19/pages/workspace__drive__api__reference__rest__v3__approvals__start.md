# Method: approvals.start Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start

Retrieved: 2026-09-19T16:30:44.674530+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.request_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.request_body.SCHEMA_REPRESENTATION)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start#try-it)

Starts an approval on a file. For more information, see [Manage approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/approvals:start`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the file that the approval is created on. |

### Request body

The request body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "reviewerEmails": [     string   ],   "dueTime": string,   "lockFile": boolean,   "message": string,   "fileContentChangeBehavior": enum (FileContentChangeBehavior) } ``` |

| Fields | |
| --- | --- |
| `reviewerEmails[]` | `string`  Required. The emails of the users who are set to review the approval. |
| `dueTime` | `string (Timestamp format)`  Optional. The time that the approval is due.  Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: `"2014-10-02T15:01:23Z"`, `"2014-10-02T15:01:23.045123456Z"` or `"2014-10-02T15:01:23+05:30"`. |
| `lockFile` | `boolean`  Optional. Whether to lock the file when starting the approval. |
| `message` | `string`  Optional. A message to send to reviewers when notifying them of the approval request. |
| `fileContentChangeBehavior` | `enum (FileContentChangeBehavior)`  Optional. The behavior of the approval when the file content changes. |

### Response body

If successful, the response body contains an instance of `Approval`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
