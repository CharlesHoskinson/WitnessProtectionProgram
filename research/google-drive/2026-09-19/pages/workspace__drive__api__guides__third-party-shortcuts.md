# Create a shortcut file to content stored by your app Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/third-party-shortcuts

Retrieved: 2026-09-19T16:29:59.954352+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

*Third-party shortcuts* in Google Drive are metadata-only files that link to
other files on external, third-party owned, storage systems. These shortcuts act
as reference links to the "content" files stored by an application outside of
Drive, usually in a different datastore or cloud storage system.

To create a third-party shortcut, use the
[`files.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) method of the Google Drive API
and set the MIME type to `application/vnd.google-apps.drive-sdk`. Don't upload
any content when creating the file. For more information, see [Google Workspace and Google Drive supported MIME
types](https://developers.google.com/workspace/drive/api/guides/mime-types).

You cannot upload or download third-party shortcuts.

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

The following code samples show how to create a third-party shortcut using a
client library:

### Java

drive/snippets/drive\_v3/src/main/java/CreateShortcut.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/CreateShortcut.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Arrays;

/* Class to demonstrate Drive's create shortcut use-case */
public class CreateShortcut {

  /**
   * Creates shortcut for file.
   *
   * @throws IOException if service account credentials file not found.
   */
  public static String createShortcut() throws IOException {
        /* Load pre-authorized user credentials from the environment.
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
    try {
      // Create Shortcut for file.
      File fileMetadata = new File();
      fileMetadata.setName("Project plan");
      fileMetadata.setMimeType("application/vnd.google-apps.drive-sdk");

      File file = service.files().create(fileMetadata)
          .setFields("id")
          .execute();
      System.out.println("File ID: " + file.getId());
      return file.getId();
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to create shortcut: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/file\_snippet/create\_shortcut.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/file_snippet/create_shortcut.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def create_shortcut():
  """Create a third party shortcut

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)
    file_metadata = {
        "name": "Project plan",
        "mimeType": "application/vnd.google-apps.drive-sdk",
    }

    # pylint: disable=maybe-no-member
    file = service.files().create(body=file_metadata, fields="id").execute()
    print(f'File ID: {file.get("id")}')

  except HttpError as error:
    print(f"An error occurred: {error}")
  return file.get("id")


if __name__ == "__main__":
  create_shortcut()
```

### PHP

drive/snippets/drive\_v3/src/DriveCreateShortcut.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveCreateShortcut.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
function createShortcut()
{
    try {

        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $fileMetadata = new DriveFile(array(
            'name' => 'Project plan',
            'mimeType' => 'application/vnd.google-apps.drive-sdk'));
        $file = $driveService->files->create($fileMetadata, array(
            'fields' => 'id'));
        printf("File ID: %s\n", $file->id);
        return $file->id;

    } catch(Exception $e) {
        echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/CreateShortcut.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/CreateShortcut.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate Drive's create shortcut use-case
    public class CreateShortcut
    {
        /// <summary>
        /// Create a third party shortcut.
        /// </summary>
        /// <returns>newly created shortcut file id, null otherwise.</returns>
        public static string DriveCreateShortcut()
        {
            try
            {
                /* Load pre-authorized user credentials from the environment.
                 TODO(developer) - See https://developers.google.com/identity for 
                 guides on implementing OAuth2 for your application. */
                GoogleCredential credential = GoogleCredential
                    .GetApplicationDefault()
                    .CreateScoped(DriveService.Scope.Drive);

                // Create Drive API service.
                var service = new DriveService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Drive API Snippets"
                });

                // Create Shortcut for file.
                var fileMetadata = new Google.Apis.Drive.v3.Data.File()
                {
                    Name = "Project plan",
                    MimeType = "application/vnd.google-apps.drive-sdk"
                };
                var request = service.Files.Create(fileMetadata);
                request.Fields = "id";
                var file = request.Execute();
                // Prints the shortcut file id.
                Console.WriteLine("File ID: " + file.Id);
                return file.Id;
            }
            catch (Exception e)
            {
                // TODO(developer) - handle error appropriately
                if (e is AggregateException)
                {
                    Console.WriteLine("Credential Not found");
                }
                else
                {
                    throw;
                }
            }
            return null;
        }
    }
}
```

### Node.js

drive/snippets/drive\_v3/file\_snippets/create\_shortcut.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/file_snippets/create_shortcut.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Creates a shortcut to a third-party resource.
 * @return {Promise<string|null|undefined>} The shortcut ID.
 */
async function createShortcut() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // The metadata for the new shortcut.
  const fileMetadata = {
    name: 'Project plan',
    mimeType: 'application/vnd.google-apps.drive-sdk',
  };

  // Create the new shortcut.
  const file = await service.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  // Print the ID of the new shortcut.
  console.log('File Id:', file.data.id);
  return file.data.id;
}
```

**Note:** If you run these samples using a Service Account (which is the default
when using Application Default Credentials in many environments), the shortcut
file is created in the Service Account's isolated Drive storage.
It won't be visible on the Drive website for your personal user
account unless you either share the file with your user email address or
authorize the request through user OAuth 2.0 credentials. Additionally, for the
shortcut to be functional and to redirect to your app when clicked, you must
configure a [Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk) with an Open URL
and have the corresponding app installed.

## How third-party shortcuts work

When you create a third-party shortcut using the `files.create` method, it uses
a `POST` request to insert the metadata and create a shortcut to your app's
content:

```
POST https://www.googleapis.com/drive/v3/files
Authorization: AUTHORIZATION_HEADER

{
  "title": "FILE_TITLE",
  "mimeType": "application/vnd.google-apps.drive-sdk"
}
```

When the third-party shortcut is clicked, the user is redirected to the external
site where the file is housed. The Drive file ID is contained in
the [`state`](https://developers.google.com/workspace/drive/api/guides/enable-sdk#construct) parameter. For more
information, see [Handle an Open URL for app-specific
documents](https://developers.google.com/workspace/drive/api/guides/integrate-open#app).

The third-party app or website is then responsible for matching the file ID in
the `state` parameter to the content housed within their system.

## Add custom thumbnails and indexable text

To increase the discoverability of files associated with third-party shortcuts,
you can upload both thumbnail images and indexable text when inserting or
modifying the file metadata. For more information, see [Manage file metadata](https://developers.google.com/workspace/drive/api/guides/file).

## Related topics

* [Create a shortcut to a Drive file](https://developers.google.com/workspace/drive/api/guides/shortcuts)
* [Configure a Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk)
* [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types)
