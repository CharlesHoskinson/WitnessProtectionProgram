# Shared drive versus My Drive API differences Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs

Retrieved: 2026-09-19T16:31:47.224155+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Shared drives follow different organization, sharing, and ownership models from
a My Drive. As such, some My Drive operations
aren't permitted for content in a shared drive.

This guide outlines shared drive-specific API differences in the `files` and
`changes` resources.

## File resource

The following fields in the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource are
only populated for files located within a shared drive:

* `hasAugmentedPermissions`: Whether any users are granted file access
  directly on this file.
* `capabilities/canAddFolderFromAnotherDrive`: Whether the current user can
  add a folder from another drive (a different shared drive or My
  Drive) to this folder.
* `capabilities/canDeleteChildren`: Whether the current user can delete
  children of this folder.
* `capabilities/canMoveChildrenOutOfDrive`: Whether the current user can move
  children of this folder outside of the shared drive.
* `capabilities/canMoveChildrenWithinDrive`: Whether the current user can move
  children of this folder within the shared drive.
* `capabilities/canMoveItemWithinDrive`: Whether the current user can move
  this shared drive item within the shared drive.
* `capabilities/canReadDrive`: Whether the current user has read access to the
  shared drive to which this file belongs.
* `capabilities/canTrashChildren`: Whether the current user can trash children
  of this folder.
* `driveId`: The ID of the shared drive where the file is located.
* `trashingUser`: If the file has been explicitly trashed, the user who
  trashed it.
* `trashedTime`: The time that the item was trashed. If you're using the older
  Drive API v2, this field is called `trashedDate`.

The following fields aren't populated for files located within a shared drive:

* `permissions`: Due to the potential size of shared drive access control
  lists (ACLs), permissions aren't returned as part of files. Use the
  `permissions.list` method, which supports pagination, to list permissions
  for a file within a shared drive or the shared drive folder.
* `owners`, `ownerNames`, `ownedByMe`: Files within a shared drive are owned
  by the shared drive, not individual users.
* `folderColorRgb`: Folders cannot be colored individually.
* `shared`: All items in a shared drive are shared.
* `writersCanShare`: It's not possible to restrict sharing by role in shared
  drives.

The following fields are only set when the user has been granted file access
permissions on an item:

* `sharedWithMeDate`
* `sharingUser`

The following fields require special consideration when you use them with shared
drives:

* `parents.isRoot`: This field is only true for the My Drive
  root folder; it's false for the shared drive top-level folder.
* `parents`: A parent doesn't appear in the parents list if the requesting
  user isn't a member of the shared drive and doesn't have access to the
  parent. In addition, with the exception of the top level folder, the parents
  list must contain exactly one item if the file is located within a shared
  drive.

  **Note:** If you're using the older Drive API v2:

  + `shareable`: Deprecated. Use `capabilities/canShare`.
  + `editable`: Deprecated. Use `capabilities/canEdit`.
  + `copyable`: Deprecated. Use `capabilities/canCopy`.
  + `canComment`: Deprecated. Use `capabilities/canComment`.
  + `canReadRevisions`: Deprecated. Use `capabilities/canReadRevisions`.
* `capabilities/canRemoveChildren`: Use `capabilities/canDeleteChildren` or
  `capabilities/canTrashChildren`.

## Change resource

The following new fields are available in the
[`changes`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes) resource for a shared drive:

* `changeType`: The change type. Possible values are `file` and `drive`.
* `driveId`: The ID of the shared drive associated with this change.
* `drive`: The updated state of the shared drive. Present if the `changeType`
  is `drive` and the user is still a member of the shared drive.

Additional changes might be required for applications that need to sync content
with shared drives or track activity. For details, see [Track changes for users
and shared drives](https://developers.google.com/workspace/drive/api/guides/about-changes).

## Related topics

* [Files and folders overview](https://developers.google.com/workspace/drive/api/guides/about-files)
* [Changes and revisions overview](https://developers.google.com/workspace/drive/api/guides/change-overview)
