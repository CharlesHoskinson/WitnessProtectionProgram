# Return a label from a file resource Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/return-labels

Retrieved: 2026-09-19T16:30:20.611242+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This page describes how to return specific labels from a Google Drive file
resource.

To specify which labels that you want to retrieve, use the
[`files.get`](https://developers.google.com/workspace/drive/api/v2/reference/files/get) method or any method that
returns a [file resource](https://developers.google.com/workspace/drive/labels/reference/rest/v2/labels). The request
body must be empty.

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/get#response-body) contains an instance
of [`File`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files#File).

## Example

The following code sample shows how to use the `fileId`, plus the `labelId`, to
return the set of specific labels. The
[`includeLabels`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/get#query-parameters)
object is a comma-separated list of IDs. The `labelInfo`object in the `fields`
parameter contains labels set on the file and requested within `includeLabels`.

### Java

```
File file = driveService.files()
    .get("FILE_ID")s
    .setIncludeLabels("LABEL_ID,LABEL_ID")
    .setFields("labelInfo")
    .execute();
```

### Python

```
file = drive_service.files().get(
    fileId="FILE_ID",
    includeLabels="LABEL_ID,LABEL_ID",
    fields="labelInfo"
).execute()
```

### Node.js

```
/**
 * Get a Drive file with specific labels
 * @return{obj} file with labelInfo
 **/
async function getFileWithSpecificLabels() {
  // Get credentials and build service
  // TODO (developer) - Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });
  const service = google.drive({version: 'v3', auth});
  try {
    const file = await service.files.get({
      fileId: 'FILE_ID',
      includeLabels: 'LABEL_ID,LABEL_ID',
      fields: 'labelInfo',
    });
    return file;
  } catch (err) {
    // TODO (developer) - Handle error
    throw err;
  }
}
```

Replace the following:

* FILE\_ID: The `fileId` of the file containing the labels.
* LABEL\_ID: The `labelId` of a label to return. To locate
  the labels on a file, use the
  [`files.listLabels`](https://developers.google.com/workspace/drive/api/v2/reference/files/listLabels) method.

## Notes

* Any method returning a [file
  resource](https://developers.google.com/workspace/drive/labels/reference/rest/v2/labels) supports the
  `includeLabels` field and query parameter. For example,
  [`files.copy`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/copy),
  [`files.list`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/list), and
  [`files.update`](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/update).
