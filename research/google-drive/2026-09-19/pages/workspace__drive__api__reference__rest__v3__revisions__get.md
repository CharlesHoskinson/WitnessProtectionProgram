# Method: revisions.get Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get

Retrieved: 2026-09-19T16:31:37.436736+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get#try-it)

Gets a revision's metadata or content by ID. For more information, see [Manage file revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/revisions/{revisionId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file. |
| `revisionId` | `string`  The ID of the revision. |

### Query parameters

| Parameters | |
| --- | --- |
| `acknowledgeAbuse` | `boolean`  Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when the `alt` parameter is set to `media` and the user is the owner of the file or an organizer of the shared drive in which the file resides. |

### Request body

The request body must be empty.

### Response body

If successful, the response body contains an instance of `Revision`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.photos.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
