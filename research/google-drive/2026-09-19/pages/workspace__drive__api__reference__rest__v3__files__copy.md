# Method: files.copy Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy

Retrieved: 2026-09-19T16:31:08.444937+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#try-it)

Creates a copy of a file and applies any requested updates with patch semantics. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).

### HTTP request

`POST https://www.googleapis.com/drive/v3/files/{fileId}/copy`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |

### Query parameters

| Parameters | |
| --- | --- |
| `enforceSingleParent (deprecated)` | `boolean`  Deprecated: Copying files into multiple folders is no longer supported. Use shortcuts instead. |
| `ignoreDefaultVisibility` | `boolean`  Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders. |
| `keepRevisionForever` | `boolean`  Whether to set the `keepForever` field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions. |
| `ocrLanguage` | `string`  A language hint for OCR processing during image import (ISO 639-1 code). |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `includePermissionsForView` | `string`  Specifies which additional view's permissions to include in the response. Only `published` is supported. |
| `includeLabels` | `string`  A comma-separated list of IDs of labels to include in the `labelInfo` part of the response. |
| `copyComments` | `boolean`  Whether to copy the open (unresolved) comments associated with the file. |

### Request body

The request body contains an instance of `File`.

### Response body

If successful, the response body contains an instance of `File`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.photos.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
