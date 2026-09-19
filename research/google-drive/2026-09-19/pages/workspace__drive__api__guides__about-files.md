# Files and folders overview Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-files

Retrieved: 2026-09-19T16:29:35.123413+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Google Drive organizes files in collections, describes files by types, and
provides specific attributes for each file to facilitate file manipulation.

The Google Drive API represents files stored on Drive as a
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

**Note:** Folders are treated as a type of file. For more details about folders, see
[File types](https://developers.google.com/workspace/drive/api/guides/about-files#types).

## Ownership

Drive organizes files based on the user's relationship with the
content and its storage location. *Collections* are specified as part of the
file's metadata to show which group of files the file is stored with inside
Drive. The main difference between My Drive and
shared drive collections is file ownership. A single user is the owner of files
in their My Drive, whereas a group or organization owns files in
a shared drive.

*My Drive*
:   Each user has a "root" folder called "My
    Drive" that functions as their primary hierarchy, and
    consists of everything that descends from this root folder. The user is the
    primary owner of this folder.

*Shared drives*
:   A [shared drive](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) is an
    organizational structure within Drive that lives parallel to
    My Drive. You can organize an individual file within a shared
    drive or My Drive, but not both. However, [Drive shortcuts](https://developers.google.com/workspace/drive/api/guides/shortcuts) can be used to
    point to files or folders from shared drives to My Drive, or
    the other way around.

## File types

Drive describes files by types. This list shows all available
file types:

*Blob*
:   A file type that contains raw binary or text content (such as
    images, videos, and PDFs) as opposed to a Google Workspace document.
    This is a Drive classification name and doesn't refer to
    JavaScript's [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
    object.

*Folder*
:   A container you can use to organize other types of files
    on Drive. Folders are files that only contain metadata, and
    have the MIME type `application/vnd.google-apps.folder`. For more
    information, see [Create and populate
    folders](https://developers.google.com/workspace/drive/api/guides/folder).

    **Note:** A single file stored on My Drive can be in multiple
    folders. A single file stored on a [shared
    drive](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) can only have one parent folder.

*Google Workspace document*
:   A file that a Google Workspace application
    creates, such as Google Docs, Sheets, or
    Slides. The MIME type format is
    `application/vnd.google-apps.*app*` where *app* is the application name
    (such as `application/vnd.google-apps.spreadsheet` for a
    Sheets file). For a list of Drive and
    Google Workspace-specific MIME types, see [Google Workspace and
    Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types).

*Shortcut*
:   A metadata-only file that points to another file on Drive. The
    shortcut file MIME type is `application/vnd.google-apps.shortcut`. For more
    information, see [Create a shortcut to a Drive
    file](https://developers.google.com/workspace/drive/api/guides/shortcuts).

*Third-party shortcut*
:   A metadata-only file that links to content stored on a third-party storage
    system. The third-party shortcut file MIME type is
    `application/vnd.google-apps.drive-sdk`. For more information, see [Create a
    shortcut file to content stored by your
    app](https://developers.google.com/workspace/drive/api/guides/third-party-shortcuts).

**Note:** You cannot upload or download folders, Google Workspace documents,
shortcuts, and third-party shortcuts to or from Drive. However,
if they use compatible formats you can upload or export Google Workspace
documents. For example, you can create a Docs
document when you import a PDF. Similarly, you can export a Google Slides
presentation as a Microsoft PowerPoint file.

## File characteristics

This list shows some characteristics of a Drive file:

*Access proposal*
:   A proposal from a requester to an approver to grant a recipient access to a
    Drive item. For more information, see [List and resolve
    pending access
    proposals](https://developers.google.com/workspace/drive/api/guides/manage-sharing#access-proposals).

*Content*
:   The binary or text body of the file. Some content examples you can store in
    Drive are images, videos, text, and PDFs.

*File ID*
:   A unique, opaque ID for each file. File IDs are stable throughout the life of
    the file, even if the file name changes. [Search
    expressions](https://developers.google.com/workspace/drive/api/guides/search-files) are used to locate files by name,
    type, content, parent container, owner, or other metadata.

*Metadata*
:   Data describing the contents of the file. This data includes the name, type,
    creation, and modification times. Some metadata fields, such as the `name`,
    are user-agnostic and appear the same for each user. Other fields, such as
    `capabilities` and `viewedByMeDate` contain user-specific values. File
    types, such as images and videos, contain additional metadata extracted from
    EXIF and other embedded metadata. For more information, see [Manage file
    metadata](https://developers.google.com/workspace/drive/api/guides/file).

*Permission*
:   An access grant for a user, group, domain, or the world to access a file or a
    folder hierarchy. Users control who can access a file with the access
    control list (ACL), which is a list of permissions for the file. For more
    information, see [Share files, folders and
    drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

*Revision history*
:   The record of changes to the file content only, not the file metadata. For
    more details about revisions, see [Changes and revisions overview](https://developers.google.com/workspace/drive/api/guides/change-overview).

*Thumbnail*
:   A graphical representation of a file. Drive automatically
    generates thumbnails for many common file types. For shortcuts and other
    file types that Drive can't render, you can provide a
    thumbnail image. For more information, see [Upload thumbnails](https://developers.google.com/workspace/drive/api/guides/file#upload-thumbnails).

## File organization

The Drive API organizes files into storage locations, called `spaces`,
and collections, called `corpora`.

*Spaces*
:   Specific storage locations that are isolated from each other. All content in
    Drive is stored in one of these two defined spaces: `drive`
    and `appDataFolder`.

    * `drive`: Includes all user-visible files created in
      Drive. PDFs, documents, Google Docs, shortcuts, and
      other content the user uploads is located in the `drive` space.
    * `appDataFolder`: Includes per-user application data. Applications
      typically store configuration files and other data not intended to be
      directly accessible by users.

    Files cannot move between `spaces`.

*Corpora*
:   Collections of files used to narrow the scope of file and folder searches. The
    corpora for Drive are: `user`, `domain`, `drive`, and
    `allDrives`.

    * `user`: Includes all files created by and opened by the user in "My
      Drive", and those shared directly with the user in
      "Shared with me."
    * `drive`: Includes all files contained in a single shared drive, as
      indicated by the `driveId`.
    * `domain`: Includes all searchable files shared with the user's domain.
    * `allDrives`: Includes all files in shared drives where the user is a
      member, and all files in "My Drive" and "Shared with me."
      Use the `allDrives` corpora with caution as it has a broad scope and can
      affect performance. When possible, use `user` or `drive` instead of
      `allDrives` for efficiency.

    Files can move freely between `corpora` as permissions and ownership change.

## Related topics

Here are a few next steps you might take:

* Learn how to [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).
* Learn how to [Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder).
* Learn how to [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
* Learn how to [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
* Learn how to [Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata).
* Learn how to [Display the Google Picker](https://developers.google.com/workspace/drive/api/guides/picker) on a page.
