# Search for files with a specific label or field value Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/search-labels

Retrieved: 2026-09-19T16:30:21.499021+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This document describes how to search for files with a specific label or field
value applied.

## Label field types

Google Drive label fields are strongly typed with each type supporting
different indexing and search semantics. The following table shows the available
data types:

| Type | Label type options | Supported search operators |
| --- | --- | --- |
| Text | TextOptions | `is null, is not null, =, contains, starts with` |
| Integer | IntegerOptions | `is null, is not null, =, !=, <, >, <=, >=` |
| Date | DateOptions | `is null, is not null, =, !=, <, >, <=, >=` |
| Selection | SelectionOptions | `is null, is not null, =, !=` |
| User | UserOptions | `is null, is not null, =, !=` |
| Selection List | SelectionOptions (with max\_entries > 1) | `is null, is not null, in, not in` |
| User List | UserOptions (with max\_entries > 1) | `is null, is not null, in, not in` |

### Search examples

**Note:** In the following examples, readable strings are used for clarity. Actual
resource names and field IDs must be used instead. For example,
`labels/contract.execution_date` might look something like this:
`labels/837d7f5de85137b86e52.491d`.

**1. Search based on the presence of a label or field**

You can search for items where a specific label has (or has not) been applied:

* `'labels/contract' in labels`
* `not 'labels/contract' in labels`

You can also search for items where a specific field has (or has not) been set:

* `labels/contract.comment IS NOT NULL`
* `labels/contract.comment IS NULL`

**Note:** Searching for files without any fields set returns items that the label
has not been applied to. You can combine the preceding queries to find items
where the label is applied, but doesn't contain a value for a specific field:
`'labels/contract' in labels AND labels/contract.comment IS NULL`.

**2. Search based on single-valued fields**

You can write search queries to match expected field values. The following table
shows the valid field queries:

| What you want to query | Query string |
| --- | --- |
| Items where comment is set to "hello" | `labels/contract.comment = 'hello'` |
| Files where comment starts with "hello" | `labels/contract.comment STARTS WITH 'hello'` |
| Files where status is executed | `labels/contract.status = 'executed'` |
| Files where status is not executed | `labels/contract.status != 'executed'` |
| Files where execution\_date is before a specific date | `labels/contract.execution_date < '2020-06-22'` |
| Files where value\_usd (integer) is less than a specific value | `labels/contract.value_usd < 2000` |
| Files where client\_contact is set to a specific email address | `labels/contract.client_contact = 'alex@altostrat.com'` |

**3. Search based on fields with multivalued fields (such as
ListOptions.max\_entries > 1)**

Fields that support multiple values can only be queried using the IN operator:

* `'EMAIL_ADDRESS' IN labels/project.project_leads`
* `NOT 'EMAIL_ADDRESS' IN labels/project.project_leads`

## Example

The following code sample shows how to use one or more `labelId` to list all
files with a specific label or field value from a Drive [file
resource](https://developers.google.com/workspace/drive/labels/reference/rest/v2/labels). It also uses the
[`files.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method. The
request body must be empty.

If you want to include `labelInfo` in the response, you also must specify:

* [`includeLabels`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get#query-parameters)
  as a comma-separated list of IDs.
* `labelInfo` in the `fields` parameter to denote that you want the
  `labelInfo` returned within `includeLabels`.

If successful, the [response
body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#response-body) contains
the list of files.

### Java

```
List<File> fileList = driveService.files().list()
    .setIncludeLabels("LABEL_1_ID,LABEL_2_ID")
    .setFields("files(labelInfo, id)")
    .setQ("'labels/LABEL_1_ID' in labels and 'labels/LABEL_2_ID' in labels")
    .execute()
    .getFiles();
```

### Python

```
file_list = drive_service.files().list(
    includeLabels="LABEL_1_ID,LABEL_2_ID",
    q="'labels/LABEL_1_ID' in labels and 'labels/LABEL_2_ID' in labels",
    fields="files(labelInfo, id)"
).execute()
```

### Node.js

```
/**

*   Search for Drive files with specific labels
*   @return{obj} file list with labelInfo
**/
async function searchForFileWithLabels() {
  // Get credentials and build service
  // TODO (developer) - Use appropriate auth mechanism for your app

  const {GoogleAuth} = require('google-auth-library');
  const {google} = require('googleapis');

  const auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/drive'});
  const service = google.drive({version: 'v3', auth});
  try {
    const fileList = await service.files.list({
      includeLabels: 'LABEL_1_ID,LABEL_2_ID',
      q: '\'labels/LABEL_1_ID\' in labels and \'labels/LABEL_2_ID\' in labels',
      fields:'files(labelInfo, id)',
    });
    return fileList;
  } catch (err) {
    // TODO (developer) - Handle error
    throw err;
  }
}
```

Replace the following:

* LABEL\_1\_ID: The first `labelId` of a label to return.
* LABEL\_2\_ID: The second `labelId` of a label to return.
