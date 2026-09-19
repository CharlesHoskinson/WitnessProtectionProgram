# Access link-shared Drive files using resource keys Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/resource-keys

Retrieved: 2026-09-19T16:29:54.336893+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

You can share Google Drive files and folders with others using the [Drive UI](https://developers.google.com/workspace/drive/api/guides/about-apps) or through the [Google Drive API](https://developers.google.com/workspace/drive/api/guides/create-file). When you share from
Drive, you can control whether people can edit, comment on, or
only open the file.

A *resource key* helps protect your file from unintended access. Resource keys
are an additional parameter that are passed so users can access certain files
that have been shared using a link. Users who haven't viewed the file before
must provide the resource key to gain access. Those who have recently viewed the
file, or have direct access, don't need the resource key to access the file.

A Drive file that's shared with a link can only be discovered by
users that can access the file as a result of a `type=user` or `type=group`
[`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource. Requests from users
that only have access to these link-shared files using a `type=domain` or
`type=anyone` permission might require a resource key.

For more information about permissions, see [Share files, folders and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing). For a complete list of roles and the operations
permitted by each, see [Roles & permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles).

## Read the resource key from the file

The Drive API returns a file's resource key on the read-only
`resourceKey` field of the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

If the file is a [Drive shortcut](https://developers.google.com/workspace/drive/api/guides/shortcuts), the
resource key for the shortcut target is returned on the read-only
`shortcutDetails.targetResourceKey` field.

Fields in the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource that return URLs,
such as `exportLinks`, `webContentLink`, and `webViewLink`, also include the
`resourceKey`. Clients that integrate with the Drive UI can also
use `resourceKeys` within the [`state`](https://developers.google.com/workspace/drive/api/guides/enable-sdk#construct)
parameter. For more information, see [Download and export
files](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

## Set the resource key on the request

Resource keys for any files referenced by requests to the Drive API
are set on the `X-Goog-Drive-Resource-Keys` HTTP header.

Requests to the Drive API can specify one or more resource keys with
the `X-Goog-Drive-Resource-Keys` HTTP header.

### Syntax

A file ID and resource key pair are set on the header using a forward slash
(`/`) separator. The header is built by combining all the file ID and resource
key pairs using comma (`,`) separators.

For example, consider a request to move file `fileId1` from folder `fileId2` to
folder `fileId3`. Assume the resource keys for these three files are
`resourceKey1`, `resourceKey2`, and `resourceKey3`, respectively. The header
built from these values using a forward slash and comma separators is:

```
    X-Goog-Drive-Resource-Keys: fileId1/resourceKey1,fileId2/resourceKey2,fileId3/resourceKey3
```

### Related topics

* [Share files, folders and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
* [Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
* [Protect file content](https://developers.google.com/workspace/drive/api/guides/content-restrictions)
* [Configure a Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk)
