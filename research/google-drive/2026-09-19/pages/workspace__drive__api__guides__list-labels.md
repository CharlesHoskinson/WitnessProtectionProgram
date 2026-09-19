# List labels on a file Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/list-labels

Retrieved: 2026-09-19T16:30:19.599839+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

Your organization can have multiple labels, with labels having any number of
fields. This page describes how to list all labels on a single Google Drive
file.

To list the file labels, use the
[`files.listLabels`](https://developers.google.com/workspace/drive/api/v2/reference/files/listLabels) method. The
request body must be empty. The method also takes the optional query parameter
`maxResults` to set the maximum number of labels to return per page. If not set,
100 results are returned.

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/listLabels#response-body) contains the
list of labels applied to a file. These exist within an `items` object of type
[`Label`](https://developers.google.com/workspace/drive/api/reference/rest/v2/Label).

## Example

The following code sample shows how to use the label's `fileId` to retrieve the
correct labels.

### Java

```
List<Label> labelList = labelsDriveClient.files()
    .listLabels("FILE_ID")
    .execute()
    .getLabels();
```

### Python

```
label_list_response = drive_service.files().listLabels(
    fileId="FILE_ID"
).execute()
```

### Node.js

```
/**
 * Lists all the labels on a Drive file
 * @return{obj} a list of Labels
 **/
async function listLabels() {
  // Get credentials and build service
  // TODO (developer) - Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });
  const service = google.drive({version: 'v3', auth});
  try {
    const labelListResponse = await service.files.listLabels({
      fileId: 'FILE_ID',
    });
    return labelListResponse;
  } catch (err) {
    // TODO (developer) - Handle error
    throw err;
  }
}
```

Replace FILE\_ID with the `fileId` of the file for which you
want the list of labels.
