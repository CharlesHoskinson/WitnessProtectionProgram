# Method: files.update Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update

Retrieved: 2026-09-19T16:31:20.596125+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#try-it)

Updates a file's metadata, content, or both.

When calling this method, only populate fields in the request that you want to modify. When updating fields, some fields might be changed automatically, such as `modifiedDate`. This method supports patch semantics.

This method supports an **/upload** URI and accepts uploaded media with the following characteristics:

* **Maximum file size:** 5,120 GB
* **Accepted Media MIME types:** `*/*`

  (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information, see [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types).)

For more information on uploading files, see [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

### HTTP request

* Upload URI, for media upload requests:  
  `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}`
* Metadata URI, for metadata-only requests:  
  `PATCH https://www.googleapis.com/drive/v3/files/{fileId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |

### Query parameters

| Parameters | |
| --- | --- |
| `addParents` | `string`  A comma-separated list of parent IDs to add. |
| `enforceSingleParent (deprecated)` | `boolean`  Deprecated: Adding files to multiple folders is no longer supported. Use shortcuts instead. |
| `keepRevisionForever` | `boolean`  Whether to set the `keepForever` field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions. |
| `ocrLanguage` | `string`  A language hint for OCR processing during image import (ISO 639-1 code). |
| `removeParents` | `string`  A comma-separated list of parent IDs to remove. |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `uploadType` | `string`  The type of upload request to the `/upload` URI. If you are uploading data with an `/upload` URI, this field is required. If you are creating a metadata-only file, this field isn't required. Additionally, this field isn't shown in the "Try this method" widget because the widget doesn't support data uploads.  Acceptable values are:   * `media` - [Simple upload](https://developers.google.com/drive/api/guides/manage-uploads#simple). Upload the media only, without any metadata. * `multipart` - [Multipart upload](https://developers.google.com/drive/api/guides/manage-uploads#multipart). Upload both the media and its metadata, in a single request. * `resumable` - [Resumable upload](https://developers.google.com/drive/api/guides/manage-uploads#resumable). Upload the file in a resumable fashion, using a series of at least two requests where the first request includes the metadata. |
| `useContentAsIndexableText` | `boolean`  Whether to use the uploaded content as indexable text. |
| `includePermissionsForView` | `string`  Specifies which additional view's permissions to include in the response. Only `published` is supported. |
| `includeLabels` | `string`  A comma-separated list of IDs of labels to include in the `labelInfo` part of the response. |

### Request body

The request body contains an instance of `File`.

### Response body

If successful, the response body contains an instance of `File`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.scripts`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
