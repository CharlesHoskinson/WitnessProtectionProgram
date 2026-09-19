# REST Resource: permissions Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions

Retrieved: 2026-09-19T16:31:24.213029+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Permission](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#METHODS_SUMMARY)

## Resource: Permission

A permission for a file. A permission grants a user, group, domain, or the world access to a file or a folder hierarchy. For more information, see [Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

By default, permission requests only return a subset of fields. Permission `kind`, `ID`, `type`, and `role` are always returned. To retrieve specific fields, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

Some resource methods (such as `permissions.update`) require a `permissionId`. Use the `permissions.list` method to retrieve the ID for a file, folder, or shared drive.

| JSON representation |
| --- |
| ``` {   "id": string,   "displayName": string,   "type": string,   "kind": string,   "permissionDetails": [     {       "permissionType": string,       "inheritedFrom": string,       "role": string,       "inherited": boolean     }   ],   "photoLink": string,   "emailAddress": string,   "role": string,   "allowFileDiscovery": boolean,   "domain": string,   "expirationTime": string,   "teamDrivePermissionDetails": [     {       "teamDrivePermissionType": string,       "inheritedFrom": string,       "role": string,       "inherited": boolean     }   ],   "deleted": boolean,   "view": string,   "pendingOwner": boolean,   "inheritedPermissionsDisabled": boolean } ``` |

| Fields | |
| --- | --- |
| `id` | `string`  Output only. The ID of this permission. This is a unique identifier for the grantee, and is published in the [User resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/User) as `permissionId`. IDs should be treated as opaque values. |
| `displayName` | `string`  Output only. The "pretty" name of the value of the permission. The following is a list of examples for each type of permission:   * `user` - User's full name, as defined for their Google Account, such as "Dana A." * `group` - Name of the Google Group, such as "The Company Administrators." * `domain` - String domain name, such as "cymbalgroup.com." * `anyone` - No `displayName` is present. |
| `type` | `string`  The type of the grantee. Supported values include:   * `user` * `group` * `domain` * `anyone`   When creating a permission, if `type` is `user` or `group`, you must provide an `emailAddress` for the user or group. If `type` is `domain`, you must provide a `domain`. If `type` is `anyone`, no extra information is required. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#permission"`. |
| `permissionDetails[]` | `object`  Output only. Details of whether the permissions on this item are inherited or are directly on this item. |
| `permissionDetails[].permissionType` | `string`  Output only. The permission type for this user. Supported values include:   * `file` * `member` |
| `permissionDetails[].inheritedFrom` | `string`  Output only. The ID of the item from which this permission is inherited. This is only populated for items in shared drives. |
| `permissionDetails[].role` | `string`  Output only. The primary role for this user. Supported values include:   * `owner` * `organizer` * `fileOrganizer` * `writer` * `commenter` * `reader`   For more information, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles). |
| `permissionDetails[].inherited` | `boolean`  Output only. Whether this permission is inherited. This field is always populated. This is an output-only field. |
| `photoLink` | `string`  Output only. A link to the user's profile photo, if available. |
| `emailAddress` | `string`  Output only. The email address of the user or group to which this permission refers. |
| `role` | `string`  The role granted by this permission. Supported values include:   * `owner` * `organizer` * `fileOrganizer` * `writer` * `commenter` * `reader`   For more information, see [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles). |
| `allowFileDiscovery` | `boolean`  Whether the permission allows the file to be discovered through search. This is only applicable for permissions of type `domain` or `anyone`. |
| `domain` | `string`  Output only. The domain to which this permission refers. |
| `expirationTime` | `string`  The time at which this permission will expire ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). Expiration times have the following restrictions:   * They can only be set on user and group permissions. * The time must be in the future. * The time cannot be more than one year in the future. |
| `teamDrivePermissionDetails[] (deprecated)` | `object`  This item is deprecated!  Output only. Deprecated: Output only. Use `permissionDetails` instead. |
| `teamDrivePermissionDetails[] (deprecated).teamDrivePermissionType (deprecated)` | `string`  Deprecated: Output only. Use `permissionDetails/permissionType` instead. |
| `teamDrivePermissionDetails[] (deprecated).inheritedFrom (deprecated)` | `string`  Deprecated: Output only. Use `permissionDetails/inheritedFrom` instead. |
| `teamDrivePermissionDetails[] (deprecated).role (deprecated)` | `string`  Deprecated: Output only. Use `permissionDetails/role` instead. |
| `teamDrivePermissionDetails[] (deprecated).inherited (deprecated)` | `boolean`  Deprecated: Output only. Use `permissionDetails/inherited` instead. |
| `deleted` | `boolean`  Output only. Whether the account associated with this permission has been deleted. This field only pertains to permissions of type `user` or `group`. |
| `view` | `string`  Indicates the view for this permission. Only populated for permissions that belong to a view.  The only supported values are `published` and `metadata`:   * `published`: The permission's role is `publishedReader`. * `metadata`: The item is only visible to the `metadata` view because the item has limited access and the scope has at least read access to the parent. The `metadata` view is only supported on folders.   For more information, see [Views](https://developers.google.com/workspace/drive/api/guides/ref-roles#views). |
| `pendingOwner` | `boolean`  Whether the account associated with this permission is a pending owner. Only populated for permissions of type `user` for files that aren't in a shared drive. |
| `inheritedPermissionsDisabled` | `boolean`  When `true`, only organizers, owners, and users with permissions added directly on the item can access it. |

| Methods | |
| --- | --- |
| `create` | Creates a permission for a file or shared drive. |
| `delete` | Deletes a permission. |
| `get` | Gets a permission by ID. |
| `list` | Lists a file's or shared drive's permissions. |
| `update` | Updates a permission with patch semantics. |
