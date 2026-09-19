# Method: permissions.delete Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete

Retrieved: 2026-09-19T16:31:26.198208+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete#try-it)

Deletes a permission. For more information, see [Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

**Warning:** Concurrent permission modifications (such as update or delete) on the same file, folder, or shared drive aren't supported across any users or clients; only the last update is applied.

### HTTP request

`DELETE https://www.googleapis.com/drive/v3/files/{fileId}/permissions/{permissionId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file or shared drive. |
| `permissionId` | `string`  The ID of the permission. |

### Query parameters

| Parameters | |
| --- | --- |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `useDomainAdminAccess` | `boolean`  Issue the request as a domain administrator.  If set to `true`, and if the following additional conditions are met, the requester is granted access:   1. The file ID parameter refers to a shared drive. 2. The requester is an administrator of the domain to which the shared drive belongs.   For more information, see [Manage shared drives as domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators). |
| `enforceExpansiveAccess (deprecated)` | `boolean`  Deprecated: All requests use the expansive access rules. |

### Request body

The request body must be empty.

### Response body

If successful, the response body is an empty JSON object.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
