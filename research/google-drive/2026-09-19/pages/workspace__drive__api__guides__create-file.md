# Create and manage files Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/create-file

Retrieved: 2026-09-19T16:29:36.186070+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This guide explains how to create and manage files in Google Drive using the
Google Drive API.

## Create file

To create a file in Drive that contains content (media), you must
upload file data. You can upload a file's metadata and content together in a
single request (multipart upload) or upload only media (simple upload). For more
information, see [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

To create a file that contains no metadata or content, use the [`create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) method on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with no parameters.

When you create the file, the method returns a `files` resource. The file is
given a `kind` of `drive.file`, an `id`, a `name` of "Untitled", and a
`mimeType` of `application/octet-stream`. The
[`uploadType`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#body.QUERY_PARAMETERS.upload_type)
is marked as required but defaults to `media`, so you don't actually have to
supply it.

For more information about Drive file limits, see [File and
folder limits](https://developers.google.com/workspace/drive/api/guides/folder#folder-limits).

**Note:** When a Drive user wants to download a file, or when the
file is downloaded through the sync client, Drive builds a full
filename (with extension) based on the name. In cases where the extension is
missing, Drive attempts to determine the extension based on the
file's [MIME type](https://developers.google.com/workspace/drive/api/guides/mime-types).

The following code samples show how to create a file with no metadata or
content:

### Node.js

```
/**
 * Create an empty file.
 * @return {string} The created file's ID.
 */
async function createEmptyFile() {
  // Get credentials and build service
  // TODO(developer): Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/drive'});
  const service = google.drive({version: 'v3', auth});

  try {
    const response = await service.files.create({});
    console.log('File ID: ' + response.data.id);
    return response.data.id;
  } catch (err) {
    // TODO(developer): Handle error
    console.error(err);
  }
}
```

### curl

```
curl -X POST 'https://www.googleapis.com/drive/v3/files' \
 -H 'Authorization: Bearer ACCESS_TOKEN'
```

Replace the following:

* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.

## Use the fields parameter

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions)
with any method of the `files` resource. If you omit the `fields` parameter, the
server returns a default set of fields specific to the method. For example, the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method returns only the `kind`, `id`,
`name`, `mimeType`, and `resourceKey` fields for each file. To return different
fields, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

## File ownership

When a file is created using the Drive API, ownership depends on the
authentication credentials used by the app in the following ways:

* **User account (OAuth 2.0)**: If the application authenticates on behalf of
  a user, that user becomes the file owner. The file then resides in their My
  Drive folder or a [specified
  folder](https://developers.google.com/workspace/drive/api/guides/folder#create-file). It consumes their storage quota.
* **Service Account**: If the application authenticates using a Service
  Account, the Service Account is the file owner. The file then resides in the
  Service Account's dedicated Drive storage. Files don't appear
  within other Drive storage accounts unless explicitly shared.
  If the Service Account is deleted, all files it owns are deleted
  immediately.

  If you're using a Service Account but want a specific user account to own a
  file, use Domain-Wide Delegation. This allows the Service Account to
  impersonate a user and to create files on their behalf. For more
  information, see [Delegate domain-wide authority to the service
  account](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority).

For more information about file permissions, see [Share files, folders, and
drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

## Generate IDs to use with your files

The [`generateIds`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) method on the
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource lets you pre-generate unique file
IDs that can be used when creating or copying files and folders in
Drive. This can be useful when you need to control the file IDs
from your app, rather than letting Drive assign them
automatically.

You can set the number of IDs generated using the
[`count`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.QUERY_PARAMETERS.count)
query parameter. If `count` is not set, 10 are returned by default. The maximum
number of IDs you can request is capped at 1,000.

You can also designate the
[`space`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.QUERY_PARAMETERS.space) in
which the IDs can be used and the
[`type`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.QUERY_PARAMETERS.type) of
items which the IDs can be used for.

Once an ID is generated, it can be passed to the `create` or `copy` method
through the `id` field. This ensures that the created or copied file uses the
predetermined ID.

If the file is successfully created or copied, subsequent retries return a `409
Conflict` HTTP status code response and duplicate files aren't created.

Note that pre-generated IDs aren't supported for the creation of
Google Workspace files, except for the `application/vnd.google-apps.drive-sdk`
and `application/vnd.google-apps.folder` [MIME
types](https://developers.google.com/workspace/drive/api/guides/mime-types). Similarly, uploads referencing a conversion
to a Google Workspace file format aren't supported.

The following code samples show how to pre-generate unique file IDs:

### Node.js

```
/**
 * Pre-generate unique file IDs.
 */
async function generateFileIds() {
  // Get credentials and build service
  // TODO(developer): Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/drive'});
  const service = google.drive({version: 'v3', auth});

  try {
    const response = await service.files.generateIds({
      count: 10,
      space: 'drive'
    });
    const ids = response.data.ids;
    console.log('Generated IDs:');
    for (const id of ids) {
      console.log(id);
    }
  } catch (err) {
    // TODO(developer): Handle error
    console.error(err);
  }
}
```

### curl

```
curl 'https://www.googleapis.com/drive/v3/files/generateIds?count=10&space=drive' \
 -H 'Authorization: Bearer ACCESS_TOKEN'
```

Replace the following:

* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.

## Create metadata-only files

Metadata-only files contain no content. Metadata is data (such as `name`,
`mimeType`, and `createdTime`) that describes the file. Fields like `name` are
user-agnostic and appear the same for each user, whereas fields such as
`viewedByMeTime` contain user-specific values.

One example of a metadata-only file is a folder with the MIME type
`application/vnd.google-apps.folder`. For more information, see [Create and
populate folders](https://developers.google.com/workspace/drive/api/guides/folder). Another example is a shortcut that
points to another file on Drive with the MIME type
`application/vnd.google-apps.shortcut`. For more information, see [Create a
shortcut to a Drive file](https://developers.google.com/workspace/drive/api/guides/shortcuts).

## Manage thumbnail images

Thumbnails help users identify Drive files. Drive
can automatically generate thumbnails for common file types or you can provide a
thumbnail image generated by your app. For more information, see [Upload
thumbnails](https://developers.google.com/workspace/drive/api/guides/file#upload-thumbnails).

## Copy an existing file

To copy a file, and apply any requested updates, use the [`copy`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy) method on the `files` resource. To find the
`fileId` to copy, use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method.

You can apply updates through patch semantics, meaning you can make partial
modifications to a resource. You must explicitly set the fields that you intend
to modify in your request. Any fields not included in the request retain their
existing values. For more information, see [Working with partial resources](https://developers.google.com/workspace/drive/api/guides/performance#partial).

You can pre-set the file ID of the copied file using the [`generateIds`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) method. For more information, see
[Generate IDs to use with your files](https://developers.google.com/workspace/drive/api/guides/create-file#generate-ids).

Note that you need to use an appropriate [Drive API
scope](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#authorization-scopes) to authorize the
call. For more information on Drive scopes, see [Choose
Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

The following code samples show how to copy a file and update its name:

### Node.js

```
/**
 * Copy an existing file.
 * @return {string} The copied file's ID.
 */
async function copyFile() {
  // Get credentials and build service
  // TODO(developer): Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/drive'});
  const service = google.drive({version: 'v3', auth});

  try {
    const response = await service.files.copy({
      fileId: 'FILE_ID',
      requestBody: {
        name: 'FILE_COPY_NAME'
      }
    });
    console.log('Copied file ID: ' + response.data.id);
    return response.data.id;
  } catch (err) {
    // TODO(developer): Handle error
    console.error(err);
  }
}
```

Replace the following:

* FILE\_ID: The ID of the file to copy.
* FILE\_COPY\_NAME: The name of the new file.

### curl

```
curl -X POST 'https://www.googleapis.com/drive/v3/files/FILE_ID/copy' \
 -H 'Authorization: Bearer ACCESS_TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{
    "name": "FILE_COPY_NAME"
 }'
```

Replace the following:

* FILE\_ID: The ID of the file to copy.
* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.
* FILE\_COPY\_NAME: The name of the new file.

### Copy comments

To copy comments and suggestions when you copy a Google Docs,
Sheets, or Slides file, set the [`copyComments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.QUERY_PARAMETERS.copy_comments) query
parameter to `true`. Drive copies only open comments (unresolved
comments). For other file types, Drive ignores this parameter.

