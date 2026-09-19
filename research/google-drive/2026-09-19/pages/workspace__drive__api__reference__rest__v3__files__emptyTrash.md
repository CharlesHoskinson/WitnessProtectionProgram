# Method: files.emptyTrash Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash

Retrieved: 2026-09-19T16:31:11.968773+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#try-it)

Permanently deletes all of the user's trashed files. For more information, see [files.trash or delete files and folders](https://developers.google.com/workspace/drive/api/guides/delete).

### HTTP request

`DELETE https://www.googleapis.com/drive/v3/files/trash`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `enforceSingleParent (deprecated)` | `boolean`  Deprecated: If an item isn't in a shared drive and its last parent is deleted but the item itself isn't, the item will be placed under its owner's root. |
| `driveId` | `string`  If set, empties the trash of the provided shared drive. |

### Request body

The request body must be empty.

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires the following OAuth scope:

* `https://www.googleapis.com/auth/drive`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
