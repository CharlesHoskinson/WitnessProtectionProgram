# Method: revisions.delete Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete

Retrieved: 2026-09-19T16:31:36.593811+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/delete#try-it)

Permanently deletes a file version. You can only delete revisions for files with binary content in Google Drive, like images or videos. Revisions for other files, like Google Docs or Sheets, and the last remaining file version can't be deleted. For more information, see [Manage file revisions](https://developers.google.com/drive/api/guides/manage-revisions).

### HTTP request

`DELETE https://www.googleapis.com/drive/v3/files/{fileId}/revisions/{revisionId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |
| `revisionId` | `string`  The ID of the revision. |

### Request body

The request body must be empty.

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
