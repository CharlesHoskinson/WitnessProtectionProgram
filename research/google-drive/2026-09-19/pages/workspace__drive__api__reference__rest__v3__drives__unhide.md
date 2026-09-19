# Method: drives.unhide Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide

Retrieved: 2026-09-19T16:31:06.561884+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide#try-it)

Restores a shared drive to the default view. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).

### HTTP request

`POST https://www.googleapis.com/drive/v3/drives/{driveId}/unhide`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `driveId` | `string`  The ID of the shared drive. |

### Request body

The request body must be empty.

### Response body

If successful, the response body contains an instance of `Drive`.

### Authorization scopes

Requires the following OAuth scope:

* `https://www.googleapis.com/auth/drive`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
