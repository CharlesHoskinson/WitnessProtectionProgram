# Retrieve changes Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/manage-changes

Retrieved: 2026-09-19T16:30:04.615942+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

For Google Drive apps that must track changes to files, the
[`changes`](https://developers.google.com/workspace/drive/api/v3/reference/changes) collection provides an efficient
way to detect all file changes, including those shared with a user. If the file
has changed, the collection provides the current state of each file.

## Get start page token

To request the page token for the current state of the account, use the
[`changes.getStartPageToken`](https://developers.google.com/workspace/drive/api/v3/reference/changes/getStartPageToken).
Store and use this token in your initial call to
[`changes.list`](https://developers.google.com/workspace/drive/api/v3/reference/changes/list).

To retrieve the current page token:

### Java

drive/snippets/drive\_v3/src/main/java/FetchStartPageToken.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/FetchStartPageToken.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.StartPageToken;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Arrays;

/* Class to demonstrate use-case of Drive's fetch start page token */
public class FetchStartPageToken {

  /**
   * Retrieve the start page token for the first time.
   *
   * @return Start page token as String.
   * @throws IOException if file is not found
   */
  public static String fetchStartPageToken() throws IOException {
        /*Load pre-authorized user credentials from the environment.
        TODO(developer) - See https://developers.google.com/identity for
        guides on implementing OAuth2 for your application. */

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
      StartPageToken response = service.changes()
          .getStartPageToken().execute();
      System.out.println("Start token: " + response.getStartPageToken());

      return response.getStartPageToken();
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to fetch start page token: " + e.getDetails());
      throw e;
    }
  }

}
```

### Python

drive/snippets/drive-v3/change\_snippet/fetch\_start\_page\_token.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/change_snippet/fetch_start_page_token.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def fetch_start_page_token():
  """Retrieve page token for the current state of the account.
  Returns & prints : start page token

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()

  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    # pylint: disable=maybe-no-member
    response = service.changes().getStartPageToken().execute()
    print(f'Start token: {response.get("startPageToken")}')

  except HttpError as error:
    print(f"An error occurred: {error}")
    response = None

  return response.get("startPageToken")


if __name__ == "__main__":
  fetch_start_page_token()
```

### PHP

drive/snippets/drive\_v3/src/DriveFetchStartPageToken.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveFetchStartPageToken.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
# TODO - PHP client currently chokes on fetching start page token
function fetchStartPageToken()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        $response = $driveService->changes->getStartPageToken();
        printf("Start token: %s\n", $response->startPageToken);
        return $response->startPageToken;
    } catch(Exception $e) {
        echo "Error Message: ".$e;
    }

}
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/FetchStartPageToken.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/FetchStartPageToken.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of Drive's fetch start page token
    public class FetchStartPageToken
    {
        /// <summary>
        /// Retrieve the starting page token.
        /// </summary>
        /// <returns>start page token as String, null otherwise.</returns>
        public static string DriveFetchStartPageToken()
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

                var response = service.Changes.GetStartPageToken().Execute();
                // Prints the token value.
                Console.WriteLine("Start token: " + response.StartPageTokenValue);
                return response.StartPageTokenValue;
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

drive/snippets/drive\_v3/change\_snippets/fetch\_start\_page\_token.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/change_snippets/fetch_start_page_token.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Fetches the start page token for the current state of the account.
 * @return {Promise<string>} The start page token.
 */
async function fetchStartPageToken() {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive.appdata',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // Fetch the start page token.
  const res = await service.changes.getStartPageToken({});
  const token = res.data.startPageToken;
  console.log('start token: ', token);
  if (!token) {
    throw new Error('Start page token not found.');
  }
  return token;
}
```

## Get changes

To retrieve the list of changes for the currently signed in user, send a `GET`
request to the `changes` collection, as detailed in the
[`changes.list`](https://developers.google.com/workspace/drive/api/v3/reference/changes/list).

Entries in the `changes` collection are in chronological order (the oldest
changes appear first). The `includeRemoved` and `restrictToMyDrive` query
parameters determine whether the response should include removed or shared
items.

### Java

drive/snippets/drive\_v3/src/main/java/FetchChanges.java

[View on GitHub](https://github.com/googleworkspace/java-samples/blob/main/drive/snippets/drive_v3/src/main/java/FetchChanges.java)

```
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.ChangeList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Arrays;

/* Class to demonstrate use-case of Drive's fetch changes in file. */
public class FetchChanges {
  /**
   * Retrieve the list of changes for the currently authenticated user.
   *
   * @param savedStartPageToken Last saved start token for this user.
   * @return Saved token after last page.
   * @throws IOException if file is not found
   */
  public static String fetchChanges(String savedStartPageToken) throws IOException {

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
    try {
      // Begin with our last saved start token for this user or the
      // current token from getStartPageToken()
      String pageToken = savedStartPageToken;
      while (pageToken != null) {
        ChangeList changes = service.changes().list(pageToken)
            .execute();
        for (com.google.api.services.drive.model.Change change : changes.getChanges()) {
          // Process change
          System.out.println("Change found for file: " + change.getFileId());
        }
        if (changes.getNewStartPageToken() != null) {
          // Last page, save this token for the next polling interval
          savedStartPageToken = changes.getNewStartPageToken();
        }
        pageToken = changes.getNextPageToken();
      }

      return savedStartPageToken;
    } catch (GoogleJsonResponseException e) {
      // TODO(developer) - handle error appropriately
      System.err.println("Unable to fetch changes: " + e.getDetails());
      throw e;
    }
  }
}
```

### Python

drive/snippets/drive-v3/change\_snippet/fetch\_changes.py

[View on GitHub](https://github.com/googleworkspace/python-samples/blob/main/drive/snippets/drive-v3/change_snippet/fetch_changes.py)

```
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def fetch_changes(saved_start_page_token):
  """Retrieve the list of changes for the currently authenticated user.
      prints changed file's ID
  Args:
      saved_start_page_token : StartPageToken for the current state of the
      account.
  Returns: saved start page token.

  Load pre-authorized user credentials from the environment.
  TODO(developer) - See https://developers.google.com/identity
  for guides on implementing OAuth2 for the application.
  """
  creds, _ = google.auth.default()
  try:
    # create drive api client
    service = build("drive", "v3", credentials=creds)

    # Begin with our last saved start token for this user or the
    # current token from getStartPageToken()
    page_token = saved_start_page_token
    # pylint: disable=maybe-no-member

    while page_token is not None:
      response = (
          service.changes().list(pageToken=page_token, spaces="drive").execute()
      )
      for change in response.get("changes"):
        # Process change
        print(f'Change found for file: {change.get("fileId")}')
      if "newStartPageToken" in response:
        # Last page, save this token for the next polling interval
        saved_start_page_token = response.get("newStartPageToken")
      page_token = response.get("nextPageToken")

  except HttpError as error:
    print(f"An error occurred: {error}")
    saved_start_page_token = None

  return saved_start_page_token


if __name__ == "__main__":
  # saved_start_page_token is the token number
  fetch_changes(saved_start_page_token=209)
```

### PHP

drive/snippets/drive\_v3/src/DriveFetchChanges.php

[View on GitHub](https://github.com/googleworkspace/php-samples/blob/main/drive/snippets/drive_v3/src/DriveFetchChanges.php)

```
<?php
use Google\Client;
use Google\Service\Drive;
# TODO - PHP client currently chokes on fetching start page token
function fetchChanges()
{
    try {
        $client = new Client();
        $client->useApplicationDefaultCredentials();
        $client->addScope(Drive::DRIVE);
        $driveService = new Drive($client);
        # Begin with our last saved start token for this user or the
        # current token from getStartPageToken()
        $savedStartPageToken = readLine("Enter Start Page Token: ");
        $pageToken = $savedStartPageToken;
        while ($pageToken != null) {
            $response = $driveService->changes->listChanges($pageToken, array(
                'spaces' => 'drive'
            ));
            foreach ($response->changes as $change) {
                // Process change
                printf("Change found for file: %s", $change->fileId);
            }
            if ($response->newStartPageToken != null) {
                // Last page, save this token for the next polling interval
                $savedStartPageToken = $response->newStartPageToken;
            }
            $pageToken = $response->nextPageToken;
        }
        echo $savedStartPageToken;
    } catch(Exception $e) {
        echo "Error Message: ".$e;
    }

}
require_once 'vendor/autoload.php';
```

### .NET

drive/snippets/drive\_v3/DriveV3Snippets/FetchChanges.cs

[View on GitHub](https://github.com/googleworkspace/dotnet-samples/blob/main/drive/snippets/drive_v3/DriveV3Snippets/FetchChanges.cs)

```
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;

namespace DriveV3Snippets
{
    // Class to demonstrate use-case of Drive's fetch changes in file.
    public class FetchChanges
    {
        /// <summary>
        /// Retrieve the list of changes for the currently authenticated user.
        /// prints changed file's ID
        /// </summary>
        /// <param name="savedStartPageToken">last saved start token for this user.</param>
        /// <returns>saved token for the current state of the account, null otherwise.</returns>
        public static string DriveFetchChanges(string savedStartPageToken)
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

                // Begin with our last saved start token for this user or the
                // current token from GetStartPageToken()
                string pageToken = savedStartPageToken;
                while (pageToken != null)
                {
                    var request = service.Changes.List(pageToken);
                    request.Spaces = "drive";
                    var changes = request.Execute();
                    foreach (var change in changes.Changes)
                    {
                        // Process change
                        Console.WriteLine("Change found for file: " + change.FileId);
                    }

                    if (changes.NewStartPageToken != null)
                    {
                        // Last page, save this token for the next polling interval
                        savedStartPageToken = changes.NewStartPageToken;
                    }
                    pageToken = changes.NextPageToken;
                }
                return savedStartPageToken;
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

drive/snippets/drive\_v3/change\_snippets/fetch\_changes.js

[View on GitHub](https://github.com/googleworkspace/node-samples/blob/main/drive/snippets/drive_v3/change_snippets/fetch_changes.js)

```
import {GoogleAuth} from 'google-auth-library';
import {google} from 'googleapis';

/**
 * Fetches the list of changes for the currently authenticated user.
 * @param {string} savedStartPageToken The page token obtained from `fetch_start_page_token.js`.
 */
async function fetchChanges(savedStartPageToken) {
  // Authenticate with Google and get an authorized client.
  // TODO (developer): Use an appropriate auth mechanism for your app.
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/drive.readonly',
  });

  // Create a new Drive API client (v3).
  const service = google.drive({version: 'v3', auth});

  // The page token for the next page of changes.
  let pageToken = savedStartPageToken;

  // Loop to fetch all changes, handling pagination.
  do {
    const result = await service.changes.list({
      pageToken: savedStartPageToken,
      fields: '*',
    });

    // Process the changes.
    (result.data.changes ?? []).forEach((change) => {
      console.log('change found for file: ', change.fileId);
    });

    // Update the page token for the next iteration.
    pageToken = result.data.newStartPageToken ?? '';
  } while (pageToken);
}
```

The `changes` collection in the
[response](https://developers.google.com/workspace/drive/api/v3/reference/changes/list#response) might contain a
`nextPageToken`. If the `nextPageToken` is listed, it can be used to gather the
next page of changes. If it's not listed, the client application should store
the `newStartPageToken` in the response for future use. With the page token
stored, the client application is prepared to query again for future changes.

## Receive notifications

Use the [`changes.watch`](https://developers.google.com/workspace/drive/api/v3/reference/changes/watch) method to
subscribe to updates in the change log. Notifications don't contain details
about the changes. Instead, they indicate that new changes are available. To
retrieve the actual changes, poll the change feed as described in [Get
changes](https://developers.google.com/workspace/drive/api/guides/manage-changes#get-changes).

**Note:** While not documented in
[`changes.watch`](https://developers.google.com/workspace/drive/api/v3/reference/changes/watch), the method does
require a `pageToken` parameter similar to `changes.list`. This can be retrieved
from `changes.getStartPageToken`.

For more information, see [Notifications for resource changes](https://developers.google.com/workspace/drive/api/guides/push).
