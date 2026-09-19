# Method: drives.delete Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete

Retrieved: 2026-09-19T16:31:02.628565+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/delete#try-it)

Permanently deletes a shared drive for which the user is an `organizer`. The shared drive cannot contain any untrashed items. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).

### HTTP request

`DELETE https://www.googleapis.com/drive/v3/drives/{driveId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `driveId` | `string`  The ID of the shared drive. |

### Query parameters

| Parameters | |
| --- | --- |
| `useDomainAdminAccess` | `boolean`  Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs. |
| `allowItemDeletion` | `boolean`  Whether any items inside the shared drive should also be deleted. This option is only supported when `useDomainAdminAccess` is also set to `true`. |

### Request body

The request body must be empty.

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires the following OAuth scope:

* `https://www.googleapis.com/auth/drive`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
