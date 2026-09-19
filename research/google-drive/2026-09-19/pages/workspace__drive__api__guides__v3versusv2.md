# Drive API v2 and v3 comparison guide Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/v3versusv2

Retrieved: 2026-09-19T16:30:28.528967+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The latest Google Drive API version is v3. The performance in v3 is better because
searches only return a subset of fields. Use the current version unless you need
the [v2](https://developers.google.com/workspace/drive/api/v2/reference) collection. If you're using v2, consider
migrating to v3. To migrate, see [Migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3). For a complete list of version differences, see
the [Drive API v2 and v3 comparison
reference](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference).

If you want to continue to use v2, see the [Guide to Drive API v2](https://developers.google.com/workspace/drive/api/guides/v2-guide) amendment to learn how some instructions in the v3
guides must be amended for v2 developers.

To learn more about Drive API v3 improvements, you can watch the
following video by Google engineers discussing the new API design.

## V3 improvements

To optimize performance and reduce API behavior complexity, v3 provides these
improvements over the previous API version:

* Searches for files and shared drives don't return full resources by default,
  only a subset of commonly used fields gets returned. For more details on
  `fields`, see the [`files.list`](https://developers.google.com/workspace/drive/api/v3/reference/files/list) method
  and the [`drives.list`](https://developers.google.com/workspace/drive/api/v3/reference/drives/list) method.
* Almost all methods that return a response now require the `fields`
  parameter. For a list of all methods requiring `fields`, see the [Drive API reference](https://developers.google.com/workspace/drive/api/v3/reference).
* Resources that have duplicate capabilities were removed. Some examples:
  + The `files.list` method accomplishes the same functionality as the
    `Children` and `Parents` collections, so they're removed from v3.
  + The `Realtime.*` methods have been removed.
* App Data isn't returned by default in searches. In v2, you can set the
  `drive.appdata` scope, and it returns application data from the `files.list`
  method and the [`changes.list`](https://developers.google.com/workspace/drive/api/v2/reference/changes/list)
  method, but it slows performance. In v3, you set the `drive.appdata` scope,
  and also set the query parameter `spaces=appDataFolder` to request
  application data.
* All update operations use PATCH instead of PUT.
* To export Google Documents, use the
  [`files.export`](https://developers.google.com/workspace/drive/api/v2/reference/files/export) method.
* The `changes.list` method behavior is different. Instead of change IDs, use
  opaque page tokens. To poll the change collection, first call the
  [`changes.getStartPageToken`](https://developers.google.com/workspace/drive/api/v2/reference/changes/getStartPageToken)
  method for the initial value. For subsequent queries, the `changes.list`
  method returns the `newStartPageToken` value.
* Update methods now reject requests that specify non-writable fields.
* The v2 `exportFormats` and `importFormats` fields in the
  [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about) resource are lists of
  allowable import or export formats. In v3, they're MIME type maps of
  possible targets to all supported imports or exports.
* The v2 `appdata` and `appfolder` aliases are now `appDataFolder` in v3.
* The `properties` resource is removed from v3. The
  [`files`](https://developers.google.com/workspace/drive/api/v3/reference/files) resource has the `properties` field
  that contains true key-value pairs. The `properties` field contains public
  properties, and the `appProperties` field contains private properties, so
  the visibility field isn't needed.
* The `modifiedTime` field in the `files` resource updates the last time
  anyone modified the file. In v2, the `modifiedDate` field was only mutable
  on update if you set the `setModifiedDate` field.
* The `viewedByMeTime` field in the `files` resource doesn't automatically
  update.
* To import Google Docs formats, you set the appropriate target `mimeType`
  in the resource body. In v2, you set `?convert=true`.
* Import operations return a 400 error if the format isn't supported.
* Readers and commenters can't view permissions.
* The `me` alias for permissions is removed.
* Some functionality was available as part of the request resource but is
  instead available as a request parameter. For example:
  + In v2, you can use `children.delete` to remove a child file from a
    parent folder.
  + In v3, you use`files.update` on the child with
    `?removeParents=parent_id` in the URL.

## Other differences

Fields and parameter names are different in v3. Some examples include:

* The `name` property replaces `title` in the `files` resource.
* `Time` is the suffix for all date and time fields instead of `Date`.
* List operations don't use the `items` field to contain the result set. The
  resource type provides a field for the results (such as `files` or
  `changes`).
