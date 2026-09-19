# Method: permissions.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list

Retrieved: 2026-09-19T16:31:28.103550+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.PermissionList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list#try-it)

Lists a file's or shared drive's permissions. For more information, see [Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/permissions`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file or shared drive. |

### Query parameters

| Parameters | |
| --- | --- |
| `pageSize` | `integer`  The maximum number of permissions to return. The service may return fewer than this value.  If unspecified, at most 100 permissions will be returned for shared drives, and the entire list of permissions for non-shared drives.  The maximum value is 100; values above 100 will be coerced to 100. |
| `pageToken` | `string`  The token for continuing a previous list request on the next page. This should be set to the value of `nextPageToken` from the previous response. |
| `supportsAllDrives` | `boolean`  Whether the requesting application supports both My Drives and shared drives. |
| `supportsTeamDrives (deprecated)` | `boolean`  Deprecated: Use `supportsAllDrives` instead. |
| `useDomainAdminAccess` | `boolean`  Issue the request as a domain administrator.  If set to `true`, and if the following additional conditions are met, the requester is granted access:   1. The file ID parameter refers to a shared drive. 2. The requester is an administrator of the domain to which the shared drive belongs.   For more information, see [Manage shared drives as domain administrators](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#manage-administrators). |
| `includePermissionsForView` | `string`  Specifies which additional view's permissions to include in the response. Only `published` is supported. |

### Request body

The request body must be empty.

### Response body

A list of permissions for a file.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "permissions": [     {       object (Permission)     }   ],   "nextPageToken": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `permissions[]` | `object (Permission)`  The list of permissions. If `nextPageToken` is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `nextPageToken` | `string`  The page token for the next page of permissions. This field will be absent if the end of the permissions list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#permissionList"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.meet.readonly`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.photos.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
