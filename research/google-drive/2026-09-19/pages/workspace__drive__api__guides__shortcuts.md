# Create a shortcut to a Drive file Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/shortcuts

Retrieved: 2026-09-19T16:29:59.168151+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

*Shortcuts* are files that link to other files or folders on Google Drive.
Shortcuts have these characteristics:

* An `application/vnd.google-apps.shortcut` MIME type. For more information,
  see [Google Workspace & Google Drive supported MIME
  types](https://developers.google.com/workspace/drive/api/guides/mime-types).
* The ACL for a shortcut inherits the ACL of the parent. The shortcut's ACL
  cannot be changed directly.
* A `targetId` pointing to the target file or folder, also referred to as the
  "target."
* A `targetMimeType` indicating the MIME type for the target. The
  `targetMimeType` is used to determine the type icon to display. The target's
  MIME type is copied to the `targetMimeType` field when the shortcut is
  created.
* The `targetId` and `targetMimeType` fields are part of the `shortcutDetails`
  field within the [file](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.
* A shortcut can only have one parent. If a shortcut file is required in other
  Drive locations, the shortcut file can be copied to the
  additional locations.
* When the target is deleted, or when the current user loses access to the
  target, the user's shortcut pointing to the target breaks.
* The title of a shortcut can differ from the target. When a shortcut is
  created, the title of the target is used as the title of the shortcut. After
  creation, the shortcut's title and target's title can be changed
  independently. If the target's name is changed, previously created shortcuts
  retain the old title.
* The MIME type of a shortcut can become stale. While rare, a blob file's MIME
  type changes when a revision of a different type is uploaded, but any
  shortcuts pointing to the updated file retain the original MIME type. For
  example, if you upload a JPG file to Drive, then upload an
  AVI revision, Drive identifies the change and updates the
  thumbnail for the actual file. However, the shortcut continues to have a JPG
  thumbnail.
* In [Google Account Data
  Export](https://support.google.com/accounts/answer/3024190)
  also known as Google Takeout, shortcuts are represented as Netscape
  bookmark files containing links to the target.

For more information, see [Find files & folders with Google Drive
shortcuts](https://support.google.com/drive/answer/9700156)
.

**Important:** Previously, shortcuts were the term for files that pointed to content
stored by an application. That type of "shortcut" was renamed to
*third-party shortcut*. For further information, see [Create a shortcut file to
content stored by your app](https://developers.google.com/workspace/drive/api/guides/third-party-shortcuts).

## Create a shortcut

To create a shortcut, set the MIME type to
`application/vnd.google-apps.shortcut`, set the `targetId` to the file or folder
the shortcut should link to, and call [`files.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) to create a shortcut.

**Note:** If you're using V2 of the API, use
[`files.insert`](https://developers.google.com/workspace/drive/api/v2/reference/files/insert).

The following examples show how to create a shortcut using a client library:

### Python

```
file_metadata = {
    'name': 'FILE_NAME',
    'mimeType': 'text/plain'
}
file = drive_service.files().create(body=file_metadata, fields='id').execute()
print('File ID: %s' % file.get('id'))
shortcut_metadata = {
     'Name': 'SHORTCUT_NAME',
     'mimeType': 'application/vnd.google-apps.shortcut',
     'shortcutDetails': {
        'targetId': file.get('id')
     }
}
shortcut = drive_service.files().create(body=shortcut_metadata,
                                    fields='id,shortcutDetails').execute()
print('File ID: %s, Shortcut Target ID: %s, Shortcut Target MIME type: %s' % (
    shortcut.get('id'),
    shortcut.get('shortcutDetails').get('targetId'),
    shortcut.get('shortcutDetails').get('targetMimeType')))
```

### Node.js

```
var fileMetadata = {
  'name': 'FILE_NAME',
  'mimeType': 'text/plain'
};
drive.files.create({
  'resource': fileMetadata,
  'fields': 'id'
}, function (err, file) {
  if (err) {
    // Handle error
    console.error(err);
  } else {
    console.log('File Id: ' + file.id);
    shortcutMetadata = {
      'name': 'SHORTCUT_NAME',
      'mimeType': 'application/vnd.google-apps.shortcut'
      'shortcutDetails': {
        'targetId': file.id
      }
    };
    drive.files.create({
      'resource': shortcutMetadata,
      'fields': 'id,name,mimeType,shortcutDetails'
    }, function(err, shortcut) {
      if (err) {
        // Handle error
        console.error(err);
      } else {
        console.log('Shortcut Id: ' + shortcut.id +
                    ', Name: ' + shortcut.name +
                    ', target Id: ' + shortcut.shortcutDetails.targetId +
                    ', target MIME type: ' + shortcut.shortcutDetails.targetMimeType);
      }
    }
  }
});
```

Replace the following:

* FILE\_NAME: the file name requiring a shortcut.
* SHORTCUT\_NAME: the name for this shortcut.

By default, the shortcut is created on the current user's My
Drive and shortcuts are only created for files or folders for
which the current user has access.

## Search for a shortcut

To search for a shortcut, use the query string `q` with
[`files.list`](https://developers.google.com/workspace/drive/api/v3/reference/files/list) to filter the shortcuts to
return.

`mimeType operator values`

Where:

* *query\_term* is the query term or field to search upon. To view the query
  terms that can be used to filter shared drives, refer to [Search query
  terms](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#file_properties).
* *operator* specifies the condition for the query term. To view which
  operators you can use with each query term, refer to [Query operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#operators).
* *values* are the specific values you want to use to filter your search
  results.

For example, the following query string filters the search to return all
shortcuts to spreadsheet files:

```
q: mimeType='application/vnd.google-apps.shortcut' AND shortcutDetails.targetMimeType='application/vnd.google-apps.spreadsheet'
```
