# Shared drives overview Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-shareddrives

Retrieved: 2026-09-19T16:30:12.552716+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

A shared drive is an organizational structure within Google Drive that lives
parallel to [My Drive](https://developers.google.com/workspace/drive/api/guides/about-files#my-drive).
Shared drives support files owned by an organization rather than an individual
user. An individual file can be organized within a shared drive or My
Drive, but not both. However, [Drive shortcuts](https://developers.google.com/workspace/drive/api/guides/shortcuts) can be used to point to files or folders from shared
drives to My Drive, or the other way around.

To learn how to create and manage shared drives using the Google Drive API, see
[Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).

## Availability and storage

Shared drives are available with supported Google Workspace editions, such as
Business Standard, Business Plus, Enterprise, and Education. Personal Google
Accounts (`@gmail.com`) cannot create shared drives, but they can be added as
members if the organization permits external sharing. There is no additional fee
per shared drive created.

Shared drives have unique storage characteristics compared to My
Drive:

* **Pooled storage:** Files in a shared drive belong to the organization, not
  an individual user. They count against the organization's pooled storage,
  not against an individual member's personal storage quota. Users can create
  and upload files to a shared drive even if their personal My
  Drive storage is full.
* **Item limit:** A shared drive can contain a maximum of 500,000 items,
  including files, folders, shortcuts, and items in the trash.
* **Folder depth:** A folder hierarchy within a shared drive cannot exceed
  100 nested levels.

**Note:** Service accounts don't have storage quota and can't own files. Instead,
they must upload files and folders into shared drives, or use OAuth 2.0 to
upload items on behalf of a human user.

For more information, see [Folder limits in shared
drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#folder-limits) and [Shared drive
limits in Google Drive](https://support.google.com/a/users/answer/7338880).

## Access control

Shared drives use a permission model similar to other content in
Drive. Unlike files in My Drive, a group of users
owns content within a shared drive. For more information about permissions, see
[Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

### Permission propagation

Like items in My Drive, permissions on parent items propagate
downward to their children. However, within a shared drive, permissions are
strictly expansive. For example, a user that has `role=commenter` for a shared
drive cannot have their access level reduced at another point within the folder
hierarchy. However, their access can be increased for a certain set of files.

Shared drive files must have exactly one parent. This means that shared drive
files belong to a single shared drive and are located in a single location
within that shared drive. Having a single location simplifies permission rules
for shared drive files.

### Compare member and file access

There are two classes of [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) in
shared drives:

* *Member permissions* are for users who have been granted access to the
  shared drive, either directly or through a group. Members can view the
  shared drive metadata, such as the shared drive's name. Members have access
  to all files within the shared drive, with the access level depending on the
  `role` given to the member, such as `commenter` or `reader`.
* *File access permissions* are for users who have been granted access to a
  subset of files within the shared drive. For example, sharing a single file
  to a user creates a file access permission.

An individual user can be a member of a shared drive *and* have file access
permissions for files contained within the shared drive. A file access
permission might be superseded if the user's membership in the shared drive
grants them a greater level of access.

File permissions are revoked when the user is no longer a member of the shared
drive, or if their member access level is reduced. Users also lose access to any
files and folders in the shared drive that were directly shared with them.

### Roles for shared drives

As with items in My Drive, each user in a shared drive is granted
access with a specific role. These roles are used for shared drives:

* The `fileOrganizer` role allows users to organize files within a shared
  drive and to move content into the trash.
* The `organizer` role grants the same privileges as the `fileOrganizer`. It
  also allows users to permanently remove content and modify shared drive name
  and membership.
* The `writer` role allows users to add files to shared drives and to share a
  shared drive item.

The `owner` role isn't allowed in shared drives.

For more information about roles and operations allowed in a shared drive, see
[Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles#operations-shared-drives).

### Member and organizer count rules

Shared drives have both the `organizerCount` and `memberCount` fields. The
values for these fields can decide who can access the shared drive. The
following are the rules for `organizerCount` and `memberCount` fields:

* Only administrators can manage a shared drive with an `organizerCount` of
  zero.
* Only administrators can access a shared drive with a `memberCount` of zero.
* Only administrators can access a shared drive with an `organizerCount` or
  `memberCount` greater than zero. This applies only if the remaining
  permissions are for empty groups or external users that were added before
  turning off sharing outside the domain.
* The `organizerCount` and `memberCount` fields don't distinguish between
  members of the organization and external members.
* Entities written on the file permission can access files inside a shared
  drive with a `memberCount` of zero.

For more information, see [Search for shared
drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives).

## Related topics

* [Implement shared drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)
* [Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
* [Manage folders with limited and expansive
  access](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access)
* [Create a shortcut to a Drive file](https://developers.google.com/workspace/drive/api/guides/shortcuts)
* [How file access works in shared
  drives](https://support.google.com/a/users/answer/12380484)
