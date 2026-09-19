# Method: files.export Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export

Retrieved: 2026-09-19T16:31:13.040632+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export#try-it)

Exports a Google Workspace document to the requested MIME type and returns exported byte content. For more information, see [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

Note that the exported content is limited to 10 MB.

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/export`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |

### Query parameters

| Parameters | |
| --- | --- |
| `mimeType` | `string`  Required. The MIME type of the format requested for this export. For a list of supported MIME types, see [Export MIME types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats). |

### Request body

The request body must be empty.

### Response body

If successful, this method returns the file content as bytes.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
