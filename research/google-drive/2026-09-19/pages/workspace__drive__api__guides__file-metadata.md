# Manage file metadata Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/file-metadata

Retrieved: 2026-09-19T16:29:56.245522+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document covers important considerations for naming files and working with
metadata like indexable text and thumbnails. To insert and retrieve files, see
the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

## Metadata overview

In the Google Drive API, the `files` resource represents the metadata. Unlike APIs
where metadata is a sub-object, the Drive API treats the entire
`files` resource as metadata. You can access the metadata directly through the
[`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) or [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) methods on the `files` resource.

By default, the `get` and `list` methods return only a partial set of fields. To
retrieve specific data, you must define the `fields` [system
parameter](https://docs.cloud.google.com/apis/docs/system-parameters#definitions) in
your request. If omitted, the server returns a default subset of fields specific
to the method. For example, the `list` method returns only the `kind`, `id`,
`name`, `mimeType`, and `resourceKey` fields for each file. To return different
fields, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

Additionally, metadata visibility depends on the user's role on the file. The
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource doesn't determine a
user's allowed actions on a file or folder. Instead, the `files` resource
contains a collection of boolean
[`capabilities`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.capabilities) fields. The
Google Drive API derives these `capabilities` from the `permissions` resource
associated with the file or folder. For more information, see [Understand file
capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities).

The Drive API offers two restricted metadata scopes: `drive.metadata`
and `drive.metadata.readonly`. The `drive.metadata` scope lets you view and
manage file metadata, while `drive.metadata.readonly` is read-only. Both
strictly prohibit access to file content. For more information, see [Choose
Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Finally, always verify your logic regarding permissions and scopes. For example,
a user might own a file with full permissions, but the Drive API will
block attempts to modify or download the file if your app only has the
`drive.metadata.readonly` scope.

## Specify file names and extensions

Apps should specify a file extension in the
[`name`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.name)) property when inserting
files with the Google Drive API. For example, an operation to insert a JPEG file
should specify something like `"name": "cat.jpg"` in the metadata.

Subsequent `GET` responses can include the read-only [`fileExtension`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.file_extension) property populated with the
extension originally specified in the `name` property. When a Google Drive
user requests to download a file, or when the file is downloaded through the
sync client, Drive builds a full filename (with extension) based
on the name. In cases where the extension is missing, Drive
attempts to determine the extension based on the file's MIME type.

## Save indexable text

Drive automatically indexes documents for search when it
recognizes the file type, including text documents, PDFs, images with text, and
other common types. If your app saves other types of files (such as drawings,
video, and shortcuts), you can improve the discoverability by supplying
indexable text in the
[`contentHints.indexableText`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField)
field of the file.

Indexable text is indexed as HTML. If you save the indexable text string
`<section attribute="value1">Here's some text</section>`, then "Here's some
text" is indexed, but "value1" isn't. Because of this, saving XML as indexable
text isn't as useful as saving HTML.

When specifying `indexableText`, also keep in mind:

* The size limit for `contentHints.indexableText` is 128 KB.
* Capture the key terms and concepts that you expect a user to search.
* Don't try to sort text in order of importance because the indexer does that
  efficiently for you.
* Your application should update the indexable text with each save.
* Make sure the text is related to the file's content or metadata.

This last point might seem obvious, but it's important. It's not a good idea to
add commonly searched terms to force a file to appear in search results. This
can frustrate users, and might even motivate them to delete the file.

## Upload thumbnails

Drive automatically generates thumbnails for many common file
types, such as Google Docs, Sheets, and Slides.
Thumbnails help the user to better identify Drive files.

For file types that Drive can't generate a standard thumbnail
for, you can provide a thumbnail image generated by your application. During
file creation or update, upload a thumbnail by setting the
`contentHints.thumbnail` field on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

Specifically:

* Set the `contentHints.thumbnail.image` field to the URL and filename safe
  base64-encoded image (see [RFC 4648 section
  5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)).
* Set the `contentHints.thumbnail.mimeType` field to the appropriate MIME type
  for the thumbnail.

If Drive can generate a thumbnail from the file, it uses the
automatically generated one and ignores any you might have uploaded. If it can't
generate a thumbnail, it uses the one you provide.

Thumbnails should adhere to these rules:

* Can be uploaded in PNG, GIF, or JPG formats.
* The recommended width is 1600 pixels.
* The minimum width is 220 pixels.
* The maximum file size is 2 MB.
* They should be updated by your application with each save.

**Important:** Thumbnails are invalidated each time the file content changes. When
providing thumbnails, it's important to upload new thumbnails each time the
content is modified. Metadata changes don't invalidate thumbnails.

For more information, see the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

## Retrieve thumbnails

You can retrieve metadata, including thumbnails, for Drive files.
Thumbnail information is housed in the
[`thumbnailLink`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.thumbnail_link) field of
the `files` resource.

### Return a specific thumbnail

The following code sample shows a [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method
request with multiple fields as a query parameter to return the `thumbnailLink`
metadata for a specific file. For more information, see [Return specific fields
for a file](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

```
GET https://www.googleapis.com/drive/v3/files/FILE_ID?fields=id,name,mimeType,thumbnailLink
```

Replace FILE\_ID with the `fileId` of the file that you want to
find.

If available, the request returns a short-lived URL to the file's thumbnail.
Typically, the link lasts for several hours. The field is only populated when
the requesting app can access the file's content. If the file isn't shared
publicly, the URL returned in `thumbnailLink` must be fetched using a
[credentialed request](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

### Return a list of thumbnails

The following code sample shows a [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method
request with multiple fields as a query parameter to return the `thumbnailLink`
metadata for a list of files. For more information, see [Search for files and
folders](https://developers.google.com/workspace/drive/api/guides/search-files).

```
GET https://www.googleapis.com/drive/v3/files/?fields=files(id,name,mimeType,thumbnailLink)
```

To restrict the search results to a specific file type, apply a query string to
set the MIME type. For example, the following code sample shows how to limit the
list to Google Sheets files. For more information on MIME types, see [Google Workspace and Google Drive supported MIME
types](https://developers.google.com/workspace/drive/api/guides/mime-types).

```
GET https://www.googleapis.com/drive/v3/files/q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,mimeType,thumbnailLink)
```

## Related topics

* [Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata)
* [Add custom file properties](https://developers.google.com/workspace/drive/api/guides/properties)
