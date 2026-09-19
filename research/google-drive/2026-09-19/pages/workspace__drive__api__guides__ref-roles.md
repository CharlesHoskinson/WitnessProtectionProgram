# Roles and permissions Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/ref-roles

Retrieved: 2026-09-19T16:31:45.365188+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

A [role](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.inlinedField_2) is a
collection of [permissions](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) that allows users to
perform specific actions on Google Drive resources. To make permissions
available to users, groups, and service accounts, you assign roles. When you
assign a role, you grant all the permissions that the role contains.

Each permission in the Google Drive API has a role that defines what users can do
with a file, folder, or shared drive. For more information, see [Scenarios for
sharing Drive
resources](https://developers.google.com/workspace/drive/api/guides/manage-sharing#sharing-drive-resources).

## Operations for files and folders

The following table shows the operations users can perform for each role, when
the role isn't restricted to a view. For more information, see [Views](https://developers.google.com/workspace/drive/api/guides/ref-roles#views).

| Permitted operation | `owner` | `organizer` | `fileOrganizer` | `writer` | `commenter` | `reader` |
| --- | --- | --- | --- | --- | --- | --- |
| Read the metadata (such as name, description) of the file or folder |  |  |  |  |  |  |
| Read the content of the file |  |  |  |  |  |  |
| Read the list of items in the folder |  |  |  |  |  |  |
| Add comments to the file |  |  |  |  |  |  |
| Modify the metadata of the file or folder |  |  |  |  |  |  |
| Modify the content of the file |  |  |  |  |  |  |
| Access historical revisions |  |  |  |  |  |  |
| Add items to the folder |  |  |  |  |  |  |
| Remove items from the My Drive folder |  |  |  |  |  |  |
| Share items from the My Drive folder |  |  |  |  |  |  |
| Can access detailed file permissions |  |  |  |  |  |  |
| Move items into the trash |  |  |  |  |  |  |
| Recover items from the trash |  |  |  |  |  |  |
| Empty the trash |  |  |  |  |  |  |
| Delete a file or folder |  |  |  |  |  |  |
| Add a content restriction to a file in a My Drive folder |  |  |  |  |  |  |
| Set or unset the limited access setting in My Drive folders |  |  |  |  |  |  |

## Operations specific to shared drives

The following table shows shared drive specific operations users can perform for
each role, when the role isn't restricted to a view. For more information, see
[Views](https://developers.google.com/workspace/drive/api/guides/ref-roles#views).

| Permitted operation | `owner` | `organizer` | `fileOrganizer` | `writer` | `commenter` | `reader` |
| --- | --- | --- | --- | --- | --- | --- |
| Share a shared drive item |  |  |  |  |  |  |
| Add files to shared drives |  |  |  |  |  |  |
| Modify the metadata of a shared drive |  |  |  |  |  |  |
| Add shared drive members |  |  |  |  |  |  |
| Reorganize items within a shared drive [1] |  |  |  |  |  |  |
| Move items outside of a shared drive [2] |  |  |  |  |  |  |
| Delete items in shared drives [2] |  |  |  |  |  |  |
| Delete an empty shared drive |  |  |  |  |  |  |
| Add a content restriction to a file in a shared drive |  |  |  |  |  |  |
| Set or unset the limited access setting in shared drive folders |  |  |  |  |  |  |

**[1]** Requires the `organizer` or
`fileOrganizer` role on a direct or indirect parent, as opposed to
the role being present on the item.
  
**[2]** Requires the `organizer` role on
a direct or indirect parent, as opposed to the role being present on the item.

## Correlation between Drive API and Drive UI roles

The Drive API and Drive UI use the same underlying
permission system. However, the role names differ slightly between the two.

The following table shows how the roles correspond for files and folders in My
Drive.

| Drive API role | Drive UI role | Description |
| --- | --- | --- |
| `owner` | Owner | Grants full control over the file or folder. |
| `writer` | Editor | Grants the ability to view the file, add comments, and edit the file. For folders, can add, edit, and delete files or subfolders within that folder. |
| `commenter` | Commenter | Grants the ability to view the file and add comments. |
| `reader` | Viewer | Grants the ability to view the file. |

The following table shows how the roles correspond for files and folders in
shared drives.

| Drive API role | Drive UI role | Description |
| --- | --- | --- |
| `organizer` | Manager | Grants the ability to manage files, folders, people, and settings. |
| `fileOrganizer` | Content Manager | Grants the ability to contribute and manage content. Default role for new members. |
| `writer` | Contributor | Grants the ability to view the file, add comments, and edit the file. Can also create files within a shared drive. |
| `commenter` | Commenter | Grants the ability to view the file and add comments. |
| `reader` | Viewer | Grants the ability to view the file. |

## Views

A permission might be restricted to a
[`view`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions#Permission.FIELDS.view), in which case
the role only applies to that particular view.

A permission with `view=published` and `role=reader` grants `reader` access to
the published view of the file, but it doesn't grant `reader` access to the
file.

A permission with `view=metadata` and `role=reader` grants `reader` access to
the metadata of the folder, but it doesn't grant access to the folder's
contents.

Conversely, any permission that's not restricted to a particular view, grants
`reader` access to the published view of the file.

## Related topics

* [Share files from Google Drive](https://support.google.com/docs/answer/2494822#zippy=%2Cunderstand-share-permissions)
* [How file access works in shared drives](https://support.google.com/a/users/answer/12380484#access)
