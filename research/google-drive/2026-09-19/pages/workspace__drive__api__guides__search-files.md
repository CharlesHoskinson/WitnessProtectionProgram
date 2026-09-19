# Search for files and folders Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/search-files

Retrieved: 2026-09-19T16:29:46.155725+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This guide explains how the Google Drive API supports several ways to search for
files and folders.

You can use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method on the
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource to return all or some of a
Drive user's files and folders. You can also use the `list`
method to retrieve the `fileId` required for some resource methods (such as the
[`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) and [`update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update) methods).

## Use the fields parameter

If you want to specify the fields to return in the response, you can set the
`fields` [system
parameter](https://cloud.google.com/apis/docs/system-parameters#definitions)
with any method of the `files` resource. If you omit the `fields` parameter, the
server returns a default set of fields specific to the method. For example, the
[`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method returns only the `kind`, `id`,
`name`, `mimeType`, and `resourceKey` fields for each file. To return different
fields, see [Return specific fields](https://developers.google.com/workspace/drive/api/guides/fields-parameter).

## Get a file by ID

To get a file, use the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method on the
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource with the `fileId` path parameter.
If you don't know the file ID, you can [list all files](https://developers.google.com/workspace/drive/api/guides/search-files#all) using the `list`
method.

The method returns the file as an instance of a `files` resource. If you provide
the `alt=media` parameter, then the response includes the file contents in the
response body. To download a blob file, see [Download blob file content](https://developers.google.com/workspace/drive/api/guides/manage-downloads#download-content).

To acknowledge the risk of downloading known malware or other
[abusive](https://support.google.com/docs/answer/148505) files, set the
`acknowledgeAbuse` query parameter to `true`. This field is only applicable when
the `alt=media` parameter is set and the user is either the file owner or an
organizer of the shared drive in which the file resides.

## List all files and folders in My Drive

Use the `list` method without any parameters to return all files and folders in
the current user's My Drive.

The following curl command shows how to list all files:

```
curl -X GET \
  'https://www.googleapis.com/drive/v3/files' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Accept: application/json'
```

Replace ACCESS\_TOKEN with an authorized
[OAuth 2.0 access token](https://developers.google.com/workspace/guides/create-credentials).

## Search for specific files and folders in My Drive

To search for a specific set of files or folders in the current user's My
Drive, use the query string `q` field with the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method to filter the files to return by combining
one or more search terms.

The query string syntax contains the following three parts:

*`query_term operator values`*

Where:

* *`query_term`* is the query term or field to search upon.
* *`operator`* specifies the condition for the query term.
* *`values`* are the specific values you want to use to filter your search
  results.

For example, the following query string filters the search to only return
folders by setting the [MIME type](https://developers.google.com/workspace/drive/api/guides/mime-types):

```
mimeType = 'application/vnd.google-apps.folder'
```

To view all file query terms, see [File-specific query terms](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#file-properties).

To view all query operators that you can use to construct a query, see [Query
operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms#operators).

### Query string examples

The following table lists examples of some basic query strings. The actual code
differs depending on the client library you use for your search.

**Important:** The following query terms use fields from the [Drive API
v3](https://developers.google.com/workspace/drive/api/reference/rest/v3). Some resource fields changed between v2 and v3. For
example, `name` replaces `title`. If you're using [Drive API
v2](https://developers.google.com/workspace/drive/api/reference/rest/v2), adjust these queries to use the v2
fields. For more information, see [Drive API v2 and v3 comparison
reference](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference).

You must also escape special characters in your file names to make sure the
query works correctly. For example, if a filename contains both an apostrophe
(`'`) and a backslash (`"\"`) character, use a backslash to escape them: `name
contains 'quinn\'s paper\\essay'`.

**Note:** These examples use the unencoded `q` parameter, where `name = 'hello'` is
encoded as `name+%3d+%27hello%27`. Client libraries handle this encoding
automatically.

| What to query | Example |
| --- | --- |
| **String match operator (`contains`)** | |
| Files that contain the word "hello" | `fullText contains 'hello'` |
| Files that contain the exact phrase "hello world" | `fullText contains '"hello world"'` |
| Files with a query that contains the "\" character (for example, "\authors") | `fullText contains '\\authors'` |
| Files with a name containing "budget" | `name contains 'budget'` |
| **Equality and inequality operators (`=`, `!=`)** | |
| Files with the name "hello" | `name = 'hello'` |
| Files that are folders | `mimeType = 'application/vnd.google-apps.folder'` |
| Files that aren't folders | `mimeType != 'application/vnd.google-apps.folder'` |
| Files that are starred | `starred = true` |
| Files that are in the trash | `trashed = true` |
| Files that aren't in the trash | `trashed = false` |
| Shortcuts that point to a specific file ID | `shortcutDetails.targetId = '1987654321'` |
| Files that haven't been shared with anyone or domains (private, or shared with specific users or groups) | `visibility = 'limited'` |
| Files that are accessible to anyone with the link | `visibility = 'anyoneWithLink'` |
| Files that are publicly discoverable on the web | `visibility = 'anyoneCanFind'` |
| **Comparison operators (`>`, `>=`, `<`, `<=`)** | |
| Files modified after a given date (default time zone is UTC) | `modifiedTime > '2012-06-04T12:00:00'` |
| Files created after January 1, 2023 | `createdTime > '2023-01-01T00:00:00'` |
| Files modified before January 1, 2023 | `modifiedTime < '2023-01-01T00:00:00'` |
| **Collection membership operator (`in`)** | |
| Files within a collection (for example, the folder ID in the `parents` collection) | `'1234567' in parents` |
| Files in the [application data folder](https://developers.google.com/workspace/drive/api/guides/appdata) | `'appDataFolder' in parents` |
| Files for which user "test@example.org" is the owner | `'test@example.org' in owners` |
| Files for which user "test@example.org" has write permission | `'test@example.org' in writers` |
| Files for which members of the group "group@example.org" have write permission | `'group@example.org' in writers` |
| Files for which user "test@example.org" has read permission | `'test@example.org' in readers` |
| **Collection matching operator (`has`)** | |
| Files with a custom file property visible to all apps | `properties has { key='mass' and value='1.3kg' }` |
| Files with a custom file property private to the requesting app | `appProperties has { key='additionalID' and value='8e8aceg2af2ge72e78' }` |
| Files that have a custom file property with the key "department" (regardless of value) | `properties has { key='department' }` |
| **Logical operators (`and`, `or`, `not`)** | |
| Files with a name containing the words "hello" and "goodbye" | `name contains 'hello' and name contains 'goodbye'` |
| Files with a name that doesn't contain the word "hello" | `not name contains 'hello'` |
| Files that contain the text "important" and are in the trash | `fullText contains 'important' and trashed = true` |
| Files that don't contain the word "hello" | `not fullText contains 'hello'` |
| Image or video files modified after a specific date | `modifiedTime > '2012-06-04T12:00:00' and (mimeType contains 'image/' or mimeType contains 'video/')` |
| Files shared with the authorized user that have "hello" in the name | `sharedWithMe and name contains 'hello'` |
| Files that are folders or shortcuts | `mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.shortcut'` |
| Files with the name "Project Plan" that aren't in the trash | `name = 'Project Plan' and trashed = false` |
| Files in a specific folder that aren't in the trash | `'1234567' in parents and trashed = false` |

### Filter search results with a client library

The following code sample shows how to use a client library to filter search
results to file names and IDs of JPEG files. This sample uses the `mimeType`
query term to narrow results to files of type `image/jpeg`. It also sets
`spaces` to `drive` to further narrow the search to the [Drive
space](https://developers.google.com/workspace/drive/api/guides/about-files#org). When `nextPageToken` returns `null`,
there are no more results.

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Java

drive/snippets/drive\_v3/src/main/java/SearchFile.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/SearchFile.java)

```
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/* Class to demonstrate use-case of search files. */
public class SearchFile {

  /**
   * Search for specific set of files.
   *
   * @return search result list.
   * @throws IOException if service account credentials file not found.
   */
  public static List<File> searchFile() throws IOException {
           /*Load pre-authorized user credentials from the environment.
           TODO(developer) - See https://developers.google.com/identity for
           guides on implementing OAuth2 for your application.*/
    GoogleCredentials credentials = GoogleCredentials.getApplicationDefault()
        .createScoped(Arrays.asList(DriveScopes.DRIVE_FILE));
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    Drive service = new Drive.Builder(new NetHttpTransport(),
        GsonFactory.getDefaultInstance(),
        requestInitializer)
        .setApplicationName("Drive samples")
        .build();

    List<File> files = new ArrayList<File>();

    String pageToken = null;
    do {
      FileList result = service.files().list()
          .setQ("mimeType='image/jpeg'")
          .setSpaces("drive")
          .setFields("nextPageToken, files(id, title)")
          .setPageToken(pageToken)
          .execute();
      for (File file : result.getFiles()) {
        System.out.printf("Found file: %s (%s)\n",
            file.getName(), file.getId());
      }

      files.addAll(result.getFiles());

      pageToken = result.getNextPageToken();
    } while (pageToken != null);

    return files;
  }
}
```

### Python

drive/snippets/drive-v3/file\_snippet/search\_file.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/file_snippet/search_file.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def search_file():
  """Search file in drive location

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)
    files = []
    page_token = None
    while True:
      # pylint: disable=maybe-no-member
      response = (
          service.files()
          .list(
              q="mimeType='image/jpeg'",
              spaces="drive",
              fields="nextPageToken, files(id, name)",
              pageToken=page_token,
          )
          .execute()
      )
      for file in response.get("files", []):
        # Process change
        print(f'Found file: {file.get("name")}, {file.get("id")}')
      files.extend(response.get("files", []))
      page_token = response.get("nextPageToken", None)
      if page_token is None:
        break

  except HttpError as error:
    print(f"An error occurred: {error}")
    files = None

  return files


if __name__ == "__main__":
  search_file()
```

### Node.js

drive/snippets/drive\_v3/file\_snippets/search\_file.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/file_snippets/search_file.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Searches for files in Google Drive.
 * @return {Promise<object[]>} A list of files.
 */
async function searchFile() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // Search for files with the specified query.
  const result = await service.files.list({
    q: "mimeType='image/jpeg'",
    fields: 'nextPageToken, files(id, name)',
    spaces: 'drive',
  });

  // Print the name and ID of each found file.
  (result.data.files ?? []).forEach((file) => {
    console.log('Found file:', file.name, file.id);
  });

  return result.data.files ?? [];
}
```

### PHP

drive/snippets/drive\_v3/src/DriveSearchFiles.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveSearchFiles.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function searchFiles()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $files = array();
        $pageToken = null;
        do {
            $response = $driveService->files->listFiles(array(
                'q' => "mimeType='image/jpeg'",
                'spaces' => 'drive',
                'pageToken' => $pageToken,
                'fields' => 'nextPageToken, files(id, name)',
            ));
            foreach ($response->files as $file) {
                printf("Found file: %s (%s)\n", $file->name, $file->id);
            }
            array_push($files, $response->files);

            $pageToken = $response->pageToken;
        } while ($pageToken != null);
        return $files;
    } catch(Exception $e) {
       echo "Error Message: ".$e;
    }
}
```

## List files in a public folder

To search for or list files in a publicly shared folder (where access is set to
"Anyone with the link" or "Public on the web"), use the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method on the `files` resource with the `q` query
parameter set to filter by the folder's ID in the `parents` collection:

```
'FOLDER_ID' in parents and trashed = false
```

When listing files in a public folder, you can authenticate requests using an
[API key](https://developers.google.com/workspace/guides/create-credentials#api-key) instead of OAuth 2.0
user credentials. If the folder is located within a shared drive, you must
also set `supportsAllDrives=true` and `includeItemsFromAllDrives=true` on the
request.

The following code samples show how to list files in a public folder:

### Node.js

```
/**
 * List files in a public folder using an API key.
 * @param {string} folderId The ID of the public folder.
 * @param {string} apiKey Your Google Cloud API key.
 * @return {Promise<Array>} The list of files.
 */
async function listPublicFolder(folderId, apiKey) {
  const {google} = require('googleapis');
  const service = google.drive({version: 'v3', auth: apiKey});

  try {
    const response = await service.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = response.data.files;
    console.log('Files:');
    for (const file of files) {
      console.log(`${file.name} (${file.id})`);
    }
    return files;
  } catch (err) {
    // TODO(developer): Handle error
    console.error(err);
  }
}
```

### curl

```
curl -G \
  'https://www.googleapis.com/drive/v3/files' \
  --data-urlencode "q='FOLDER_ID' in parents and trashed = false" \
  --data-urlencode 'supportsAllDrives=true' \
  --data-urlencode 'includeItemsFromAllDrives=true' \
  --data-urlencode 'fields=nextPageToken,files(id,name,mimeType)' \
  --data-urlencode 'key=API_KEY' \
  -H 'Accept: application/json'
```

Replace the following:

* FOLDER\_ID: The ID of the public folder.
* API\_KEY: Your project's [API
  key](https://developers.google.com/workspace/guides/create-credentials#api-key).

## Search for files with custom properties

To search for files with a custom file property, use either the `properties` or
the `appProperties` search query term with a key and value. For example, to
search for a custom file property that's private to the requesting app called
`additionalID` with a value of `8e8aceg2af2ge72e78`:

```
appProperties has { key='additionalID' and value='8e8aceg2af2ge72e78' }
```

For more information, see [Add custom file
properties](https://developers.google.com/workspace/drive/api/guides/properties).

## Search for files by label or field value

To search for files with specific labels, use the `labels` search query term
with a specific label ID.

To search for files that have a specific label applied:

```
'labels/LABEL_ID' in labels
```

To search for files that don't have a specific label applied:

```
not 'labels/LABEL_ID' in labels
```

To search for files based on a specific label field value:

```
labels/LABEL_ID.FIELD_ID = 'VALUE'
```

If successful, the response body contains all file instances that match the
query. For more information, see [Search for files with a specific label or
field value](https://developers.google.com/workspace/drive/api/guides/search-labels).

## Search across corpora

By default, the `user` item collection is set on the [`corpora`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.QUERY_PARAMETERS.corpora) query parameter
when the [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) method is used. To search other
item collections, such as those shared with a `domain`, you must explicitly set
the `corpora` parameter.

You can search multiple corpora in a single query; however, if the combined
corpora is too large, the API might return incomplete results. Check the
[`incompleteSearch`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.incomplete_search)
field in the response body. If it's `true`, then some documents were omitted. To
resolve this, narrow the `corpora` to use either `user` or `drive`.

When using the
[`orderBy`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list#body.QUERY_PARAMETERS.order_by) query
parameter on the `list` method, avoid using the `createdTime` key for queries on
large item collections as it requires additional processing and it might result
in timeouts or other issues. For time-related sorting on large item collections,
you can use `modifiedTime` instead as it's optimized to handle these queries.
For example, set `orderBy` to `modifiedTime` (or `modifiedTime desc`).

If you omit the `orderBy` query parameter, there's no default sort order and the
items are returned arbitrarily.

## Related topics

* [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives)
* [Search query terms and operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms)
* [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types)
* [Roles and permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
* [Search for files with a specific label or field value](https://developers.google.com/workspace/drive/api/guides/search-labels)
