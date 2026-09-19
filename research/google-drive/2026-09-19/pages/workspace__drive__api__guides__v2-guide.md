# Guide to Drive API v2 Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/v2-guide

Retrieved: 2026-09-19T16:30:30.360765+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

If you use Google Drive API version 2, most of the content in the [Google Drive API
Guide](https://developers.google.com/workspace/drive/api/guides/about-sdk) v3 pertains to v2 as well. This section
contains all of the information that's v2-specific, and different from what's
shown in specific pages of the v3 guide. To get full context, each sub-section
contains the link to the corresponding guide page.

For a complete list of differences, see [Drive API v2 & v3 comparison
reference](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference).

## Download & publish file revisions

On the [Download & publish file revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions)
page, the following information is specific to v2, and replaces these sections
shown for v3:

### List & download individual revisions

Once you get a list of a file's revisions, you can download the content of any
revision by sending an authorized `GET` request to its
[]`downloadUrl`](/workspace/drive/api/reference/rest/v2/revisions) property.
Google Drive generates this short-lived URL when you request the revision.
Don't rely on it for later use.

You can also export the revision in one of the supported formats by checking the
`exportLinks` property.

## Custom file properties

In addition to the information on the [Add custom file properties](https://developers.google.com/drive/api/guides/properties) page, the following information is specific to v2:

Properties are accessed using the
[`properties`](https://developers.google.com/workspace/drive/api/reference/rest/v2/properties) resource.

This is the structure of a typical property that might be used to store a
Drive file's database ID on the file.

```
{
  'key':        'additionalID',
  'value':      'ID',
  'visibility': 'PRIVATE'
}
```

For more information about limits, see
[`properties`](https://developers.google.com/workspace/drive/api/reference/rest/v2/properties) in the
reference documentation.

## Enable shared drive support

In addition to the information on the [Implement shared drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives) page, replace this additional field
[`trashedDate`](https://developers.google.com/workspace/drive/api/v2/reference/files) for v2.

In [Implement shared drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives), the
following methods require `supportsAllDrives=true` when working with shared
drives content:

* `files.get`
* `files.list`
* `files.insert`
* `files.update`
* `files.patch`
* `files.copy`
* `files.trash`
* `files.untrash`
* `files.delete`
* `files.touch`
* `children.insert`
* `parents.insert`
* `changes.list`
* `changes.getStartPageToken`
* `changes.get`
* `permissions.list`
* `permissions.get`
* `permissions.insert`
* `permissions.update`
* `permissions.patch`
* `permissions.delete`

The `changes.get` and `changes.list` methods have several parameters specific to
shared drives. For a list of parameters, see [Track changes on a shared
drive](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives#track_changes_on_a_shared_drive)
section.

## Upload files

On the [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads) page, notice this
information is specific to v2:

### Import to Google Docs types

When you create a file in Google Drive, you can convert some types file into a
Google Docs, Google Sheets, or Google Slides document. Include the
[`files.insert`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/insert) `convert` query
parameters and set the (workspace\_name) `mimeType` property of the file. For
more information, see [Upload file
data](https://developers.google.com/workspace/drive/api/guides/manage-uploads#import-docs).

## Share files, folders & drives

Notice on the [Share files, folders & drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
page, in v3 only one field, `role`, specifies effective roles for user, group,
or domain. In v2, you need both `role` and `additionalRoles` fields of a
permission reflect the effective roles the user, group, or domain have for a
given item.

## Search query differences for v2

The v2 `title` field is `name` in v3. For examples, see [Search for files &
folders](https://developers.google.com/workspace/drive/api/guides/search-files).

The v2 `createdDate` field is `createdTime` in v3. For examples, see [Search for
shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives).

The v2 `modifiedDate` field is `modifiedTime` in v3. The v2 `lastViewedByMeDate`
field is `viewedByMeTime` in v3. For more details, see [Search query terms &
operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms).
