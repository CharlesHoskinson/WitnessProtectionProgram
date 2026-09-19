# Trash or delete files and folders Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/delete

Retrieved: 2026-09-19T16:29:44.781730+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

You can remove Google Drive files and folders from both your My
Drive and shared drives. You have two options to do this: trash
or delete.

You can move files and folders into the trash and then restore them (within 30
days of trashing them). Deleting files and folders removes them permanently from
Drive. If you trash, restore, or permanently delete multiple
files or folders at once, it might take time for you to notice the changes.

**Note:** For this document, assume the term "files" means both files and folders.
Folders are files that only contain metadata and can be used to organize files
in Drive. Specifically, a folder is a file with no extension and
a [MIME type](https://developers.google.com/workspace/drive/api/guides/mime-types) of
`application/vnd.google-apps.folder`. For more information, see [Create
metadata-only files](https://developers.google.com/workspace/drive/api/guides/create-file#create-metadata-file).

This guide explains how you can dispose of files in Drive.

## Use the fields parameter

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions)
with any method of the `files` resource. If you omit the `fields` parameter, the
server returns a default set of fields specific to the method. For example, the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method returns only the `kind`, `id`,
`name`, `mimeType`, and `resourceKey` fields for each file. To return different
fields, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

## Trash

To remove Drive files, you can move them to the trash. Files in
the trash are automatically deleted after 30 days. You can restore files from
your trash before the 30-day period.

Only the file owner can trash a file, but other users can still access the file
in the owner's trash until it's permanently deleted. If you attempt to trash a
file you don't own, you receive an [`insufficientFilePermissions`](https://developers.google.com/workspace/drive/api/guides/handle-errors#insufficient-file-permissions) error. For more
information, see [Permissions](https://developers.google.com/workspace/drive/api/guides/delete#permissions).

To verify you're the file owner, call the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get)
method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with the `fileId`
path parameter and the `fields` parameter set to the boolean [`ownedByMe`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.owned_by_me) field. The `ownedByMe` field
isn't populated for files in shared drives because they're owned by the shared
drive, not individual users. For more information about the `fields` parameter,
see [Use the fields parameter](https://developers.google.com/workspace/drive/api/guides/delete#fields-parameter).

If you're not the file owner but still want a copy of the trashed file, do one
of the following:

* Make a copy of the file.
* Contact the owner to have them restore it from the trash.

### Move a file to the trash

To move a file to the trash, use the [`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update)
method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with the `fileId`
path parameter and set the boolean
[`trashed`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.trashed) field to `true`. To
trash a shared drive file, you must also set the boolean [`supportsAllDrives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.QUERY_PARAMETERS.supports_all_drives) query
parameter to `true`. For more information, see [Implement shared drive
support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#response-body) contains an instance of the
`files` resource.

**Note:** If you're using the previous Drive API v2 version, use the
[`trash`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/trash) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files) resource. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to use the `fileId` to mark the file as
trashed:

### Python

```
body_value = {'trashed': True}

response = drive_service.files().update(fileId="FILE_ID", body=body_value).execute()
```

### Node.js

```
const body_value = {
  'trashed': true
};

const response = await drive_service.files.update({
      fileId: 'FILE_ID',
      resource: body_value,
    });
    return response;
```

Replace FILE\_ID with the `fileId` of the file that you want to
trash.

### Determine a trashed file's properties

When a file is trashed, you can retrieve additional file properties. You can use
the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with the `fileId` path parameter and use one
of the following trashed fields in the `fields` parameter. For more information
about the `fields` parameter, see [Use the fields parameter](https://developers.google.com/workspace/drive/api/guides/delete#fields-parameter).

The following fields are populated for all files:

* [`trashed`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.trashed): Whether the file
  was trashed, either explicitly or from a trashed parent folder. Note that
  while using `trashed` with the `update` method sets the file's status, the
  `get` method retrieves the file's status.
* [`explicitlyTrashed`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.explicitly_trashed):
  Whether the file was explicitly trashed, as opposed to recursively trashed,
  from a parent folder.

The following fields are only populated for files located within a shared drive:

* [`trashedTime`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.trashed_time): The time
  that the item was trashed in [RFC
  3339](https://datatracker.ietf.org/doc/html/rfc3339) date-time format. If
  you're using the previous Drive API v2 version, this field is
  called
  [`trashedDate`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files#File.FIELDS.trashed_date).
* [`trashingUser`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.trashing_user): If the
  file was explicitly trashed, the user who trashed it.

### Recover a file from the trash

To recover a file from the trash, use the
[`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with the `fileId` path parameter and set the
boolean [`trashed`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.trashed) field to
`false`. To untrash a shared drive file, you also must set the boolean
[`supportsAllDrives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#body.QUERY_PARAMETERS.supports_all_drives) query
parameter to `true`. For more information, see [Implement shared drive
support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update#response-body) contains an instance of the
`files` resource.

**Note:** If you're using the previous Drive API v2 version, use the
[`untrash`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/untrash) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files) resource. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to use the `fileId` to mark the file as
untrashed:

### Python

```
body_value = {'trashed': False}

response = drive_service.files().update(fileId="FILE_ID", body=body_value).execute()
```

### Node.js

```
const body_value = {
  'trashed': false
};

const response = await drive_service.files.update({
      fileId: 'FILE_ID',
      resource: body_value,
    });
    return response;
```

Replace FILE\_ID with the `fileId` of the file that you want to
untrash.

## Empty trash

You can permanently delete all Drive files the user has [moved to
the trash](https://developers.google.com/workspace/drive/api/guides/delete#file-trash) using the
[`emptyTrash`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource. To empty the trash of a shared drive, you
must also set the
[`driveId`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#body.QUERY_PARAMETERS.drive_id)
query parameter to the shared drive ID.

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash#response-body) contains an empty JSON
object.

**Note:** If you're using the previous Drive API v2 version, use the
[`emptyTrash`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/emptyTrash) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files) resource. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to use the `fileId` to permanently delete
all files in the trash:

### Python

```
response = drive_service.files().emptyTrash().execute()
```

### Node.js

```
 const response = await drive_service.files.emptyTrash({
    });
    return response;
```

## Delete

You can permanently delete a Drive file without moving it to the
trash. After you delete a file, anyone you've shared the file with loses access
to it. If you want others to retain access to the file, you can [transfer
ownership](https://developers.google.com/workspace/drive/api/guides/transfer-file) to someone else before deletion.

To delete a shared drive file, the user must have `role=organizer` on the parent
folder. If you're deleting a folder, all descendants owned by the user are also
deleted. For more information, see [Permissions](https://developers.google.com/workspace/drive/api/guides/delete#permissions).

To permanently delete a user-owned file without moving it to the trash, use the
[`delete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource. To delete a shared drive file, you must also
set the boolean [`supportsAllDrives`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete#body.QUERY_PARAMETERS.supports_all_drives) query
parameter to `true`. For more information, see [Implement shared drive
support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete#response-body) contains an empty JSON
object.

**Note:** If you're using the previous Drive API v2 version, use the
[`delete`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/delete) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files) resource. Learn how to [migrate to
Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code sample shows how to use the `fileId` to delete the file:

### Python

```
response = drive_service.files().delete(fileId="FILE_ID").execute()
```

### Node.js

```
 const response = await drive_service.files.delete({
      fileId: 'FILE_ID'
    });
    return response;
```

Replace FILE\_ID with the `fileId` of the file that you want to
delete.

## Permissions

The following table shows the role permissions required to trash or delete files
and folders. For a complete list of roles and the operations permitted by each,
refer to [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).

| Permitted operation | `owner` | `organizer` | `fileOrganizer` | `writer` | `commenter` | `reader` |
| --- | --- | --- | --- | --- | --- | --- |
| Move files and folders into the trash |  |  |  |  |  |  |
| Recover files and folders from the trash |  |  |  |  |  |  |
| Empty the trash |  |  |  |  |  |  |
| Delete a file or folder |  |  |  |  |  |  |
| Delete files and folders in a shared drive [\*] |  |  |  |  |  |  |
| Delete an empty shared drive |  |  |  |  |  |  |

**[\*]** Requires the `organizer` role on
a direct or indirect parent, as opposed to the role being present on the item.

### Capabilities

A [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource contains a collection of boolean
`capabilities` fields that indicate the capabilities the user has on this file.

To check the capabilities, call the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method
on the `files` resource with the `fileId` path parameter and use one of the
following [`capabilities`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.capabilities)
fields in the `fields` parameter. For more information about the `fields`
parameter, see [Use the fields parameter](https://developers.google.com/workspace/drive/api/guides/delete#fields-parameter).

The following fields are populated for all files:

* [`capabilities.canTrash`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_16):
  Whether the current user can move this file to trash.
* [`capabilities.canUntrash`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_22):
  Whether the current user can restore this file from trash.
* [`capabilities.canDelete`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_11):
  Whether the current user can delete this file.
* [`capabilities.canRemoveChildren`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_14):
  Whether the current user can remove children from this folder. This is
  `false` when the item isn't a folder.

The following fields are only populated for files located within a shared drive:

* [`capabilities.canTrashChildren`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_29):
  Whether the current user can trash children of this folder. This is `false`
  when the item isn't a folder.
* [`capabilities.canDeleteChildren`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_26):
  Whether the current user can delete children of this folder. This is `false`
  when the item isn't a folder.

## File and folder limits

Drive files and folders, along with shared drive folders, have
some storage limits.

Generally, after the item limit is reached, the only way to create more space is
to [permanently delete](https://developers.google.com/workspace/drive/api/guides/delete#empty-trash) items or use a
different account. Moving files to the trash isn't enough to free up space.

For more information on file and folder limits, see the following:

* [File and folder limits in files](https://developers.google.com/workspace/drive/api/guides/folder#folder-limits)
* [Folder limits in shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#folder-limits)

## Related topics

* [Delete files in Google Drive](https://support.google.com/drive/answer/2375102)
* [Shared drive versus My Drive API differences](https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs)
* [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