For more information about permissions, comment attribution, and access
considerations, see [Limits and considerations](https://developers.google.com/workspace/drive/api/guides/create-file#limits-considerations).

### Limits and considerations

As you prepare to copy files, take note of these limits and considerations:

* **Permissions**:

  + The [`DownloadRestrictionsMetadata`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestrictionsmetadata)
    object of the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource determines
    who can copy the file. For more information, see [Prevent users from
    downloading, printing, or copying your
    file](https://developers.google.com/workspace/drive/api/guides/content-restrictions#download-print-copy).
  + The [`capabilities.canCopy`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_8)
    field resource determines whether the user can copy a file. For more
    information, see [Understand file
    capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities).
  + To copy comments, you must have permission to read comments on the
    source file. If you don't have permission to read comments, and you set
    `copyComments` to `true`, the copy operation still succeeds, but
    comments aren't copied.
  + Copying comments doesn't grant the original comment authors access to
    the new file. The new file's Access Control Lists (ACLs) are
    independent of the source file's ACLs.
  + The user that created the copy owns the copied file. No other sharing
    settings from the source file are replicated. If the copy is created in
    a shared folder, it inherits the permissions of that folder.
  + A copied file's ownership might change and the copy might not inherit
    the original file's sharing settings. These settings might need to be
    reset.
* **File management**:

  + Some files, like [third-party
    shortcuts](https://developers.google.com/workspace/drive/api/guides/third-party-shortcuts), can never be copied.
  + You can only copy a file into one parent folder. Specifying multiple
    parents isn't supported. If the
    [`parents`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.parents) field isn't
    specified, the file inherits any discoverable parents from the source
    file.
  + Even though a folder is a type of file, you can't copy a folder.
    Instead, create a destination folder and set the `parents` field of the
    existing files to the destination folder. You can then delete the
    original source folder.
  + Unless a new filename is specified, the `copy` method produces a file
    with the same name as the original.
  + Excessive use of `copy` can lead to exceeding your Drive API
    quota limits. For more information, see [Usage
    limits](https://developers.google.com/workspace/drive/api/guides/limits).

## Related topics

Here are a few next steps you might try:

* To upload file data when you create or update a file, see [Upload file
  data](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
* To create a file in a specific folder, see [Create a file in a specific
  folder](https://developers.google.com/workspace/drive/api/guides/folder#create-file).
* To move files, see [Move files between
  folders](https://developers.google.com/workspace/drive/api/guides/folder#move-files).
* To work with file metadata, see [Manage file metadata](https://developers.google.com/workspace/drive/api/guides/file).
* To delete a file, see [Trash or delete files and
  folders](https://developers.google.com/workspace/drive/api/guides/delete).
