# Store application-specific data Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/appdata

Retrieved: 2026-09-19T16:29:55.087038+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The *application data folder* is a special hidden folder that your app can use
to store application-specific data, such as configuration files. The application
data folder is automatically created when you attempt to create a file in it.
Use this folder to store any files that the user shouldn't directly interact
with. This folder is only accessible by your app and its contents are hidden
from the user and from other Google Drive apps.

The application data folder is deleted when a user uninstalls your app from
their My Drive. Users can also delete your app's data folder manually.

## Application data folder scope

Before you can access the application data folder, you must request access to
the `https://www.googleapis.com/auth/drive.appdata` non-sensitive scope. For
more information about scopes and how to request access to them, refer to
[Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). For more
information about specific OAuth 2.0 scopes, see [OAuth 2.0 Scopes for Google
APIs](https://developers.google.com/identity/protocols/oauth2/scopes#drive).

## How the application data folder differs from Drive backup folders

The application data folder is separate from your Drive backup
folder.

The application data folder is a configuration folder that's created per
third-party app and each third-party app can store data in it. Only the
application that created the data in the `appDataFolder` can access it. The
folder can't be accessed using the Drive user interface (UI).

Your [Drive backup
folder](https://drive.google.com/drive/backups) is a reserved folder that
Drive writes device backups to and it's visible in the
Drive UI.

## Constraints on the application data folder

The following constraints are enforced when working with the application data
folder:

* You can't share files or folders inside the application data folder.
  Attempting to do so generates a `notSupportedForAppDataFolderFiles` error
  with the following error message: "Method not supported for files within the
  Application Data folder."
* You can't move files in the `appDataFolder` between storage locations
  (spaces). Attempting to do so generates a
  `notSupportedForAppDataFolderFiles` error with the following error message:
  "Method not supported for files within the Application Data folder." For
  more information, see [File
  organization](https://developers.google.com/workspace/drive/api/guides/about-files#file-organization).
* You can't trash files or folders inside the application data folder.
  Attempting to do so generates a `notSupportedForAppDataFolderFiles` error
  with the following error message: "Files within the Application Data folder
  cannot be trashed."

## Create a file in the application data folder

To create a file in the application data folder, specify `appDataFolder` in the
`parents` property of the file and use the
[`files.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) method to create the file in
the folder.

The following code sample shows how to insert a file into a folder using a
client library and a curl command.

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Java

drive/snippets/drive\_v3/src/main/java/UploadAppData.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/UploadAppData.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.FileContent;
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
import java.util.Collections;

/**
 * Class to demonstrate use-case of create file in the application data folder.
 */
public class UploadAppData {

  /**
   * Creates a file in the application data folder.
   *
   * @return Created file's Id.
   */
  public static String uploadAppData() throws IOException {
        /*Load pre-authorized user credentials from the environment.
        TODO(developer) - See https://developers.google.com/identity for
        guides on implementing OAuth2 for your application.*/
    GoogleCredentials credentials = null;
    try {
      credentials = GoogleCredentials.getApplicationDefault()
          .createScoped(Arrays.asList(DriveScopes.DRIVE_APPDATA));
    } catch (IOException e) {
      e.printStackTrace();
    }
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    Drive service = new Drive.Builder(new NetHttpTransport(),
        GsonFactory.getDefaultInstance(),
        requestInitializer)
        .setApplicationName("Drive samples")
        .build();
    try {
      // File's metadata.
      File fileMetadata = new File();
      fileMetadata.setName("config.json");
      fileMetadata.setParents(Collections.singletonList("appDataFolder"));
      java.io.File filePath = new java.io.File("files/config.json");
      FileContent mediaContent = new FileContent("application/json", filePath);
      File file = service.files().create(fileMetadata, mediaContent)
          .setFields("id")
          .execute();
      System.out.println("File ID: " + file.getId());
      return file.getId();
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to create file: " + e.getDetails());
      throw e;
    }
  }

}
```

### Python

drive/snippets/drive-v3/app\_data\_snippet/upload\_appdata.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/app_data_snippet/upload_appdata.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload


def upload_appdata():
  """Insert a file in the application data folder and prints file Id.
  Returns : ID's of the inserted files

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # call drive api client
    service = build("drive", "v3", credentials=creds)

    # pylint: disable=maybe-no-member
    file_metadata = {"name": "abc.txt", "parents": ["appDataFolder"]}
    media = MediaFileUpload("abc.txt", mimetype="text/txt", resumable=True)
    file = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id")
        .execute()
    )
    print(f'File ID: {file.get("id")}')

  except HttpError as error:
    print(f"An error occurred: {error}")
    file = None

  return file.get("id")


if __name__ == "__main__":
  upload_appdata()
```

### Node.js

drive/snippets/drive\_v3/appdata\_snippets/upload\_appdata.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/appdata_snippets/upload_appdata.js)

```
import fs from 'node:fs';
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Uploads a file to the application data folder.
 * @return {Promise<string>} The ID of the uploaded file.
 */
async function uploadAppdata() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive.appdata',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // The metadata for the file to be uploaded.
  const fileMetadata = {
    name: 'config.json',
    parents: ['appDataFolder'],
  };

  // The media content to be uploaded.
  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream('files/config.json'),
  };

  // Upload the file to the application data folder.
  const file = await service.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id',
  });

  // Print the ID of the uploaded file.
  console.log('File Id:', file.data.id);
  if (!file.data.id) {
    throw new Error('File ID not found.');
  }
  return file.data.id;
}
```

### PHP

drive/snippets/drive\_v3/src/DriveUploadAppData.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveUploadAppData.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function uploadAppData()
{
   try {
    $client = new Client();
    $client->useApplicationDefaultCredentials();
    $client->addScope(Drive::DRIVE);
    $client->addScope(Drive::DRIVE_APPDATA);
    $driveService = new Drive($client);
    $fileMetadata = new Drive\DriveFile(array(
        'name' => 'config.json',
        'parents' => array('appDataFolder')
    ));
    $content = file_get_contents('../files/config.json');
    $file = $driveService->files->create($fileMetadata, array(
        'data' => $content,
        'mimeType' => 'application/json',
        'uploadType' => 'multipart',
        'fields' => 'id'));
    printf("File ID: %s\n", $file->id);
    return $file->id;

   } catch(Exception $e) {
     echo "Error Message: ".$e;
   }  
}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/UploadAppData.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/UploadAppData.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class of demonstrate the use of Drive upload app data. 
    public class UploadAppData
    {
        /// <summary>
        /// Insert a file in the application data folder and prints file Id.
        /// </summary>
        /// <param name="filePath">File path to upload.</param>
        /// <returns>ID's of the inserted files, null otherwise.</returns>
        public static string DriveUploadAppData(string filePath)
        {
            try
            {
                /* Load pre-authorized user credentials from the environment.
                 TODO(developer) - See https://developers.google.com/identity for
                 guides on implementing OAuth2 for your application. */
                GoogleCredential credential = GoogleCredential.GetApplicationDefault()
                    .CreateScoped(DriveService.Scope.DriveAppdata);

                // Create Drive API service.
                var service = new DriveService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Drive API Snippets"
                });
                var fileMetadata = new Google.Apis.Drive.v3.Data.File()
                {
                    Name = "config.json",
                    Parents = new List<string>()
                    {
                        "appDataFolder"
                    }
                };
                FilesResource.CreateMediaUpload request;
                using (var stream = new FileStream(filePath,
                           FileMode.Open))
                {
                    request = service.Files.Create(
                        fileMetadata, stream, "application/json");
                    request.Fields = "id";
                    request.Upload();
                }

                var file = request.ResponseBody;
                // Prints the file id.
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

### curl

**Request**:

```
curl --request POST \
'https://content.googleapis.com/drive/v3/files' \
    -H 'authorization: Bearer ACCESS_TOKEN' \
    -H 'content-type: application/json' \
    -H 'x-origin: https://explorer.apis.google.com' \
    --data-raw '{"name": "config.json", "parents":["appDataFolder"]}'
```

Replace ACCESS\_TOKEN with your app's [OAuth
2.0](https://developers.google.com/identity/protocols/oauth2) token.

**Response**:

```
{
    "kind": "drive#file",
    "id": FILE_ID,
    "name": "config.json",
    "mimeType": "application/json"
}
```

For further information on creating files in folders, refer to [Create and
populate folders](https://developers.google.com/workspace/drive/api/guides/folder).

## Search for files in the application data folder

To search for files in the application data folder, set the `spaces` field to
`appDataFolder` and use the [`files.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list)
method.

The following code sample shows how to search for files in the application data
folder using a client library and a curl command.

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Java

drive/snippets/drive\_v3/src/main/java/ListAppData.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/ListAppData.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
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
import java.util.Arrays;

/**
 * Class to demonstrate use-case of list 10 files in the application data folder.
 */
public class ListAppData {

  /**
   * list down files in the application data folder.
   *
   * @return list of 10 files.
   */
  public static FileList listAppData() throws IOException {
        /*Load pre-authorized user credentials from the environment.
        TODO(developer) - See https://developers.google.com/identity for
        guides on implementing OAuth2 for your application.*/
    GoogleCredentials credentials = null;
    try {
      credentials = GoogleCredentials.getApplicationDefault()
          .createScoped(Arrays.asList(DriveScopes.DRIVE_APPDATA));
    } catch (IOException e) {
      e.printStackTrace();
    }
    HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(
        credentials);

    // Build a new authorized API client service.
    Drive service = new Drive.Builder(new NetHttpTransport(),
        GsonFactory.getDefaultInstance(),
        requestInitializer)
        .setApplicationName("Drive samples")
        .build();
    try {
      FileList files = service.files().list()
          .setSpaces("appDataFolder")
          .setFields("nextPageToken, files(id, name)")
          .setPageSize(10)
          .execute();
      for (File file : files.getFiles()) {
        System.out.printf("Found file: %s (%s)\n",
            file.getName(), file.getId());
      }

      return files;
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to list files: " + e.getDetails());
      throw e;
    }
  }

}
```

### Python

drive/snippets/drive-v3/app\_data\_snippet/list\_appdata.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/app_data_snippet/list_appdata.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def list_appdata():
  """List all files inserted in the application data folder
  prints file titles with Ids.
  Returns : List of items

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # call drive api client
    service = build("drive", "v3", credentials=creds)

    # pylint: disable=maybe-no-member
    response = (
        service.files()
        .list(
            spaces="appDataFolder",
            fields="nextPageToken, files(id, name)",
            pageSize=10,
        )
        .execute()
    )
    for file in response.get("files", []):
      # Process change
      print(f'Found file: {file.get("name")}, {file.get("id")}')

  except HttpError as error:
    print(f"An error occurred: {error}")
    response = None

  return response.get("files")


if __name__ == "__main__":
  list_appdata()
```

### Node.js

drive/snippets/drive\_v3/appdata\_snippets/list\_appdata.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/appdata_snippets/list_appdata.js)

```
/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Lists all files in the application data folder.
 * @return {Promise<object[]>} A list of files.
 */
async function listAppdata() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive.appdata',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // List the files in the application data folder.
  const result = await service.files.list({
    spaces: 'appDataFolder',
    fields: 'nextPageToken, files(id, name)',
    pageSize: 100,
  });

  // Print the name and ID of each file.
  (result.data.files ?? []).forEach((file) => {
    console.log('Found file:', file.name, file.id);
  });

  return result.data.files ?? [];
}

export {listAppdata};
```

### PHP

drive/snippets/drive\_v3/src/DriveListAppData.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveListAppData.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function listAppData()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $response = $driveService->files->listFiles(array(
            'spaces' => 'appDataFolder',
            'fields' => 'nextPageToken, files(id, name)',
            'pageSize' => 10
        ));
        foreach ($response->files as $file) {
            printf("Found file: %s (%s)", $file->name, $file->id);
        }
        return $response->files;

    }catch(Exception $e) {
        echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/ListAppData.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/ListAppData.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of Drive's list files in the application data folder.
    public class ListAppData
    {
        /// <summary>
        /// List down files in the application data folder.
        /// </summary>
        /// <returns>list of 10 files, null otherwise.</returns>
        public static FileList DriveListAppData()
        {
            try
            {
                /* Load pre-authorized user credentials from the environment.
                 TODO(developer) - See https://developers.google.com/identity for
                 guides on implementing OAuth2 for your application. */
                GoogleCredential credential = GoogleCredential.GetApplicationDefault()
                    .CreateScoped(DriveService.Scope.DriveAppdata);

                // Create Drive API service.
                var service = new DriveService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Drive API Snippets"
                });

                var request = service.Files.List();
                request.Spaces = "appDataFolder";
                request.Fields = "nextPageToken, files(id, name)";
                request.PageSize = 10;
                var result = request.Execute();
                foreach (var file in result.Files)
                {
                    // Prints the list of 10 file names.
                    Console.WriteLine("Found file: {0} ({1})", file.Name, file.Id);
                }
                return result;
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

### curl

**Request**:

```
curl \
    -X GET \
    -H "Authorization: Bearer ACCESS_TOKEN" \
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,mimeType,size,modifiedTime)"
```

Replace ACCESS\_TOKEN with your app's [OAuth
2.0](https://developers.google.com/identity/protocols/oauth2) token.

**Response**:

```
{
    "files": [
        {
            "mimeType": "application/json",
            "size": "256",
            "id": FILE_ID,
            "name": "config.json",
            "modifiedTime": "2025-04-03T23:40:05.860Z"
        },
        {
            "mimeType": "text/plain",
            "size": "128",
            "id": FILE_ID,
            "name": "user_settings.txt",
            "modifiedTime": "2025-04-02T17:52:29.020Z"
        }
    ]
}
```

## Download files from the application data folder

To download a file from the application data folder, use the [`files.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method with the `alt=media` URL parameter to
retrieve the file contents in the response body. For more information, and to
view code samples, go to [Download blob file
content](https://developers.google.com/workspace/drive/api/guides/manage-downloads#download-content).

The following code sample shows how to download files in the application data
folder using a curl command. The response body will vary depending on what's
saved.

### curl

**Request**:

```
curl \
    -X GET \
    -H "Authorization: Bearer ACCESS_TOKEN" \
    "https://www.googleapis.com/drive/v3/files/FILE_ID?alt=media"
```

Replace the following:

* ACCESS\_TOKEN: Your app's [OAuth
  2.0](https://developers.google.com/identity/protocols/oauth2) token.
* FILE\_ID: The ID of the file you want to download.
