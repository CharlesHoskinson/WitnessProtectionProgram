# Download and export files Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/manage-downloads

Retrieved: 2026-09-19T16:29:39.716052+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The Google Drive API supports several types of download and export actions, as
listed in the following table:

|  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
| **Download actions** | |  | | --- | | Blob file content using the `files.get` method with the `alt=media` parameter. | | Blob file content at an earlier version using the `revisions.get` method with the `alt=media` parameter. | | Blob file content in a browser using the `webContentLink` field. | | Blob file content using the `files.download` method using long-running operations. This is the only way to download Google Vids files. | |
| **Export actions** | |  | | --- | | Google Workspace document content in a format that your app can handle, using the `files.export` method. | | Google Workspace document content in a browser using the `exportLinks` field. | | Google Workspace document content at an earlier version in a browser using the `exportLinks` field. | | Google Workspace document content using the `files.download` method using long-running operations. | |

In the Drive API, a blob file refers to any raw binary file stored on
Google Drive (such as images, videos, and PDFs) as opposed to a
Google Workspace document. It doesn't refer to JavaScript's
[`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) object. For
detailed descriptions of the file types mentioned here, including blob and
Google Workspace files, see [File
types](https://developers.google.com/workspace/drive/api/guides/about-files#types).

Before you download or export file content, verify that users can download the
file using the
[`capabilities.canDownload`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.inlinedField_12)
field on the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource.

The rest of this document provides detailed instructions for performing these
types of download and export actions.

## Download blob file content

To download a blob file stored on Drive, use the [`files.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) method with the ID of the file to download and the
`alt` [system
parameter](https://docs.cloud.google.com/apis/docs/system-parameters#definitions).
The `alt=media` parameter tells the server that a download of content is being
requested as an alternative response format.

The `alt` system parameter is available across all Google REST APIs. If you use
a Drive API client library, you don't need to explicitly set this
parameter as the client library method adds the `alt=media` parameter to the
underlying HTTP request.

The following code samples show how to use the `files.get` method to download a
file:

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Apps Script

```
/**
 * Downloads a file from Drive.
 * @param {string} fileId The ID of the file to download.
 * @return {Blob} The file content as a Blob.
 */
function downloadFile(fileId) {
  var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';
  var response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    }
  });
  return response.getBlob();
}
```

### Java

drive/snippets/drive\_v3/src/main/java/DownloadFile.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/DownloadFile.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

/* Class to demonstrate use-case of drive's download file. */
public class DownloadFile {

  /**
   * Download a Document file in PDF format.
   *
   * @param realFileId file ID of any workspace document format file.
   * @return byte array stream if successful, {@code null} otherwise.
   * @throws IOException if service account credentials file not found.
   */
  public static ByteArrayOutputStream downloadFile(String realFileId) throws IOException {
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
      OutputStream outputStream = new ByteArrayOutputStream();

      service.files().get(realFileId)
          .executeMediaAndDownloadTo(outputStream);

      return (ByteArrayOutputStream) outputStream;
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to move file: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/file\_snippet/download\_file.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/file_snippet/download_file.py)

```
import io

import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload


def download_file(real_file_id):
  """Downloads a file
  Args:
      real_file_id: ID of the file to download
  Returns : IO object with location.

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    file_id = real_file_id

    # pylint: disable=maybe-no-member
    request = service.files().get_media(fileId=file_id)
    file = io.BytesIO()
    downloader = MediaIoBaseDownload(file, request)
    done = False
    while done is False:
      status, done = downloader.next_chunk()
      print(f"Download {int(status.progress() * 100)}.")

  except HttpError as error:
    print(f"An error occurred: {error}")
    file = None

  return file.getvalue()


if __name__ == "__main__":
  download_file(real_file_id="1KuPmvGq8yoYgbfW74OENMCB5H0n_2Jm9")
```

### Node.js

drive/snippets/drive\_v3/file\_snippets/download\_file.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/file_snippets/download_file.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Downloads a file from Google Drive.
 * @param {string} fileId The ID of the file to download.
 * @return {Promise<number>} The status of the download.
 */
async function downloadFile(fileId) {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // Download the file.
  const file = await service.files.get({
    fileId,
    alt: 'media',
  });

  // Print the status of the download.
  console.log(file.status);
  return file.status;
}
```

### PHP

drive/snippets/drive\_v3/src/DriveDownloadFile.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveDownloadFile.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function downloadFile()
 {
    try {

      $client = new Client();
      $client->useApplicationDefaultCredentials();
      $client->addScope(Drive::DRIVE);
      $driveService = new Drive($client);
      $realFileId = readline("Enter File Id: ");
      $fileId = '0BwwA4oUTeiV1UVNwOHItT0xfa2M';
      $fileId = $realFileId;
      $response = $driveService->files->get($fileId, array(
          'alt' => 'media'));
      $content = $response->getBody()->getContents();
      return $content;

    } catch(Exception $e) {
      echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/DownloadFile.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/DownloadFile.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Download;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of drive's download file.
    public class DownloadFile
    {
        /// <summary>
        /// Download a Document file in PDF format.
        /// </summary>
        /// <param name="fileId">file ID of any workspace document format file.</param>
        /// <returns>byte array stream if successful, null otherwise.</returns>
        public static MemoryStream DriveDownloadFile(string fileId)
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

                var request = service.Files.Get(fileId);
                var stream = new MemoryStream();

                // Add a handler which will be notified on progress changes.
                // It will notify on each chunk download and when the
                // download is completed or failed.
                request.MediaDownloader.ProgressChanged +=
                    progress =>
                    {
                        switch (progress.Status)
                        {
                            case DownloadStatus.Downloading:
                            {
                                Console.WriteLine(progress.BytesDownloaded);
                                break;
                            }
                            case DownloadStatus.Completed:
                            {
                                Console.WriteLine("Download complete.");
                                break;
                            }
                            case DownloadStatus.Failed:
                            {
                                Console.WriteLine("Download failed.");
                                break;
                            }
                        }
                    };
                request.Download(stream);

                return stream;
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

```
curl -L "https://www.googleapis.com/drive/v3/files/FILE_ID?alt=media" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --output "FILE_NAME"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.
* FILE\_NAME: the name of the output file.

File downloads started from your app must be authorized with a scope that allows
read access to the file content. For example, an app using the
`drive.readonly.metadata` scope isn't authorized to download the file contents.
The client library code samples use the restricted `drive` file scope that allows
users to view and manage all of your Drive files. To learn more
about Drive scopes, refer to [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Users with `owner` permissions (for my Drive files) or
`organizer` permissions (for shared drive files) can restrict downloading
through the
[`DownloadRestrictionsMetadata`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestrictionsmetadata)
object. For more information, see [Prevent users from downloading, printing, or
copying your file](https://developers.google.com/workspace/drive/api/guides/content-restrictions#download-print-copy).

Files identified as [abusive](https://support.google.com/docs/answer/148505)
(such as harmful software) are only downloadable by the file owner.
Additionally, the `acknowledgeAbuse` query parameter must be set to `true` to
indicate that the user has acknowledged the risk of downloading potentially
unwanted software or other abusive files. Your application should interactively
warn the user before using this query parameter.

### Access file data in memory

If your application must access the file data directly in memory (for example,
as a byte buffer) rather than saving it to a local disk, you can adjust the
client library request or process the returned stream:

* **Node.js**: By default, the Node.js client library returns the file content
  as a `Readable` stream. To save the file to local disk:

  ```
  const fs = require('fs');

  const dest = fs.createWriteStream('/path/to/dest/file.ext');
  const response = await service.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  response.data
    .on('end', () => {
      console.log('Download complete.');
    })
    .on('error', (err) => {
      console.error('Error downloading file.', err);
    })
    .pipe(dest);
  ```

  Alternatively, to return the data directly in memory as an `ArrayBuffer`
  instead of a stream, set the `responseType` parameter in your request options:

  ```
  const file = await service.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'arraybuffer' });

  // Convert the ArrayBuffer to a Node.js Buffer object.
  const buffer = Buffer.from(file.data);
  ```
* **Python**: The [Python code sample to download a blob
  file](https://developers.google.com/workspace/drive/api/guides/manage-downloads#python) already writes
  the download chunks to an in-memory `io.BytesIO()` object. To access the raw
  bytes, call `file.getvalue()`.
* **Java**: The [Java code sample to download a blob
  file](https://developers.google.com/workspace/drive/api/guides/manage-downloads#java) uses a
  `java.io.ByteArrayOutputStream` to capture the downloaded bytes in memory.
  Use `outputStream.toByteArray()` to access the raw byte array.
* **.NET**: The [C# code sample to download a blob
  file](https://developers.google.com/workspace/drive/api/guides/manage-downloads#.net) uses a
  `System.IO.MemoryStream`. Use `stream.ToArray()` to access the underlying
  byte array.
* **Apps Script**: The [Apps Script code sample to download a blob
  file](https://developers.google.com/workspace/drive/api/guides/manage-downloads#apps-script) uses a
  `response.getBlob()` method to return a `Blob` object. Convert this to a
  byte array using the `getBytes()` method.

### Partial download

Partial download involves downloading only a specified portion of a file. You
can specify the portion of the file you want to download by using a [byte
range](https://www.rfc-editor.org/rfc/rfc9110.html#name-byte-ranges) with the
`Range` header. For example:

```
Range: bytes=500-999
```

**Note:** Partial downloads are not supported while exporting Google Workspace
documents.

## Download blob file content at an earlier version

To download the content of blob files at an earlier version, use the
[`revisions.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get) method with the ID of the
file to download, the ID of the revision, and the `alt` [system
parameter](https://docs.cloud.google.com/apis/docs/system-parameters#definitions).
The `alt=media` parameter tells the server that a download of content is being
requested as an alternative response format. Similar to `files.get`, the
`revisions.get` method also accepts the `acknowledgeAbuse` query parameter and
the `Range` header.

You can only download blob file content revisions that are marked as "Keep
Forever". If you want to download a revision, set it to "Keep Forever" first.
For more information, see [Specify revisions to save from auto delete](https://developers.google.com/workspace/drive/api/guides/manage-revisions#specify-revisions).

For additional information on downloading a revision, see [Manage long-running
operations](https://developers.google.com/workspace/drive/api/guides/long-running-operations#download-revision).

### curl

```
curl -L "https://www.googleapis.com/drive/v3/files/FILE_ID/revisions/REVISION_ID?alt=media" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --output "FILE_NAME"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* REVISION\_ID: the ID of the revision to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.
* FILE\_NAME: the name of the output file.

## Download blob file content in a browser

To download the content of blob files stored on Drive within a
browser, instead of through the API, use the [`webContentLink`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.web_content_link) field of the [`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource. If the user has download access to the file,
a link for downloading the file and its contents is returned. You can either
redirect a user to this URL, or offer it as a clickable link.

### curl

```
curl "https://www.googleapis.com/drive/v3/files/FILE_ID?fields=webContentLink" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Replace the following:

* FILE\_ID: the ID of the file to get the download link
  for.
* ACCESS\_TOKEN: the access token that grants access to
  the API.

## Download blob file content using long-running operations

To download the content of blob files using long-running operations (LRO), use
the [`files.download`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/download) method with the ID of
the file to download. You can optionally set the ID of the revision.

This is the only way to download Google Vids files. If you attempt to export
Google Vids files, you receive a
[`fileNotExportable`](https://developers.google.com/workspace/drive/api/guides/handle-errors#file-not-exportable) error.
For more information, see [Manage long-running
operations](https://developers.google.com/workspace/drive/api/guides/long-running-operations#download-files).

### curl

The following curl command initiates a LRO and returns a JSON response. To
either download the file or poll this LRO you must make another request
using the returned ID to obtain the content URL. Then, you can make a final
curl request to that URL to download the file. For more information, see
[Manage long-running
operations](https://developers.google.com/workspace/drive/api/guides/long-running-operations#process-overview).

```
curl --request POST "https://www.googleapis.com/drive/v3/files/FILE_ID/download?mimeType=video/mp4" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Length: 0" \
  --header "Accept: application/json"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.

## Export Google Workspace document content

To export Google Workspace document byte content, use the [`files.export`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export) method with the ID of the file to export and
the correct MIME type. Exported content is limited to 10 MB.

The following code samples show how to use the `files.export` method to export a
Google Workspace document in PDF format:

**Note:** If you're using the older Drive API v2, you can find code samples in
[GitHub](https://github.com/googleworkspace). Learn
how to [migrate to Drive API v3](https://developers.google.com/workspace/drive/api/guides/migrate-to-v3).

### Apps Script

```
/**
 * Exports a Google Workspace document.
 * @param {string} fileId The ID of the file to export.
 * @param {string} mimeType The MIME type to export to.
 * @return {Blob} The exported content as a Blob.
 */
function exportPdf(fileId, mimeType) {
  var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '/export?mimeType=' + encodeURIComponent(mimeType);
  var response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    }
  });
  return response.getBlob();
}
```

### Java

drive/snippets/drive\_v3/src/main/java/ExportPdf.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/ExportPdf.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

/* Class to demonstrate use-case of drive's export pdf. */
public class ExportPdf {

  /**
   * Download a Document file in PDF format.
   *
   * @param realFileId file ID of any workspace document format file.
   * @return byte array stream if successful, {@code null} otherwise.
   * @throws IOException if service account credentials file not found.
   */
  public static ByteArrayOutputStream exportPdf(String realFileId) throws IOException {
    // Load pre-authorized user credentials from the environment.
    // TODO(developer) - See https://developers.google.com/identity for
    // guides on implementing OAuth2 for your application.
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

    OutputStream outputStream = new ByteArrayOutputStream();
    try {
      service.files().export(realFileId, "application/pdf")
          .executeMediaAndDownloadTo(outputStream);

      return (ByteArrayOutputStream) outputStream;
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to export file: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/file\_snippet/export\_pdf.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/file_snippet/export_pdf.py)

```
import io

import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload


def export_pdf(real_file_id):
  """Download a Document file in PDF format.
  Args:
      real_file_id : file ID of any workspace document format file
  Returns : IO object with location

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    file_id = real_file_id

    # pylint: disable=maybe-no-member
    request = service.files().export_media(
        fileId=file_id, mimeType="application/pdf"
    )
    file = io.BytesIO()
    downloader = MediaIoBaseDownload(file, request)
    done = False
    while done is False:
      status, done = downloader.next_chunk()
      print(f"Download {int(status.progress() * 100)}.")

  except HttpError as error:
    print(f"An error occurred: {error}")
    file = None

  return file.getvalue()


if __name__ == "__main__":
  export_pdf(real_file_id="1zbp8wAyuImX91Jt9mI-CAX_1TqkBLDEDcr2WeXBbKUY")
```

### Node.js

drive/snippets/drive\_v3/file\_snippets/export\_pdf.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/file_snippets/export_pdf.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Exports a Google Doc as a PDF.
 * @param {string} fileId The ID of the file to export.
 * @return {Promise<number>} The status of the export request.
 */
async function exportPdf(fileId) {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // Export the file as a PDF.
  const result = await service.files.export({
    fileId,
    mimeType: 'application/pdf',
  });

  // Print the status of the export.
  console.log(result.status);
  return result.status;
}
```

### PHP

drive/snippets/drive\_v3/src/DriveExportPdf.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveExportPdf.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
function exportPdf()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $realFileId = readline("Enter File Id: ");
        $fileId = '1ZdR3L3qP4Bkq8noWLJHSr_iBau0DNT4Kli4SxNc2YEo';
        $fileId = $realFileId;
        $response = $driveService->files->export($fileId, 'application/pdf', array(
            'alt' => 'media'));
        $content = $response->getBody()->getContents();
        return $content;

    }  catch(Exception $e) {
         echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/ExportPdf.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/ExportPdf.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Download;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use of Drive export pdf
    public class ExportPdf
    {
        /// <summary>
        /// Download a Document file in PDF format.
        /// </summary>
        /// <param name="fileId">Id of the file.</param>
        /// <returns>Byte array stream if successful, null otherwise</returns>
        public static MemoryStream DriveExportPdf(string fileId)
        {
            try
            {
                /* Load pre-authorized user credentials from the environment.
                 TODO(developer) - See https://developers.google.com/identity for 
                 guides on implementing OAuth2 for your application. */
                GoogleCredential credential = GoogleCredential.GetApplicationDefault()
                    .CreateScoped(DriveService.Scope.Drive);

                // Create Drive API service.
                var service = new DriveService(new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Drive API Snippets"
                });

                var request = service.Files.Export(fileId, "application/pdf");
                var stream = new MemoryStream();
                // Add a handler which will be notified on progress changes.
                // It will notify on each chunk download and when the
                // download is completed or failed.
                request.MediaDownloader.ProgressChanged +=
                    progress =>
                    {
                        switch (progress.Status)
                        {
                            case DownloadStatus.Downloading:
                            {
                                Console.WriteLine(progress.BytesDownloaded);
                                break;
                            }
                            case DownloadStatus.Completed:
                            {
                                Console.WriteLine("Download complete.");
                                break;
                            }
                            case DownloadStatus.Failed:
                            {
                                Console.WriteLine("Download failed.");
                                break;
                            }
                        }
                    };
                request.Download(stream);
                return stream;
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

```
curl -L "https://www.googleapis.com/drive/v3/files/FILE_ID/export?mimeType=application/pdf" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --output "FILE_NAME.pdf"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.
* FILE\_NAME: the name of the output file.

The client library code samples use the restricted `drive` scope that allows
users to view and manage all of your Drive files. To learn more
about Drive scopes, refer to [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

The code samples also declare the export MIME type as `application/pdf`. For a
complete list of all export MIME types supported for each Google Workspace
document, refer to [Export MIME types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).

## Export Google Workspace document content in a browser

To export Google Workspace document content within a browser, use the
[`exportLinks`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.FIELDS.export_links) field of the
[`files`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource. Depending on the document type, a
link to download the file and its contents is returned for every MIME type
available. You can either redirect a user to a URL, or offer it as a clickable
link.

### curl

```
curl "https://www.googleapis.com/drive/v3/files/FILE_ID?fields=id,name,exportLinks" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Replace the following:

* FILE\_ID: the ID of the file to get the download link
  for.
* ACCESS\_TOKEN: the access token that grants access to
  the API.

## Export Google Workspace document content at an earlier version in a browser

To export Google Workspace document content at an earlier version within a
browser, use the [`revisions.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get) method with
the ID of the file to download and the ID of the revision to generate an export
link from which you can perform the download. If the user has download access to
the file, a link for downloading the file and its contents is returned. You can
either redirect a user to this URL, or offer it as a clickable link.

### curl

```
curl "https://www.googleapis.com/drive/v3/files/FILE_ID/revisions/REVISION_ID?fields=id,name,exportLinks" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* REVISION\_ID: the ID of the revision to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.

## Export Google Workspace document content using long-running operations

To export Google Workspace document content using long-running operations
(LRO), use the [`files.download`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/download) method with
the ID of the file to download and the ID of the revision. For more information,
see [Manage long-running operations](https://developers.google.com/workspace/drive/api/guides/long-running-operations).

### curl

The following curl command initiates a LRO and returns a JSON response. To
either download the file or poll this LRO you must make another request
using the returned ID to obtain the content URL. Then, you can make a final
curl request to that URL to download the file. For more information, see
[Manage long-running
operations](https://developers.google.com/workspace/drive/api/guides/long-running-operations#process-overview).

```
curl --request POST "https://www.googleapis.com/drive/v3/files/FILE_ID/download?mimeType=MIME_TYPE&revisionId=REVISION_ID" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Length: 0" \
  --header "Accept: application/json"
```

Replace the following:

* FILE\_ID: the ID of the file to download.
* MIME\_TYPE: the MIME type to export to.
* REVISION\_ID: the ID of the revision to download.
* ACCESS\_TOKEN: the access token that grants access to
  the API.

## Related topics

* [Protect file content](https://developers.google.com/workspace/drive/api/guides/content-restrictions)
* [Export MIME types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
