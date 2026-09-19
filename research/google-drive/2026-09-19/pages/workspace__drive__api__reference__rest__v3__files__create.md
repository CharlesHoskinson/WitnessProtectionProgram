# Method: files.create Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create

Retrieved: 2026-09-19T16:31:09.283193+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#try-it)

Creates a file. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).

This method supports an **/upload** URI and accepts uploaded media with the following characteristics:

* **Maximum file size:** 5,120 GB
* **Accepted Media MIME types:** `*/*`

  (Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information, see [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types).)

For more information on uploading files, see [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

Apps creating shortcuts with the `create` method must specify the MIME type `application/vnd.google-apps.shortcut`.

Apps should specify a file extension in the `name` property when inserting files with the API. For example, an operation to insert a JPEG file should specify something like `"name": "cat.jpg"` in the metadata.

Subsequent `GET` requests include the read-only `fileExtension` property populated with the extension originally specified in the `name` property. When a Google Drive user requests to download a file, or when the file is downloaded through the sync client, Drive builds a full filename (with extension) based on the name. In cases where the extension is missing, Drive attempts to determine the extension based on the file's MIME type.

### HTTP request

* Upload URI, for media upload requests:  
  `POST https://www.googleapis.com/upload/drive/v3/files`
* Metadata URI, for metadata-only requests:  
  `POST https://www.googleapis.com/drive/v3/files`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `enforceSingleParent (deprecated)` | `boolean`  Deprecated: Creating files in multiple folders is no longer supported. |
| `ignoreDefaultVisibility` | `boolean`  Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders. |
| `keepRevisionForever` | `boolean`  Whether to set the `keepForever` field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions. |
| `ocrLanguage` | `string`  A language hint for OCR processing during image import (ISO 639-1 code). |
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

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
